import { assertEquals, assertThrows } from "@std/assert";
import { createRelayVerifier } from "./relay-signature.ts";

const secret = ["relay", "secret", "fixture", "for", "tests"].join("-");
const payload = JSON.stringify({ provider: "evolution" });
const timestamp = 1_750_000_000;

async function signatureFor(value: string, at = timestamp) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${at}.${value}`),
  );
  return Array.from(new Uint8Array(signed), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

Deno.test("Relay verifier accepts a current valid signature", async () => {
  const verifier = await createRelayVerifier(
    secret,
    () => timestamp * 1_000,
  );
  const headers = new Headers({
    "x-moni-timestamp": String(timestamp),
    "x-moni-signature": `v1=${await signatureFor(payload)}`,
  });

  assertEquals(verifier(payload, headers), { provider: "evolution" });
});

Deno.test("Relay verifier rejects tampering, stale, and missing signatures", async () => {
  const verifier = await createRelayVerifier(
    secret,
    () => timestamp * 1_000,
  );
  const valid = new Headers({
    "x-moni-timestamp": String(timestamp),
    "x-moni-signature": `v1=${await signatureFor(payload)}`,
  });

  assertThrows(() => verifier(`${payload} `, valid));
  const staleSignature = await signatureFor(payload, timestamp - 301);
  assertThrows(() => verifier(payload, new Headers({
    "x-moni-timestamp": String(timestamp - 301),
    "x-moni-signature": `v1=${staleSignature}`,
  })));
  assertThrows(() => verifier(payload, new Headers()));
});

Deno.test("Relay verifier rejects an invalid configuration secret", async () => {
  await assertThrows(() => createRelayVerifier("short"));
});
