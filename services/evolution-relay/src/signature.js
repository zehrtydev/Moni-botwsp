import { createHmac } from "node:crypto";

export function signRelayPayload(payload, secret, timestamp) {
  if (typeof secret !== "string" || secret.trim().length < 32) {
    throw new Error("La configuracion de firma no es valida.");
  }

  if (!Number.isInteger(timestamp) || timestamp < 1_000_000_000) {
    throw new Error("El timestamp de firma no es valido.");
  }

  const timestampValue = String(timestamp);
  const digest = createHmac("sha256", secret.trim())
    .update(`${timestampValue}.${payload}`, "utf8")
    .digest("hex");

  return {
    timestamp: timestampValue,
    signature: `v1=${digest}`,
  };
}
