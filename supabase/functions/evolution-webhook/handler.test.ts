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
    claimReply: () =>
      Promise.resolve({
        state: "claimed",
        leaseToken: "00000000-0000-4000-8000-000000000002",
        reply: "Registré: $20000 COP",
      }),
    completeReply: () => Promise.resolve(),
    expectedInstance: "moni",
    isAmbiguousDeliveryError: () => false,
    isRejectedDeliveryError: () => false,
    persistMessage: () => Promise.resolve("inserted"),
    processText: () =>
      Promise.resolve({
        inboxId: "00000000-0000-0000-0000-000000000001",
      }),
    releaseReply: () => Promise.resolve(),
    sendText: () => Promise.resolve(),
    verify: verifySignedPayload,
    ...overrides,
  };
}

Deno.test("Evolution webhook stores a normalized message and returns 202", async () => {
  const stored: unknown[] = [];
  const processed: unknown[] = [];
  const claimed: unknown[] = [];
  const sent: unknown[] = [];
  const completed: unknown[] = [];
  const handler = createEvolutionWebhookHandler(dependencies({
    claimReply: (inboxId) => {
      claimed.push(inboxId);
      return Promise.resolve({
        state: "claimed",
        leaseToken: "00000000-0000-4000-8000-000000000002",
        reply: "Registré: $20000 COP",
      });
    },
    completeReply: (inboxId, leaseToken, outcome) => {
      completed.push({ inboxId, leaseToken, outcome });
      return Promise.resolve();
    },
    persistMessage: (
      message: Parameters<Dependencies["persistMessage"]>[0],
    ) => {
      stored.push(message);
      return Promise.resolve("inserted");
    },
    processText: (instance, message, extraction) => {
      processed.push({ instance, message, extraction });
      return Promise.resolve({
        inboxId: "00000000-0000-0000-0000-000000000001",
      });
    },
    sendText: (message) => {
      sent.push(message);
      return Promise.resolve();
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
  assertEquals(processed, [{
    instance: "moni",
    message: validPayload.message,
    extraction: {
      monto: 20000,
      fecha_gasto: "2026-07-16",
      categoria: "Alimentación",
      descripcion: "Almuerzo",
      metodo_pago: null,
      confianza: 0.9,
    },
  }]);
  assertEquals(sent, [{
    phone: "+573001234567",
    text: "Registré: $20000 COP",
  }]);
  assertEquals(claimed, ["00000000-0000-0000-0000-000000000001"]);
  assertEquals(completed, [{
    inboxId: "00000000-0000-0000-0000-000000000001",
    leaseToken: "00000000-0000-4000-8000-000000000002",
    outcome: "delivered",
  }]);
});

Deno.test("Evolution webhook acknowledges an idempotent duplicate", async () => {
  let sent = false;
  const handler = createEvolutionWebhookHandler(dependencies({
    persistMessage: () => Promise.resolve("duplicate"),
    claimReply: () => Promise.resolve({ state: "busy" }),
    processText: () =>
      Promise.resolve({
        inboxId: "00000000-0000-0000-0000-000000000001",
      }),
    sendText: () => {
      sent = true;
      return Promise.resolve();
    },
  }));

  const response = await handler(signedRequest());

  assertEquals(response.status, 200);
  assertEquals(sent, false);
});

Deno.test("Evolution webhook atomically claims concurrent duplicate replies", async () => {
  let claims = 0;
  let sends = 0;
  const handler = createEvolutionWebhookHandler(dependencies({
    claimReply: () => {
      claims += 1;
      return Promise.resolve(
        claims === 1
          ? {
            state: "claimed" as const,
            leaseToken: "00000000-0000-4000-8000-000000000002",
            reply: "Registré: $20000 COP",
          }
          : { state: "busy" as const },
      );
    },
    persistMessage: () => Promise.resolve("duplicate"),
    sendText: () => {
      sends += 1;
      return Promise.resolve();
    },
  }));

  const responses = await Promise.all([
    handler(signedRequest()),
    handler(signedRequest()),
  ]);

  assertEquals(responses.map((response) => response.status), [200, 200]);
  assertEquals(sends, 1);
});

Deno.test("Evolution webhook does not resend after a post-delivery finalize failure", async () => {
  let claims = 0;
  let sends = 0;
  const handler = createEvolutionWebhookHandler(dependencies({
    claimReply: () => {
      claims += 1;
      return Promise.resolve(
        claims === 1
          ? {
            state: "claimed" as const,
            leaseToken: "00000000-0000-4000-8000-000000000002",
            reply: "Registré: $20000 COP",
          }
          : { state: "busy" as const },
      );
    },
    completeReply: () => Promise.reject(new Error("database unavailable")),
    persistMessage: () => Promise.resolve("duplicate"),
    sendText: () => {
      sends += 1;
      return Promise.resolve();
    },
  }));

  const first = await handler(signedRequest());
  const retry = await handler(signedRequest());

  assertEquals(first.status, 503);
  assertEquals(retry.status, 200);
  assertEquals(sends, 1);
});

Deno.test("Evolution webhook finalizes ambiguous delivery without retrying", async () => {
  const completed: unknown[] = [];
  const ambiguous = new Error("timeout");
  const handler = createEvolutionWebhookHandler(dependencies({
    completeReply: (inboxId, leaseToken, outcome) => {
      completed.push({ inboxId, leaseToken, outcome });
      return Promise.resolve();
    },
    isAmbiguousDeliveryError: (error) => error === ambiguous,
    sendText: () => Promise.reject(ambiguous),
  }));

  const response = await handler(signedRequest());

  assertEquals(response.status, 202);
  assertEquals(completed, [{
    inboxId: "00000000-0000-0000-0000-000000000001",
    leaseToken: "00000000-0000-4000-8000-000000000002",
    outcome: "unknown",
  }]);
});

Deno.test("Evolution webhook finalizes a permanent rejection without retrying", async () => {
  const completed: unknown[] = [];
  let released = false;
  const rejected = new Error("rejected");
  const handler = createEvolutionWebhookHandler(dependencies({
    completeReply: (inboxId, leaseToken, outcome) => {
      completed.push({ inboxId, leaseToken, outcome });
      return Promise.resolve();
    },
    isRejectedDeliveryError: (error) => error === rejected,
    releaseReply: () => {
      released = true;
      return Promise.resolve();
    },
    sendText: () => Promise.reject(rejected),
  }));

  const response = await handler(signedRequest());

  assertEquals(response.status, 202);
  assertEquals(completed, [{
    inboxId: "00000000-0000-0000-0000-000000000001",
    leaseToken: "00000000-0000-4000-8000-000000000002",
    outcome: "rejected",
  }]);
  assertEquals(released, false);
});

Deno.test("Evolution webhook releases a retryable delivery failure", async () => {
  const released: unknown[] = [];
  let completed = false;
  const handler = createEvolutionWebhookHandler(dependencies({
    completeReply: () => {
      completed = true;
      return Promise.resolve();
    },
    releaseReply: (inboxId, leaseToken) => {
      released.push({ inboxId, leaseToken });
      return Promise.resolve();
    },
    sendText: () => Promise.reject(new Error("retryable")),
  }));

  const response = await handler(signedRequest());

  assertEquals(response.status, 503);
  assertEquals(completed, false);
  assertEquals(released, [{
    inboxId: "00000000-0000-0000-0000-000000000001",
    leaseToken: "00000000-0000-4000-8000-000000000002",
  }]);
});

Deno.test("Evolution webhook rejects invalid auth, payload, method, and body size", async () => {
  const handler = createEvolutionWebhookHandler(dependencies());
  const missingAuth = await handler(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(validPayload),
    }),
  );
  assertEquals(missingAuth.status, 401);

  const invalidPayload = await handler(signedRequest(JSON.stringify({
    ...validPayload,
    message: { ...validPayload.message, tipo: "audio" },
  })));
  assertEquals(invalidPayload.status, 400);

  const method = await handler(new Request("http://localhost"));
  assertEquals(method.status, 405);

  const oversized = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-length": "65537" },
      body: "",
    }),
  );
  assertEquals(oversized.status, 413);
  assertStringIncludes(await oversized.text(), "demasiado grande");
});

Deno.test("Evolution webhook rejects a signed event from another instance", async () => {
  let persisted = false;
  const handler = createEvolutionWebhookHandler(dependencies({
    persistMessage: () => {
      persisted = true;
      return Promise.resolve("inserted");
    },
  }));
  const otherInstance = await handler(signedRequest(JSON.stringify({
    ...validPayload,
    instance: "personal",
  })));

  assertEquals(otherInstance.status, 403);
  assertEquals(persisted, false);
});

Deno.test("Evolution webhook hides persistence errors", async () => {
  const handler = createEvolutionWebhookHandler(dependencies({
    persistMessage: () => Promise.reject(new Error("database private detail")),
  }));

  const response = await handler(signedRequest());

  assertEquals(response.status, 503);
  assertEquals(await response.text(), "No pudimos procesar el mensaje.");
});
