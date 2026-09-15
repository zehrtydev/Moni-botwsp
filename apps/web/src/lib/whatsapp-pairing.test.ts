import { beforeEach, describe, expect, it } from "vitest";
import { checkPairingRateLimit, generatePairingCode, hashPairingCode, isPairingCode, normalizePairingCode, resetPairingRateLimit } from "./whatsapp-pairing";

describe("WhatsApp pairing codes", () => {
  beforeEach(() => resetPairingRateLimit());
  it("generates six safe characters in two groups of three", () => {
    expect(generatePairingCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3} [ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}$/);
  });

  it.each(["AB2 CD3", "AB2CD3", "ab2cd3", " ab2 cd3 ", "  AB2CD3  "])("accepts and normalizes %j to the same hash", (code) => {
    expect(normalizePairingCode(code)).toBe("AB2CD3");
    expect(isPairingCode(code)).toBe(true);
    expect(hashPairingCode(code)).toBe(hashPairingCode("AB2CD3"));
    expect(hashPairingCode(code)).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    "", "Hola", "MONI-AB2CD3", "AB2CD", "AB2CD34", "AB2-CD3", "AB2  CD3",
    "AB 2CD3", "A B 2 C D 3", "AB2\tCD3", "AB2\nCD3", "AB2_CD3",
    "AB0CD3", "AB1CD3", "ABICD3", "ABOCD3", "ÁB2CD3", "🔐 AB2 CD3",
  ])("rejects invalid format %j before hashing", (code) => {
    expect(isPairingCode(code)).toBe(false);
    expect(() => hashPairingCode(code)).toThrow("Invalid pairing code");
  });

  it("limits pairing attempts by user and IP and expires the window", () => {
    const start = 1_000_000;
    expect(Array.from({ length: 5 }, () => checkPairingRateLimit("user-1", "203.0.113.1", start)).every(Boolean)).toBe(true);
    expect(checkPairingRateLimit("user-1", "203.0.113.1", start)).toBe(false);
    expect(checkPairingRateLimit("user-1", "203.0.113.1", start + 15 * 60 * 1000)).toBe(true);
  });
});
