const printablePattern = /^[\x21-\x7e]+$/;
const directJidPattern = /^([1-9][0-9]{7,14})@s\.whatsapp\.net$/;

function invalidEvent() {
  return new Error("El evento de Evolution no es valido.");
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function textContent(message, depth = 0) {
  if (!message || depth > 3) return undefined;

  if (typeof message.conversation === "string") {
    return message.conversation;
  }

  const extended = record(message.extendedTextMessage);
  if (typeof extended?.text === "string") return extended.text;

  for (const wrapper of ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2"]) {
    const wrapped = record(message[wrapper]);
    const nested = record(wrapped?.message);
    const content = textContent(nested, depth + 1);
    if (content !== undefined) return content;
  }

  return undefined;
}

function unixSeconds(value) {
  if (
    typeof value === "string" &&
    !/^[1-9][0-9]{9,11}$/.test(value)
  ) {
    throw invalidEvent();
  }

  const seconds = typeof value === "string" ? Number(value) : value;

  if (!Number.isSafeInteger(seconds) || seconds < 1_000_000_000) {
    throw invalidEvent();
  }

  return seconds;
}

export function toInboundRelayEvent(value) {
  const event = record(value);

  if (!event || event.event !== "messages.upsert") {
    return null;
  }

  const data = record(event.data);
  const key = record(data?.key);

  if (key?.fromMe === true) {
    return null;
  }

  const remoteJid = key?.remoteJid;

  if (typeof remoteJid === "string" && remoteJid.endsWith("@g.us")) {
    return null;
  }

  const directJid = typeof remoteJid === "string"
    ? remoteJid.match(directJidPattern)
    : null;
  const alternativeJid = typeof key?.remoteJidAlt === "string"
    ? key.remoteJidAlt.match(directJidPattern)
    : null;
  const jid = directJid ?? alternativeJid;
  const message = record(data?.message);
  const content = textContent(message);
  const originId = key?.id;
  const instance = event.instance;
  const timestamp = data?.messageTimestamp;

  if (
    !jid ||
    typeof originId !== "string" ||
    originId.length > 255 ||
    !printablePattern.test(originId) ||
    typeof instance !== "string" ||
    instance.length > 128 ||
    !printablePattern.test(instance) ||
    typeof content !== "string" ||
    content.length < 1 ||
    content.length > 4_000 ||
    (typeof timestamp !== "number" && typeof timestamp !== "string")
  ) {
    throw invalidEvent();
  }

  const timestampNumber = unixSeconds(timestamp);
  const receivedAt = new Date(timestampNumber * 1_000);

  if (!Number.isSafeInteger(timestampNumber) || Number.isNaN(receivedAt.getTime())) {
    throw invalidEvent();
  }

  return {
    provider: "evolution",
    instance,
    message: {
      mensaje_origen_id: originId,
      numero_whatsapp: `+${jid[1]}`,
      tipo: "texto",
      contenido: content,
      media: null,
      timestamp: receivedAt.toISOString(),
    },
  };
}
