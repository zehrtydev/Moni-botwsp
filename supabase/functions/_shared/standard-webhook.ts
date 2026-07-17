import { Webhook } from "standardwebhooks";

export type StandardWebhookVerifier = (
  payload: string,
  headers: Headers,
) => unknown;

export function createStandardWebhookVerifier(
  configuredSecret: string,
): StandardWebhookVerifier {
  const prefix = "v1,whsec_";

  if (!configuredSecret.startsWith(prefix)) {
    throw new Error("La configuracion del webhook no es valida.");
  }

  const secret = configuredSecret.slice(prefix.length);

  if (!secret) {
    throw new Error("La configuracion del webhook no es valida.");
  }

  let webhook: Webhook;

  try {
    webhook = new Webhook(secret);
  } catch {
    throw new Error("La configuracion del webhook no es valida.");
  }

  return (payload, headers) =>
    webhook.verify(payload, Object.fromEntries(headers));
}
