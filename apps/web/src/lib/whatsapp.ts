import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const phonePattern = /^\+[1-9][0-9]{7,14}$/;

export const incomingMessageSchema = z.object({
  mensaje_origen_id: z.string().trim().min(1).max(200),
  numero_whatsapp: z.string().regex(phonePattern),
  tipo: z.enum(["texto", "imagen"]),
  contenido: z.string().max(4000).default(""),
  media: z.string().max(1000).nullable().default(null),
  timestamp: z.string().datetime({ offset: true }),
});

export type IncomingMessage = z.infer<typeof incomingMessageSchema>;

export function normalizeEvolutionPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return { kind: "invalid" as const };
  const input = payload as { event?: unknown; instance?: unknown; data?: unknown };
  if (input.event !== "messages.upsert" && input.event !== "MESSAGES_UPSERT") return { kind: "ignored" as const };
  if (!input.instance || !input.data || typeof input.data !== "object") return { kind: "invalid" as const };
  const data = input.data as { key?: unknown; message?: unknown; messageTimestamp?: unknown; sender?: unknown };
  const key = data.key as { id?: unknown; remoteJid?: unknown; remoteJidAlt?: unknown; fromMe?: unknown } | undefined;
  const message = data.message as Record<string, unknown> | undefined;
  const remoteJid = typeof key?.remoteJid === "string" ? key.remoteJid : "";
  const alternateJid = typeof key?.remoteJidAlt === "string" ? key.remoteJidAlt : "";
  const senderJid = typeof data.sender === "string" ? data.sender : "";
  const contactJid = remoteJid.endsWith("@lid") ? alternateJid || senderJid : remoteJid;
  const number = contactJid.replace(/@(s\.whatsapp\.net|c\.us)$/, "");
  if (key?.fromMe === true || !key?.id || (!/^\+[1-9][0-9]{7,14}$/.test(`+${number}`) && !remoteJid.endsWith("@lid"))) return { kind: "ignored" as const };
  const content = typeof message?.conversation === "string"
    ? message.conversation
    : typeof (message?.extendedTextMessage as { text?: unknown } | undefined)?.text === "string"
      ? (message?.extendedTextMessage as { text: string }).text
      : typeof (message?.buttonsResponseMessage as { selectedButtonId?: unknown; selectedDisplayText?: unknown } | undefined)?.selectedButtonId === "string"
        ? (message?.buttonsResponseMessage as { selectedButtonId: string }).selectedButtonId
      : "";
  const image = typeof message?.imageMessage === "object" && message.imageMessage !== null;
  const imageData = message?.imageMessage as { url?: unknown } | undefined;
  const timestamp = typeof data.messageTimestamp === "number"
    ? new Date(data.messageTimestamp * 1000).toISOString()
    : new Date().toISOString();
  const baseMessage: Omit<IncomingMessage, "numero_whatsapp"> = { mensaje_origen_id: String(key.id), tipo: image ? "imagen" : "texto", contenido: content, media: typeof imageData?.url === "string" ? imageData.url : null, timestamp };
  if (remoteJid.endsWith("@lid") && !/^\+[1-9][0-9]{7,14}$/.test(`+${number}`)) {
    return { kind: "lid" as const, instance: String(input.instance), lid: remoteJid, message: baseMessage };
  }
  return { kind: "message" as const, instance: String(input.instance), message: {
    ...baseMessage, numero_whatsapp: `+${number}`,
  } satisfies IncomingMessage };
}

export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const received = Buffer.from(signature.slice("sha256=".length), "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function verifyWebhookSecretHeader(received: string | null, secret: string) {
  return received === secret;
}
