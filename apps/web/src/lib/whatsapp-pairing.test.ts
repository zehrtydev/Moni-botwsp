import { beforeEach, describe, expect, it } from "vitest";
import { checkPairingRateLimit, generatePairingCode, hashPairingCode, isPairingCode, resetPairingRateLimit } from "./whatsapp-pairing";

describe("WhatsApp pairing codes", () => {
  beforeEach(() => resetPairingRateLimit());
  it("generates a code with the user-facing format", () => {
    expect(generatePairingCode()).toMatch(/^MONI-[A-Z0-9]{6}$/);
  });

  it("normalizes codes before hashing and validating", () => {
    expect(isPairingCode(" moni-AB2CD3 ")).toBe(true);
    expect(hashPairingCode(" moni-AB2CD3 ")).toBe(hashPairingCode("MONI-AB2CD3"));
  });

  it("rejects arbitrary text as a pairing code", () => {
    expect(isPairingCode("Hola")).toBe(false);
    expect(isPairingCode("MONI-123")).toBe(false);
  });

  it("limits pairing attempts by user and IP and expires the window", () => {
    const start = 1_000_000;
    expect(Array.from({ length: 5 }, () => checkPairingRateLimit("user-1", "203.0.113.1", start)).every(Boolean)).toBe(true);
    expect(checkPairingRateLimit("user-1", "203.0.113.1", start)).toBe(false);
    expect(checkPairingRateLimit("user-1", "203.0.113.1", start + 15 * 60 * 1000)).toBe(true);
  });
});
