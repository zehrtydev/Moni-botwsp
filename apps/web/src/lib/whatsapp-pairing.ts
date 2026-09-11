import { createHash, randomBytes } from "node:crypto";

const pairingCodePattern = /^MONI-[A-Z0-9]{6}$/;
const pairingWindowMs = 15 * 60 * 1000;
const pairingMaxAttempts = 5;
const attempts = new Map<string, number[]>();

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
