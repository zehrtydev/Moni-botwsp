import assert from "node:assert/strict";
import test from "node:test";
import { forwardSignedPayload } from "../src/forward.js";

const request = {
  destination: new URL("https://example.test/webhook"),
  payload: "{}",
  signature: "v1=abc",
  timestamp: "1750000000",
  delay: () => Promise.resolve(),
};

test("reintenta respuestas transitorias antes de confirmar", async () => {
  const statuses = [503, 429, 202];
  let calls = 0;
  const delivered = await forwardSignedPayload({
    ...request,
    fetchImpl: () => Promise.resolve(new Response(null, {
      status: statuses[calls++],
    })),
  });

  assert.equal(delivered, true);
  assert.equal(calls, 3);
});

test("reintenta errores de red y se detiene tras tres intentos", async () => {
  let calls = 0;
  const delivered = await forwardSignedPayload({
    ...request,
    fetchImpl: () => {
      calls += 1;
      return Promise.reject(new Error("network"));
    },
  });

  assert.equal(delivered, false);
  assert.equal(calls, 3);
});

test("no reintenta errores permanentes del receptor", async () => {
  let calls = 0;
  const delivered = await forwardSignedPayload({
    ...request,
    fetchImpl: () => {
      calls += 1;
      return Promise.resolve(new Response(null, { status: 400 }));
    },
  });

  assert.equal(delivered, false);
  assert.equal(calls, 1);
});
