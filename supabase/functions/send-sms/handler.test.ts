import { assertEquals, assertStringIncludes } from "@std/assert";
import { createSendSmsHandler } from "./handler.ts";

const validPayload = {
  user: { phone: "+573001234567" },
  sms: { otp: "123456" },
};
const stableFingerprint = "a".repeat(64);
const stableLeaseToken = "11111111-1111-4111-8111-111111111111";

function signedRequest(
  body = JSON.stringify(validPayload),
  webhookId = "msg_test",
) {
  return new Request("http://localhost/functions/v1/send-sms", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": webhookId,
      "webhook-signature": "v1,test",
      "webhook-timestamp": "1710000000",
    },
    body,
  });
}

function verifySignedPayload(payload: string, headers: Headers) {
  if (
    !headers.get("webhook-id") ||
    !headers.get("webhook-signature") ||
    !headers.get("webhook-timestamp")
  ) {
    throw new Error("invalid signature");
  }

  return JSON.parse(payload);
}

type Dependencies = Parameters<typeof createSendSmsHandler>[0];

function dependencies(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    claimDelivery: () => Promise.resolve({
      status: "claimed" as const,
      leaseToken: stableLeaseToken,
    }),
    completeDelivery: () => Promise.resolve(),
    fingerprintDelivery: () => Promise.resolve(stableFingerprint),
    isAmbiguousDeliveryError: () => false,
    releaseDelivery: () => Promise.resolve(),
    sendText: () => Promise.resolve(),
    verify: verifySignedPayload,
    ...overrides,
  };
}

Deno.test("Send SMS rejects requests without a valid Standard Webhook", async () => {
  const handler = createSendSmsHandler(dependencies());
  const response = await handler(
    new Request("http://localhost/functions/v1/send-sms", {
      method: "POST",
      body: JSON.stringify(validPayload),
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(await response.text(), "Solicitud no autorizada.");
});

Deno.test("Send SMS rejects invalid hook payloads", async () => {
  let calls = 0;
  const handler = createSendSmsHandler(dependencies({
    sendText: () => {
      calls += 1;
      return Promise.resolve();
    },
  }));
  const response = await handler(
    signedRequest(JSON.stringify({
      user: { phone: "3001234567" },
      sms: { otp: "not-an-otp" },
    })),
  );

  assertEquals(response.status, 400);
  assertEquals(calls, 0);
});

Deno.test("Send SMS delivers and completes a stable event fingerprint", async () => {
  const sent: Array<{ phone: string; text: string }> = [];
  const claimed: unknown[] = [];
  const completed: unknown[] = [];
  const handler = createSendSmsHandler(dependencies({
    claimDelivery: (delivery) => {
      claimed.push(delivery);
      return Promise.resolve({
        status: "claimed" as const,
        leaseToken: stableLeaseToken,
      });
    },
    completeDelivery: (fingerprint, leaseToken, outcome) => {
      completed.push({ fingerprint, leaseToken, outcome });
      return Promise.resolve();
    },
    sendText: (message) => {
      sent.push(message);
      return Promise.resolve();
    },
  }));
  const response = await handler(signedRequest());

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "application/json");
  assertEquals(await response.json(), {});
  assertEquals(claimed, [{
    fingerprint: stableFingerprint,
    webhookId: "msg_test",
  }]);
    assertEquals(completed, [{
      fingerprint: stableFingerprint,
      leaseToken: stableLeaseToken,
      outcome: "delivered",
  }]);
  assertEquals(sent, [
    {
      phone: "+573001234567",
      text: "Tu codigo de Moni es 123456. Expira pronto. No lo compartas.",
    },
  ]);
});

Deno.test("Send SMS normalizes Supabase digit-only phones to E.164", async () => {
  const sent: Array<{ phone: string; text: string }> = [];
  const handler = createSendSmsHandler(dependencies({
    sendText: (message) => {
      sent.push(message);
      return Promise.resolve();
    },
  }));
  const response = await handler(signedRequest(JSON.stringify({
    user: { phone: "573001234567" },
    sms: { otp: "123456" },
  })));

  assertEquals(response.status, 200);
  assertEquals(sent[0]?.phone, "+573001234567");
});

Deno.test("Send SMS releases definitive provider rejections", async () => {
  const released: string[] = [];
  const handler = createSendSmsHandler(dependencies({
    releaseDelivery: (fingerprint, leaseToken) => {
      released.push(`${fingerprint}:${leaseToken}`);
      return Promise.resolve();
    },
    sendText: () => Promise.reject(new Error("provider private detail")),
  }));
  const response = await handler(signedRequest());
  const body = await response.text();

  assertEquals(response.status, 502);
  assertEquals(body, "No pudimos entregar el codigo.");
  assertEquals(body.includes("123456"), false);
  assertEquals(body.includes("+573001234567"), false);
  assertEquals(released, [
    `${stableFingerprint}:11111111-1111-4111-8111-111111111111`,
  ]);
});

Deno.test("Send SMS finalizes ambiguous provider outcomes without releasing", async () => {
  const completed: unknown[] = [];
  let releases = 0;
  const ambiguousError = new Error("timeout after provider accepted");
  const handler = createSendSmsHandler(dependencies({
    completeDelivery: (fingerprint, leaseToken, outcome) => {
      completed.push({ fingerprint, leaseToken, outcome });
      return Promise.resolve();
    },
    isAmbiguousDeliveryError: (error) => error === ambiguousError,
    releaseDelivery: () => {
      releases += 1;
      return Promise.resolve();
    },
    sendText: () => Promise.reject(ambiguousError),
  }));

  const response = await handler(signedRequest());

  assertEquals(response.status, 502);
  assertEquals(completed, [{
    fingerprint: stableFingerprint,
      leaseToken: stableLeaseToken,
      outcome: "indeterminate",
  }]);
  assertEquals(releases, 0);
});

Deno.test("Send SMS deduplicates retry IDs by stable event fingerprint", async () => {
  const claimed: unknown[] = [];
  let sends = 0;
  const handler = createSendSmsHandler(dependencies({
    claimDelivery: (delivery) => {
      claimed.push(delivery);
      return Promise.resolve({ status: "completed", leaseToken: null });
    },
    sendText: () => {
      sends += 1;
      return Promise.resolve();
    },
  }));

  const first = await handler(signedRequest(undefined, "msg_retry_1"));
  const second = await handler(signedRequest(undefined, "msg_retry_2"));

  assertEquals(first.status, 200);
  assertEquals(second.status, 200);
  assertEquals(claimed, [
    { fingerprint: stableFingerprint, webhookId: "msg_retry_1" },
    { fingerprint: stableFingerprint, webhookId: "msg_retry_2" },
  ]);
  assertEquals(sends, 0);
});

Deno.test("Send SMS asks Supabase to retry while a delivery lease is busy", async () => {
  const handler = createSendSmsHandler(dependencies({
    claimDelivery: () => Promise.resolve({ status: "busy", leaseToken: null }),
  }));

  const response = await handler(signedRequest());

  assertEquals(response.status, 503);
  assertEquals(response.headers.get("retry-after"), "2");
});

Deno.test("Send SMS rejects non-POST and oversized requests", async () => {
  const handler = createSendSmsHandler(dependencies());

  const methodResponse = await handler(
    new Request("http://localhost/functions/v1/send-sms"),
  );
  assertEquals(methodResponse.status, 405);
  assertEquals(methodResponse.headers.get("allow"), "POST");

  const largeResponse = await handler(signedRequest("x".repeat(32769)));
  assertEquals(largeResponse.status, 413);
  assertStringIncludes(await largeResponse.text(), "demasiado grande");

  const declaredLargeResponse = await handler(
    new Request("http://localhost/functions/v1/send-sms", {
      method: "POST",
      headers: { "content-length": "32769" },
      body: "",
    }),
  );
  assertEquals(declaredLargeResponse.status, 413);

  let pulls = 0;
  const fragmentedBody = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;

      if (pulls === 1) {
        controller.enqueue(new Uint8Array(32_769));
        return;
      }

      throw new Error("the handler read beyond its body limit");
    },
  });
  const fragmentedResponse = await handler(
    new Request("http://localhost/functions/v1/send-sms", {
      method: "POST",
      body: fragmentedBody,
    }),
  );
  assertEquals(fragmentedResponse.status, 413);
  assertEquals(pulls, 1);
});
