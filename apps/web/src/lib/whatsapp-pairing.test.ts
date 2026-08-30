import { describe, expect, it } from "vitest";
import { generatePairingCode, hashPairingCode, isPairingCode } from "./whatsapp-pairing";

describe("WhatsApp pairing codes", () => {
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
});
