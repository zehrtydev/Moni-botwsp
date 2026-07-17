type RelayVerifier = (
  payload: string,
  headers: Headers,
) => Promise<unknown>;

const maximumClockSkewSeconds = 300;
const signaturePattern = /^v1=([0-9a-f]{64})$/i;

function configurationError() {
  return new Error("La configuracion del relay no es valida.");
}

function verificationError() {
  return new Error("La firma del relay no es valida.");
}

function hexBytes(value: string) {
  const bytes = new Uint8Array(value.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

export async function createRelayVerifier(
  configuredSecret: string,
  now = () => Date.now(),
): Promise<RelayVerifier> {
  const secret = configuredSecret.trim();

  if (secret.length < 32) {
    throw configurationError();
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["verify"],
  );

  return async (payload, headers) => {
    const timestampValue = headers.get("x-moni-timestamp");
    const signatureValue = headers.get("x-moni-signature");

    if (
      !timestampValue ||
      !/^\d{10}$/.test(timestampValue) ||
      !signatureValue
    ) {
      throw verificationError();
    }

    const timestamp = Number(timestampValue);
    const nowSeconds = Math.floor(now() / 1_000);
    const signature = signatureValue.match(signaturePattern);

    if (
      !signature ||
      Math.abs(nowSeconds - timestamp) > maximumClockSkewSeconds
    ) {
      throw verificationError();
    }

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      hexBytes(signature[1]),
      new TextEncoder().encode(`${timestamp}.${payload}`),
    );

    if (!valid) {
      throw verificationError();
    }

    return JSON.parse(payload);
  };
}
