import { assertEquals, assertThrows } from "@std/assert";
import { parseInboundRelayPayload } from "./inbound-contract.ts";

const valid = {
  provider: "evolution",
  instance: "moni",
  message: {
    mensaje_origen_id: "evo-1",
    numero_whatsapp: "+573001234567",
    tipo: "texto",
    contenido: "Almuerzo 20000",
    media: null,
    timestamp: "2026-07-16T12:00:00.000Z",
  },
} as const;

Deno.test("Inbound relay contract normalizes a valid text message", () => {
  assertEquals(parseInboundRelayPayload(valid), valid);
});

Deno.test("Inbound relay contract permits image metadata without persisting it", () => {
  const parsed = parseInboundRelayPayload({
    ...valid,
    message: {
      ...valid.message,
      tipo: "imagen",
      contenido: null,
      media: { mime_type: "image/jpeg", storage_key: "private/key" },
    },
  });

  assertEquals(parsed?.message.tipo, "imagen");
  assertEquals(parsed?.message.contenido, null);
});

Deno.test("Inbound relay contract rejects forged or malformed messages", () => {
  assertThrows(() => parseInboundRelayPayload({
    ...valid,
    provider: "otro",
  }));
  assertThrows(() => parseInboundRelayPayload({
    ...valid,
    message: { ...valid.message, numero_whatsapp: "3001234567" },
  }));
  assertThrows(() => parseInboundRelayPayload({
    ...valid,
    message: { ...valid.message, tipo: "audio" },
  }));
  assertThrows(() => parseInboundRelayPayload({
    ...valid,
    message: { ...valid.message, contenido: "x".repeat(4_001) },
  }));
});
