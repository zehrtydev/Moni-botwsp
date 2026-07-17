import {
  type InboundRelayMessage,
  parseInboundRelayPayload,
} from "../_shared/inbound-contract.ts";
import type { EvolutionTextMessage } from "../_shared/evolution-client.ts";
import {
  extractTextExpense,
  type TextExpenseExtraction,
} from "../_shared/text-expense-extractor.ts";

interface PersistedInboundMessage {
  proveedor: "evolution";
  instancia: string;
  mensaje_origen_id: string;
  numero_whatsapp: string;
  tipo: "texto" | "imagen";
  recibido_en: string;
}

interface EvolutionWebhookDependencies {
  claimReply(inboxId: string): Promise<
    | { state: "claimed"; leaseToken: string; reply: string }
    | { state: "busy" | "completed" | "none" }
  >;
  completeReply(
    inboxId: string,
    leaseToken: string,
    outcome: "delivered" | "rejected" | "unknown",
  ): Promise<void>;
  expectedInstance: string;
  isAmbiguousDeliveryError(error: unknown): boolean;
  isRejectedDeliveryError(error: unknown): boolean;
  persistMessage(
    message: PersistedInboundMessage,
  ): Promise<"inserted" | "duplicate">;
  processText(
    instance: string,
    message: InboundRelayMessage,
    extraction: TextExpenseExtraction,
  ): Promise<{
    inboxId: string;
  }>;
  releaseReply(inboxId: string, leaseToken: string): Promise<void>;
  sendText(message: EvolutionTextMessage): Promise<void>;
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

    if (event.instance !== dependencies.expectedInstance) {
      return textResponse("Instancia no autorizada.", 403);
    }

    let result: "inserted" | "duplicate";

    try {
      result = await dependencies.persistMessage(
        persistedMessage(event.instance, event.message),
      );
    } catch {
      return textResponse("No pudimos procesar el mensaje.", 503);
    }

    if (result !== "inserted" && result !== "duplicate") {
      return textResponse("No pudimos procesar el mensaje.", 503);
    }

    if (event.message.tipo === "texto") {
      let processed;

      try {
        const extraction = extractTextExpense(
          event.message.contenido as string,
          event.message.timestamp,
        );
        processed = await dependencies.processText(
          event.instance,
          event.message,
          extraction,
        );
      } catch {
        return textResponse("No pudimos procesar el mensaje.", 503);
      }

      let claim;

      try {
        claim = await dependencies.claimReply(processed.inboxId);
      } catch {
        return textResponse("No pudimos procesar el mensaje.", 503);
      }

      if (claim.state !== "claimed") {
        return new Response(null, {
          status: result === "inserted" ? 202 : 200,
        });
      }

      if (!claim.reply) {
        return textResponse("No pudimos procesar el mensaje.", 503);
      }

      try {
        await dependencies.sendText({
          phone: event.message.numero_whatsapp,
          text: claim.reply,
        });
      } catch (error) {
        const terminalOutcome = dependencies.isRejectedDeliveryError(error)
          ? "rejected" as const
          : dependencies.isAmbiguousDeliveryError(error)
          ? "unknown" as const
          : null;

        if (terminalOutcome === null) {
          try {
            await dependencies.releaseReply(
              processed.inboxId,
              claim.leaseToken,
            );
          } catch {
            return textResponse("No pudimos procesar el mensaje.", 503);
          }

          return textResponse("No pudimos procesar el mensaje.", 503);
        }

        try {
          await dependencies.completeReply(
            processed.inboxId,
            claim.leaseToken,
            terminalOutcome,
          );
        } catch {
          return textResponse("No pudimos procesar el mensaje.", 503);
        }

        return new Response(null, {
          status: result === "inserted" ? 202 : 200,
        });
      }

      try {
        await dependencies.completeReply(
          processed.inboxId,
          claim.leaseToken,
          "delivered",
        );
      } catch {
        return textResponse("No pudimos procesar el mensaje.", 503);
      }
    }

    return new Response(null, { status: result === "inserted" ? 202 : 200 });
  };
}
