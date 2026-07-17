import assert from "node:assert/strict";
import test from "node:test";
import { toInboundRelayEvent } from "../src/evolution-event.js";

const event = {
  event: "messages.upsert",
  instance: "moni",
  data: {
    key: {
      remoteJid: "573001234567@s.whatsapp.net",
      fromMe: false,
      id: "ABC123",
    },
    message: { conversation: "Almuerzo 20000" },
    messageType: "conversation",
    messageTimestamp: 1_752_758_400,
  },
};

test("normaliza un mensaje de texto entrante de Evolution", () => {
  assert.deepEqual(toInboundRelayEvent(event), {
    provider: "evolution",
    instance: "moni",
    message: {
      mensaje_origen_id: "ABC123",
      numero_whatsapp: "+573001234567",
      tipo: "texto",
      contenido: "Almuerzo 20000",
      media: null,
      timestamp: "2025-07-17T13:20:00.000Z",
    },
  });
});

test("usa remoteJidAlt cuando Evolution entrega un identificador LID", () => {
  const normalized = toInboundRelayEvent({
    ...event,
    data: {
      ...event.data,
      key: {
        ...event.data.key,
        remoteJid: "123456789@lid",
        remoteJidAlt: "573001234567@s.whatsapp.net",
      },
    },
  });

  assert.equal(normalized.message.numero_whatsapp, "+573001234567");
});

test("extrae texto de mensajes temporales", () => {
  const normalized = toInboundRelayEvent({
    ...event,
    data: {
      ...event.data,
      message: {
        ephemeralMessage: {
          message: { extendedTextMessage: { text: "Cena 18000" } },
        },
      },
    },
  });

  assert.equal(normalized.message.contenido, "Cena 18000");
});

test("ignora mensajes propios, grupos y eventos distintos", () => {
  assert.equal(toInboundRelayEvent({ ...event, event: "send.message" }), null);
  assert.equal(toInboundRelayEvent({
    ...event,
    data: { ...event.data, key: { ...event.data.key, fromMe: true } },
  }), null);
  assert.equal(toInboundRelayEvent({
    ...event,
    data: {
      ...event.data,
      key: { ...event.data.key, remoteJid: "120363@g.us" },
    },
  }), null);
});

test("rechaza identificadores, telefonos y contenido invalidos", () => {
  assert.throws(() => toInboundRelayEvent({
    ...event,
    data: { ...event.data, key: { ...event.data.key, id: "" } },
  }));
  assert.throws(() => toInboundRelayEvent({
    ...event,
    data: {
      ...event.data,
      key: { ...event.data.key, remoteJid: "usuario@lid" },
    },
  }));
  assert.throws(() => toInboundRelayEvent({
    ...event,
    data: { ...event.data, message: { conversation: "" } },
  }));
  assert.throws(() => toInboundRelayEvent({
    ...event,
    data: { ...event.data, messageTimestamp: "1e9" },
  }));
  assert.throws(() => toInboundRelayEvent({
    ...event,
    data: { ...event.data, messageTimestamp: -1 },
  }));
});
