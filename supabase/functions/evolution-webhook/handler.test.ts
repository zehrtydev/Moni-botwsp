import { assertEquals, assertStringIncludes } from "@std/assert";
import { createEvolutionWebhookHandler } from "./handler.ts";

const validPayload = {
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
};

function signedRequest(body = JSON.stringify(validPayload)) {
  return new Request("http://localhost/functions/v1/evolution-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-moni-timestamp": "1750000000",
      "x-moni-signature": "v1=test",
    },
    body,
  });
}

function verifySignedPayload(payload: string, headers: Headers) {
  if (!headers.get("x-moni-timestamp") || !headers.get("x-moni-signature")) {
    throw new Error("invalid signature");
  }

  return JSON.parse(payload);
}

type Dependencies = Parameters<typeof createEvolutionWebhookHandler>[0];

function dependencies(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    persistMessage: () => Promise.resolve("inserted"),
    verify: verifySignedPayload,
    ...overrides,
  };
}

Deno.test("Evolution webhook stores a normalized message and returns 202", async () => {
  const stored: unknown[] = [];
  const handler = createEvolutionWebhookHandler(dependencies({
    persistMessage: (message: Parameters<Dependencies["persistMessage"]>[0]) => {
      stored.push(message);
      return Promise.resolve("inserted");
    },
  }));

  const response = await handler(signedRequest());

  assertEquals(response.status, 202);
  assertEquals(stored, [{
    proveedor: "evolution",
    instancia: "moni",
    mensaje_origen_id: "evo-1",
    numero_whatsapp: "+573001234567",
    tipo: "texto",
    recibido_en: "2026-07-16T12:00:00.000Z",
  }]);
});

Deno.test("Evolution webhook acknowledges an idempotent duplicate", async () => {
  const handler = createEvolutionWebhookHandler(dependencies({
    persistMessage: () => Promise.resolve("duplicate"),
  }));

  const response = await handler(signedRequest());

  assertEquals(response.status, 200);
});

Deno.test("Evolution webhook rejects invalid auth, payload, method, and body size", async () => {
  const handler = createEvolutionWebhookHandler(dependencies());
  const missingAuth = await handler(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(validPayload),
  }));
  assertEquals(missingAuth.status, 401);

  const invalidPayload = await handler(signedRequest(JSON.stringify({
    ...validPayload,
    message: { ...validPayload.message, tipo: "audio" },
  })));
  assertEquals(invalidPayload.status, 400);

  const method = await handler(new Request("http://localhost"));
  assertEquals(method.status, 405);

  const oversized = await handler(new Request("http://localhost", {
    method: "POST",
    headers: { "content-length": "65537" },
    body: "",
  }));
  assertEquals(oversized.status, 413);
  assertStringIncludes(await oversized.text(), "demasiado grande");
});

Deno.test("Evolution webhook hides persistence errors", async () => {
  const handler = createEvolutionWebhookHandler(dependencies({
    persistMessage: () => Promise.reject(new Error("database private detail")),
  }));

  const response = await handler(signedRequest());

  assertEquals(response.status, 503);
  assertEquals(await response.text(), "No pudimos procesar el mensaje.");
});
