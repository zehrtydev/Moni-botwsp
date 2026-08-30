import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { incomingMessageSchema, normalizeEvolutionPayload, verifyWebhookSecretHeader, verifyWebhookSignature } from "./whatsapp";

describe("WhatsApp webhook contract", () => {
  it("verifies the HMAC signature over the raw body", () => {
    const body = '{"mensaje_origen_id":"m-1"}';
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    expect(verifyWebhookSignature(body, signature, "secret")).toBe(true);
    expect(verifyWebhookSignature(body, signature, "wrong-secret")).toBe(false);
  });

  it("rejects an untrusted or malformed phone number", () => {
    const result = incomingMessageSchema.safeParse({
      mensaje_origen_id: "m-1", numero_whatsapp: "3001234567", tipo: "texto",
      contenido: "Gasté 20 mil", timestamp: "2026-08-29T12:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the configured Evolution custom header", () => {
    expect(verifyWebhookSecretHeader("secret", "secret")).toBe(true);
    expect(verifyWebhookSecretHeader("wrong", "secret")).toBe(false);
  });

  it("normalizes an Evolution messages.upsert text payload", () => {
    const result = normalizeEvolutionPayload({
      event: "messages.upsert", instance: "moni-local",
      data: { key: { id: "msg-1", remoteJid: "573001234567@s.whatsapp.net", fromMe: false },
        message: { extendedTextMessage: { text: "Gasté 20 mil" } }, messageTimestamp: 1_756_500_000 },
    });
    expect(result.kind).toBe("message");
    if (result.kind === "message") expect(result.message).toMatchObject({ numero_whatsapp: "+573001234567", contenido: "Gasté 20 mil" });
  });

  it("keeps a LID payload for local contact resolution when no alternate JID exists", () => {
    const result = normalizeEvolutionPayload({
      event: "messages.upsert", instance: "moni-local",
      data: { key: { id: "msg-lid", remoteJid: "51629868974162@lid", fromMe: false },
        message: { conversation: "Gaste 20mil en gasolina" }, messageTimestamp: 1_756_500_000 },
    });
    expect(result).toMatchObject({ kind: "lid", lid: "51629868974162@lid" });
  });

  it("does not use Evolution top-level sender as the contact number", () => {
    const result = normalizeEvolutionPayload({
      event: "messages.upsert", instance: "moni-local",
      sender: "573001234567@s.whatsapp.net",
      data: { key: { id: "msg-lid-sender", remoteJid: "51629868974162@lid", fromMe: false },
        message: { conversation: "Hola" }, messageTimestamp: 1_756_500_000 },
    });
    expect(result.kind).toBe("lid");
  });

  it("does not use a sender nested in the LID payload as the contact number", () => {
    const result = normalizeEvolutionPayload({
      event: "messages.upsert", instance: "moni-local",
      data: { sender: "573001234567@s.whatsapp.net", key: { id: "msg-lid-nested-sender", remoteJid: "51629868974162@lid", fromMe: false },
        message: { conversation: "MONI-ABC123" }, messageTimestamp: 1_756_500_000 },
    });
    expect(result.kind).toBe("lid");
  });

  it("normalizes an incoming image as an incomplete message", () => {
    const result = normalizeEvolutionPayload({
      event: "messages.upsert", instance: "moni-local",
      data: { key: { id: "image-1", remoteJid: "573001234567@s.whatsapp.net", fromMe: false },
        message: { imageMessage: { url: "https://example.test/receipt.jpg" } }, messageTimestamp: 1_756_500_000 },
    });
    expect(result.kind).toBe("message");
    if (result.kind === "message") expect(result.message).toMatchObject({ tipo: "imagen", media: "https://example.test/receipt.jpg" });
  });

  it("normalizes a clicked button as its stable button id", () => {
    const result = normalizeEvolutionPayload({
      event: "messages.upsert", instance: "moni-local",
      data: { key: { id: "button-1", remoteJid: "573001234567@s.whatsapp.net", fromMe: false },
        message: { buttonsResponseMessage: { selectedButtonId: "confirm_expense", selectedDisplayText: "✅ Sí, guardar" } }, messageTimestamp: 1_756_500_000 },
    });
    expect(result.kind).toBe("message");
    if (result.kind === "message") expect(result.message.contenido).toBe("confirm_expense");
  });
});
