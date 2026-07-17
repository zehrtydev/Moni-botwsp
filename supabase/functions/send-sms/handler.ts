import type { EvolutionTextMessage } from "../_shared/evolution-client.ts";

interface SendSmsDependencies {
  claimDelivery(delivery: {
    fingerprint: string;
    webhookId: string;
  }): Promise<"busy" | "claimed" | "completed">;
  completeDelivery(
    fingerprint: string,
    outcome: "delivered" | "indeterminate",
  ): Promise<void>;
  fingerprintDelivery(phone: string, otp: string): Promise<string>;
  isAmbiguousDeliveryError(error: unknown): boolean;
  releaseDelivery(fingerprint: string): Promise<void>;
  sendText(message: EvolutionTextMessage): Promise<void>;
  verify(payload: string, headers: Headers): unknown;
}

type SendSmsHandler = (request: Request) => Promise<Response>;

const e164Pattern = /^\+[1-9][0-9]{7,14}$/;
const otpPattern = /^[0-9]{6}$/;
const maximumBodyBytes = 32_768;
const webhookIdPattern = /^[\x21-\x7e]{1,255}$/;

type BoundedBody =
  | { kind: "ok"; value: string }
  | { kind: "invalid" }
  | { kind: "too-large" };

function textResponse(body: string, status: number, headers?: HeadersInit) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...headers,
    },
  });
}

async function readBoundedBody(request: Request): Promise<BoundedBody> {
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    if (!/^[0-9]+$/.test(contentLength)) {
      return { kind: "invalid" };
    }

    if (Number(contentLength) > maximumBodyBytes) {
      return { kind: "too-large" };
    }
  }

  if (!request.body) {
    return { kind: "ok", value: "" };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let value = "";

  try {
    while (true) {
      const part = await reader.read();

      if (part.done) {
        value += decoder.decode();
        return { kind: "ok", value };
      }

      byteLength += part.value.byteLength;

      if (byteLength > maximumBodyBytes) {
        await reader.cancel();
        return { kind: "too-large" };
      }

      value += decoder.decode(part.value, { stream: true });
    }
  } catch {
    return { kind: "invalid" };
  }
}

function readHookPayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const event = value as Record<string, unknown>;
  const user = event.user;
  const sms = event.sms;

  if (
    !user ||
    typeof user !== "object" ||
    !sms ||
    typeof sms !== "object"
  ) {
    return null;
  }

  const phone = (user as Record<string, unknown>).phone;
  const otp = (sms as Record<string, unknown>).otp;

  if (
    typeof phone !== "string" ||
    !e164Pattern.test(phone) ||
    typeof otp !== "string" ||
    !otpPattern.test(otp)
  ) {
    return null;
  }

  return { phone, otp };
}

export function createSendSmsHandler(
  dependencies: SendSmsDependencies,
): SendSmsHandler {
  return async (request) => {
    if (request.method !== "POST") {
      return textResponse("Metodo no permitido.", 405, { allow: "POST" });
    }

    const body = await readBoundedBody(request);

    if (body.kind === "invalid") {
      return textResponse("Solicitud invalida.", 400);
    }

    if (body.kind === "too-large") {
      return textResponse("La solicitud es demasiado grande.", 413);
    }

    const rawPayload = body.value;

    let verifiedPayload: unknown;

    try {
      verifiedPayload = dependencies.verify(rawPayload, request.headers);
    } catch {
      return textResponse("Solicitud no autorizada.", 401);
    }

    const payload = readHookPayload(verifiedPayload);
    const webhookId = request.headers.get("webhook-id");

    if (!payload || !webhookId || !webhookIdPattern.test(webhookId)) {
      return textResponse("Solicitud invalida.", 400);
    }

    let fingerprint: string;
    let claim: "busy" | "claimed" | "completed";

    try {
      fingerprint = await dependencies.fingerprintDelivery(
        payload.phone,
        payload.otp,
      );
      claim = await dependencies.claimDelivery({ fingerprint, webhookId });
    } catch {
      return textResponse("No pudimos procesar la solicitud.", 503);
    }

    if (claim === "completed") {
      return new Response(null, { status: 200 });
    }

    if (claim === "busy") {
      return textResponse("Entrega en proceso.", 503, { "retry-after": "2" });
    }

    try {
      await dependencies.sendText({
        phone: payload.phone,
        text:
          `Tu codigo de Moni es ${payload.otp}. ` +
          "Expira pronto. No lo compartas.",
      });
    } catch (error) {
      try {
        if (dependencies.isAmbiguousDeliveryError(error)) {
          await dependencies.completeDelivery(fingerprint, "indeterminate");
        } else {
          await dependencies.releaseDelivery(fingerprint);
        }
      } catch {
        return textResponse("No pudimos procesar la solicitud.", 503);
      }

      return textResponse("No pudimos entregar el codigo.", 502);
    }

    try {
      await dependencies.completeDelivery(fingerprint, "delivered");
    } catch {
      return textResponse("No pudimos procesar la solicitud.", 503);
    }

    return new Response(null, { status: 200 });
  };
}
