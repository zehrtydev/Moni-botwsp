import { createClient } from "@supabase/supabase-js";
import {
  createEvolutionClient,
  isAmbiguousEvolutionError,
} from "../_shared/evolution-client.ts";
import { createSmsEventFingerprinter } from "../_shared/sms-event-fingerprint.ts";
import { createStandardWebhookVerifier } from "../_shared/standard-webhook.ts";
import { createSendSmsHandler } from "./handler.ts";

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error("Servicio no configurado.");
  }

  return value;
}

Deno.serve(async (request) => {
  try {
    const hookSecret = requiredEnvironment("SEND_SMS_HOOK_SECRET");
    const verify = createStandardWebhookVerifier(hookSecret);
    const fingerprintDelivery = await createSmsEventFingerprinter(hookSecret);
    const evolution = createEvolutionClient({
      apiKey: requiredEnvironment("EVOLUTION_API_KEY"),
      baseUrl: requiredEnvironment("EVOLUTION_API_URL"),
      instance: requiredEnvironment("EVOLUTION_INSTANCE"),
      timeoutMs: 3_500,
    });
    const supabase = createClient(
      requiredEnvironment("SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
    const handler = createSendSmsHandler({
      claimDelivery: async ({ fingerprint, webhookId }) => {
        const { data, error } = await supabase.rpc(
          "reclamar_sms_hook_evento",
          {
            p_evento_huella: fingerprint,
            p_webhook_id: webhookId,
          },
        );

        if (error || !["reclamado", "finalizado", "ocupado"].includes(data)) {
          throw new Error("No se pudo reclamar el evento.");
        }

        return data === "reclamado"
          ? "claimed"
          : data === "finalizado"
          ? "completed"
          : "busy";
      },
      completeDelivery: async (fingerprint, outcome) => {
        const { data, error } = await supabase.rpc(
          "finalizar_sms_hook_evento",
          {
            p_evento_huella: fingerprint,
            p_resultado: outcome === "delivered"
              ? "entregado"
              : "indeterminado",
          },
        );

        if (error || data !== true) {
          throw new Error("No se pudo finalizar el evento.");
        }
      },
      fingerprintDelivery,
      isAmbiguousDeliveryError: isAmbiguousEvolutionError,
      releaseDelivery: async (fingerprint) => {
        const { data, error } = await supabase.rpc(
          "liberar_sms_hook_evento",
          { p_evento_huella: fingerprint },
        );

        if (error || data !== true) {
          throw new Error("No se pudo liberar el evento.");
        }
      },
      sendText: (message) => evolution.sendText(message),
      verify,
    });

    return handler(request);
  } catch {
    return new Response("Servicio no configurado.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
});
