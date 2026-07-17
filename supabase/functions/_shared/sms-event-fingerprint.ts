const e164Pattern = /^\+[1-9][0-9]{7,14}$/;
const otpPattern = /^[0-9]{6}$/;

function decodeHookSecret(configuredSecret: string) {
  const prefix = "v1,whsec_";

  if (!configuredSecret.startsWith(prefix)) {
    throw new Error("La configuracion del webhook no es valida.");
  }

  try {
    const decoded = atob(configuredSecret.slice(prefix.length));
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("La configuracion del webhook no es valida.");
  }
}

export async function createSmsEventFingerprinter(configuredSecret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    decodeHookSecret(configuredSecret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );

  return async (phone: string, otp: string) => {
    if (!e164Pattern.test(phone) || !otpPattern.test(otp)) {
      throw new Error("El evento SMS no es valido.");
    }

    const data = new TextEncoder().encode(
      `moni:sms-hook-dedup:v1\u0000${phone}\u0000${otp}`,
    );
    const signature = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, data),
    );

    return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };
}
