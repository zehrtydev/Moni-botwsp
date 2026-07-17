export type InboundMessageType = "texto" | "imagen";

export interface InboundRelayMessage {
  mensaje_origen_id: string;
  numero_whatsapp: string;
  tipo: InboundMessageType;
  contenido: string | null;
  media: Record<string, unknown> | null;
  timestamp: string;
}

export interface InboundRelayEvent {
  provider: "evolution";
  instance: string;
  message: InboundRelayMessage;
}

const e164Pattern = /^\+[1-9][0-9]{7,14}$/;
const printablePattern = /^[\x21-\x7e]+$/;

function invalidContract() {
  return new Error("El contrato del mensaje entrante no es valido.");
}

function recordValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function parseInboundRelayPayload(value: unknown): InboundRelayEvent {
  const event = recordValue(value);
  const message = event ? recordValue(event.message) : null;

  if (
    !event ||
    event.provider !== "evolution" ||
    typeof event.instance !== "string" ||
    event.instance.length > 128 ||
    !printablePattern.test(event.instance) ||
    !message
  ) {
    throw invalidContract();
  }

  const originId = message.mensaje_origen_id;
  const phone = message.numero_whatsapp;
  const type = message.tipo;
  const content = message.contenido;
  const media = message.media;
  const timestamp = message.timestamp;

  if (
    typeof originId !== "string" ||
    originId.length > 255 ||
    !printablePattern.test(originId) ||
    typeof phone !== "string" ||
    !e164Pattern.test(phone) ||
    (type !== "texto" && type !== "imagen") ||
    typeof timestamp !== "string"
  ) {
    throw invalidContract();
  }

  const parsedDate = new Date(timestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    throw invalidContract();
  }

  const normalizedMedia = media === null ? null : recordValue(media);

  if (type === "texto") {
    if (
      typeof content !== "string" ||
      content.length < 1 ||
      content.length > 4_000
    ) {
      throw invalidContract();
    }
  } else if (content !== null || !normalizedMedia) {
    throw invalidContract();
  }

  return {
    provider: "evolution",
    instance: event.instance,
    message: {
      mensaje_origen_id: originId,
      numero_whatsapp: phone,
      tipo: type,
      contenido: type === "texto" ? content : null,
      media: normalizedMedia,
      timestamp: parsedDate.toISOString(),
    },
  };
}
