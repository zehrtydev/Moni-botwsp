const maximumAttempts = 3;
const retryDelaysMs = [100, 300];

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function transientStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

export async function forwardSignedPayload({
  destination,
  payload,
  signature,
  timestamp,
  fetchImpl = fetch,
  delay = sleep,
}) {
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(destination, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-moni-signature": signature,
          "x-moni-timestamp": timestamp,
        },
        body: payload,
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      });

      if (response.ok) return true;
      if (!transientStatus(response.status)) return false;
    } catch {
      // Los errores de red y timeout son transitorios dentro del limite.
    }

    if (attempt < maximumAttempts - 1) {
      await delay(retryDelaysMs[attempt]);
    }
  }

  return false;
}
