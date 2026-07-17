import { assertEquals, assertStringIncludes } from "@std/assert";
import { createSendSmsHandler } from "./handler.ts";

const validPayload = {
  user: { phone: "+573001234567" },
  sms: { otp: "123456" },
};

function signedRequest(body = JSON.stringify(validPayload)) {
  return new Request("http://localhost/functions/v1/send-sms", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": "msg_test",
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

Deno.test("Send SMS rejects requests without a valid Standard Webhook", async () => {
  const handler = createSendSmsHandler({
    claimDelivery: () => Promise.resolve(true),
    releaseDelivery: () => Promise.resolve(),
    sendText: () => Promise.resolve(),
    verify: verifySignedPayload,
  });
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
  const handler = createSendSmsHandler({
    claimDelivery: () => Promise.resolve(true),
    releaseDelivery: () => Promise.resolve(),
    sendText: () => {
      calls += 1;
      return Promise.resolve();
    },
    verify: verifySignedPayload,
  });
  const response = await handler(
    signedRequest(JSON.stringify({
      user: { phone: "3001234567" },
      sms: { otp: "not-an-otp" },
    })),
  );

  assertEquals(response.status, 400);
  assertEquals(calls, 0);
});

Deno.test("Send SMS delivers the Supabase OTP through Evolution", async () => {
  const sent: Array<{ phone: string; text: string }> = [];
  const handler = createSendSmsHandler({
    claimDelivery: () => Promise.resolve(true),
    releaseDelivery: () => Promise.resolve(),
    sendText: (message) => {
      sent.push(message);
      return Promise.resolve();
    },
    verify: verifySignedPayload,
  });
  const response = await handler(signedRequest());

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "");
  assertEquals(sent, [
    {
      phone: "+573001234567",
      text: "Tu codigo de Moni es 123456. Expira pronto. No lo compartas.",
    },
  ]);
});

Deno.test("Send SMS hides Evolution and OTP details on delivery failure", async () => {
  const released: string[] = [];
  const handler = createSendSmsHandler({
    claimDelivery: () => Promise.resolve(true),
    releaseDelivery: (webhookId) => {
      released.push(webhookId);
      return Promise.resolve();
    },
    sendText: () => Promise.reject(new Error("provider private detail")),
    verify: verifySignedPayload,
  });
  const response = await handler(signedRequest());
  const body = await response.text();

  assertEquals(response.status, 502);
  assertEquals(body, "No pudimos entregar el codigo.");
  assertEquals(body.includes("123456"), false);
  assertEquals(body.includes("+573001234567"), false);
  assertEquals(released, ["msg_test"]);
});

Deno.test("Send SMS acknowledges duplicate webhook IDs without resending", async () => {
  const claimed: string[] = [];
  let sends = 0;
  const handler = createSendSmsHandler({
    claimDelivery: (webhookId) => {
      claimed.push(webhookId);
      return Promise.resolve(false);
    },
    releaseDelivery: () => Promise.resolve(),
    sendText: () => {
      sends += 1;
      return Promise.resolve();
    },
    verify: verifySignedPayload,
  });

  const response = await handler(signedRequest());

  assertEquals(response.status, 200);
  assertEquals(claimed, ["msg_test"]);
  assertEquals(sends, 0);
});

Deno.test("Send SMS rejects non-POST and oversized requests", async () => {
  const handler = createSendSmsHandler({
    claimDelivery: () => Promise.resolve(true),
    releaseDelivery: () => Promise.resolve(),
    sendText: () => Promise.resolve(),
    verify: verifySignedPayload,
  });

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
