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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

        if (
          error ||
          !data ||
          typeof data !== "object" ||
          Array.isArray(data)
        ) {
          throw new Error("No se pudo reclamar el evento.");
        }

        const result = data as {
          estado?: unknown;
          lease_token?: unknown;
        };

        if (
          result.estado === "reclamado" &&
          typeof result.lease_token === "string" &&
          uuidPattern.test(result.lease_token)
        ) {
          return { status: "claimed" as const, leaseToken: result.lease_token };
        }

        if (result.estado === "finalizado" && result.lease_token === null) {
          return { status: "completed" as const, leaseToken: null };
        }

        if (result.estado === "ocupado" && result.lease_token === null) {
          return { status: "busy" as const, leaseToken: null };
        }

        throw new Error("No se pudo reclamar el evento.");
      },
      completeDelivery: async (fingerprint, leaseToken, outcome) => {
        const { data, error } = await supabase.rpc(
          "finalizar_sms_hook_evento",
          {
            p_evento_huella: fingerprint,
            p_lease_token: leaseToken,
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
      releaseDelivery: async (fingerprint, leaseToken) => {
        const { data, error } = await supabase.rpc(
          "liberar_sms_hook_evento",
          { p_evento_huella: fingerprint, p_lease_token: leaseToken },
        );

        if (error || data !== true) {
          throw new Error("No se pudo liberar el evento.");
        }
      },
      sendText: (message) => evolution.sendText(message),
      verify,
    });

    const response = await handler(request);

    if (!response.ok) {
      console.error("send-sms request failed", { status: response.status });
    }

    return response;
  } catch (error) {
    console.error("send-sms setup failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return new Response("Servicio no configurado.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
});
