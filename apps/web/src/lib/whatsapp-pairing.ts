import { createHash, randomBytes } from "node:crypto";

const pairingCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const pairingWindowMs = 15 * 60 * 1000;
const pairingMaxAttempts = 5;
const attempts = new Map<string, number[]>();

export function generatePairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  const suffix = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  return `${suffix.slice(0, 3)} ${suffix.slice(3)}`;
}

export function normalizePairingCode(code: string) {
  // Only the single space between two groups of three is optional.
  return code.trim().toUpperCase().replace(/^(\S{3}) (\S{3})$/, "$1$2");
}

export function hashPairingCode(code: string) {
  const normalized = normalizePairingCode(code);
  if (!pairingCodePattern.test(normalized)) throw new Error("Invalid pairing code");
  return createHash("sha256").update(normalized).digest("hex");
}

export function isPairingCode(value: string) {
  return pairingCodePattern.test(normalizePairingCode(value));
}

export function checkPairingRateLimit(userId: string, ipAddress: string, now = Date.now()) {
  const keys = [`user:${userId}`, `ip:${ipAddress}`];
  const active = keys.map((key) => (attempts.get(key) ?? []).filter((timestamp) => now - timestamp < pairingWindowMs));
  if (active.some((timestamps) => timestamps.length >= pairingMaxAttempts)) return false;
  keys.forEach((key, index) => attempts.set(key, [...active[index], now]));
  return true;
}

export function resetPairingRateLimit() {
  attempts.clear();
}
