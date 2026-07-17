import { assertEquals, assertThrows } from "@std/assert";
import { Webhook } from "standardwebhooks";
import { createStandardWebhookVerifier } from "./standard-webhook.ts";

const rawSecret = btoa(["test", "hook", "secret"].join("-"));
const configuredSecret = `v1,whsec_${rawSecret}`;
const payload = JSON.stringify({ sms: { otp: "123456" } });

function signedHeaders(date: Date, signedPayload = payload) {
  const id = "msg_test";
  const webhook = new Webhook(rawSecret);

  return new Headers({
    "webhook-id": id,
    "webhook-signature": webhook.sign(id, date, signedPayload),
    "webhook-timestamp": String(Math.floor(date.getTime() / 1_000)),
  });
}

Deno.test("Standard Webhook verifier accepts a current valid signature", () => {
  const verifier = createStandardWebhookVerifier(configuredSecret);

  assertEquals(verifier(payload, signedHeaders(new Date())), {
    sms: { otp: "123456" },
  });
});

Deno.test("Standard Webhook verifier rejects tampering and stale signatures", () => {
  const verifier = createStandardWebhookVerifier(configuredSecret);
  const now = new Date();
  const stale = new Date(now.getTime() - 10 * 60 * 1_000);

  assertThrows(() => verifier(`${payload} `, signedHeaders(now)));
  assertThrows(() => verifier(payload, signedHeaders(stale)));
  assertThrows(() => verifier(payload, new Headers()));
});

Deno.test("Standard Webhook verifier rejects malformed hook secrets", () => {
  assertThrows(() => createStandardWebhookVerifier("not-a-hook-secret"));
});
