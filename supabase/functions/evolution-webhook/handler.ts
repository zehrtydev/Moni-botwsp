import {
  parseInboundRelayPayload,
  type InboundRelayMessage,
} from "../_shared/inbound-contract.ts";

interface PersistedInboundMessage {
  proveedor: "evolution";
  instancia: string;
  mensaje_origen_id: string;
  numero_whatsapp: string;
  tipo: "texto" | "imagen";
  recibido_en: string;
}

interface EvolutionWebhookDependencies {
  persistMessage(
    message: PersistedInboundMessage,
  ): Promise<"inserted" | "duplicate">;
  verify(payload: string, headers: Headers): unknown | Promise<unknown>;
}

type EvolutionWebhookHandler = (request: Request) => Promise<Response>;

const maximumBodyBytes = 65_536;

function textResponse(body: string, status: number, headers?: HeadersInit) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...headers,
    },
  });
}

async function readBody(request: Request) {
  const declaredLength = request.headers.get("content-length");

  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBodyBytes)
  ) {
    return { kind: "too-large" as const, value: "" };
  }

  if (!request.body) {
    return { kind: "ok" as const, value: "" };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let value = "";

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) {
        return { kind: "ok" as const, value: value + decoder.decode() };
      }

      bytes += chunk.value.byteLength;

      if (bytes > maximumBodyBytes) {
        await reader.cancel();
        return { kind: "too-large" as const, value: "" };
      }

      value += decoder.decode(chunk.value, { stream: true });
    }
  } catch {
    return { kind: "invalid" as const, value: "" };
  }
}

function persistedMessage(
  instance: string,
  message: InboundRelayMessage,
): PersistedInboundMessage {
  return {
    proveedor: "evolution",
    instancia: instance,
    mensaje_origen_id: message.mensaje_origen_id,
    numero_whatsapp: message.numero_whatsapp,
    tipo: message.tipo,
    recibido_en: message.timestamp,
  };
}

export function createEvolutionWebhookHandler(
  dependencies: EvolutionWebhookDependencies,
): EvolutionWebhookHandler {
  return async (request) => {
    if (request.method !== "POST") {
      return textResponse("Metodo no permitido.", 405, { allow: "POST" });
    }

    const body = await readBody(request);

    if (body.kind === "too-large") {
      return textResponse("La solicitud es demasiado grande.", 413);
    }

    if (body.kind === "invalid") {
      return textResponse("Solicitud invalida.", 400);
    }

    let verifiedPayload: unknown;

    try {
      verifiedPayload = await dependencies.verify(body.value, request.headers);
    } catch {
      return textResponse("Solicitud no autorizada.", 401);
    }

    let event;

    try {
      event = parseInboundRelayPayload(verifiedPayload);
    } catch {
      return textResponse("Solicitud invalida.", 400);
    }

    let result: "inserted" | "duplicate";

    try {
      result = await dependencies.persistMessage(
        persistedMessage(event.instance, event.message),
      );
    } catch {
      return textResponse("No pudimos procesar el mensaje.", 503);
    }

    if (result === "duplicate") {
      return new Response(null, { status: 200 });
    }

    if (result !== "inserted") {
      return textResponse("No pudimos procesar el mensaje.", 503);
    }

    return new Response(null, { status: 202 });
  };
}
