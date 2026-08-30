import { createHash, randomBytes } from "node:crypto";

const pairingCodePattern = /^MONI-[A-Z0-9]{6}$/;

export function generatePairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  const suffix = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  return `MONI-${suffix}`;
}

export function hashPairingCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function isPairingCode(value: string) {
  return pairingCodePattern.test(value.trim().toUpperCase());
}
