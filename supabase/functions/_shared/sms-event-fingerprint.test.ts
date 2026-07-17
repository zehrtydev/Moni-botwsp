import { assertEquals, assertNotEquals, assertMatch } from "@std/assert";
import { createSmsEventFingerprinter } from "./sms-event-fingerprint.ts";

Deno.test("SMS event fingerprints are stable, opaque, and event-specific", async () => {
  const fingerprint = await createSmsEventFingerprinter(
    "v1,whsec_dGVzdC1ob29rLXNlY3JldA==",
  );
  const first = await fingerprint("+573001234567", "123456");
  const retry = await fingerprint("+573001234567", "123456");
  const differentOtp = await fingerprint("+573001234567", "654321");

  assertEquals(first, retry);
  assertNotEquals(first, differentOtp);
  assertMatch(first, /^[0-9a-f]{64}$/);
  assertEquals(first.includes("123456"), false);
  assertEquals(first.includes("573001234567"), false);
});
