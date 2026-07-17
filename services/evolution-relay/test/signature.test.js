import assert from "node:assert/strict";
import test from "node:test";
import { signRelayPayload } from "../src/signature.js";

test("firma timestamp y cuerpo con HMAC-SHA256", () => {
  const signed = signRelayPayload(
    '{"provider":"evolution"}',
    "relay-secret-for-tests-only-1234567890",
    1_750_000_000,
  );

  assert.deepEqual(signed, {
    timestamp: "1750000000",
    signature: "v1=c8814b2c278f97c545981852fdcdc8c70c5d3c0249b35056e377770b9754a7a6",
  });
});

test("exige un secreto robusto", () => {
  assert.throws(() => signRelayPayload("{}", "corto", 1_750_000_000));
});
