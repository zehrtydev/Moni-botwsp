export interface EvolutionConfig {
  apiKey: string;
  baseUrl: string;
  instance: string;
  timeoutMs: number;
}

export interface EvolutionTextMessage {
  phone: string;
  text: string;
}

export interface EvolutionClient {
  sendText(message: EvolutionTextMessage): Promise<void>;
}

export class EvolutionDeliveryError extends Error {
  constructor(
    message: string,
    readonly outcome: "rejected" | "retryable" | "unknown",
  ) {
    super(message);
    this.name = "EvolutionDeliveryError";
  }
}

export function isAmbiguousEvolutionError(error: unknown) {
  return error instanceof EvolutionDeliveryError && error.outcome === "unknown";
}

export function isRejectedEvolutionError(error: unknown) {
  return error instanceof EvolutionDeliveryError &&
    error.outcome === "rejected";
}

export function isRetryableEvolutionError(error: unknown) {
  return error instanceof EvolutionDeliveryError &&
    error.outcome === "retryable";
}

const e164Pattern = /^\+[1-9][0-9]{7,14}$/;

function configurationError() {
  return new Error("La configuracion de Evolution no es valida.");
}

function deliveryError(outcome: "rejected" | "retryable" | "unknown") {
  return new EvolutionDeliveryError(
    "Evolution no pudo entregar el mensaje.",
    outcome,
  );
}

function parseBaseUrl(rawUrl: string) {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw configurationError();
  }

  const localHttp = url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw configurationError();
  }

  return url.toString().replace(/\/+$/, "");
}

export function createEvolutionClient(
  config: EvolutionConfig,
  fetcher: typeof fetch = fetch,
): EvolutionClient {
  const apiKey = config.apiKey.trim();
  const instance = config.instance.trim();
  const baseUrl = parseBaseUrl(config.baseUrl);

  if (
    !apiKey ||
    !instance ||
    instance.length > 128 ||
    !Number.isInteger(config.timeoutMs) ||
    config.timeoutMs < 1 ||
    config.timeoutMs > 4_000
  ) {
    throw configurationError();
  }

  return {
    async sendText(message) {
      if (
        !e164Pattern.test(message.phone) ||
        message.text.length < 1 ||
        message.text.length > 1_000
      ) {
        throw deliveryError("rejected");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetcher(
          `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`,
          {
            method: "POST",
            headers: {
              apikey: apiKey,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              number: message.phone.slice(1),
              text: message.text,
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const outcome = [408, 425, 429].includes(response.status)
            ? "retryable"
            : response.status >= 400 && response.status < 500
            ? "rejected"
            : "unknown";
          throw deliveryError(outcome);
        }
      } catch (error) {
        if (error instanceof EvolutionDeliveryError) {
          throw error;
        }

        throw deliveryError("unknown");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
