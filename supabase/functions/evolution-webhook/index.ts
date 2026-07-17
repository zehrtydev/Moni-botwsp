import { createClient } from "@supabase/supabase-js";
import {
  createEvolutionClient,
  isAmbiguousEvolutionError,
  isRejectedEvolutionError,
} from "../_shared/evolution-client.ts";
import { createRelayVerifier } from "../_shared/relay-signature.ts";
import { createEvolutionWebhookHandler } from "./handler.ts";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error("Servicio no configurado.");
  }

  return value;
}

Deno.serve(async (request) => {
  try {
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
    const verify = await createRelayVerifier(
      requiredEnvironment("MONI_INBOUND_WEBHOOK_SECRET"),
    );
    const evolutionInstance = requiredEnvironment("EVOLUTION_INSTANCE");
    const evolution = createEvolutionClient({
      apiKey: requiredEnvironment("EVOLUTION_API_KEY"),
      baseUrl: requiredEnvironment("EVOLUTION_API_URL"),
      instance: evolutionInstance,
      timeoutMs: 3_500,
    });
    const handler = createEvolutionWebhookHandler({
      claimReply: async (inboxId) => {
        const { data, error } = await supabase.rpc(
          "reclamar_respuesta_mensaje",
          { p_mensaje_entrante_id: inboxId },
        );

        if (error || !data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("No se pudo reclamar la respuesta.");
        }

        const claim = data as {
          estado?: unknown;
          lease_token?: unknown;
          respuesta?: unknown;
        };

        if (claim.estado === "reclamado") {
          if (
            typeof claim.lease_token !== "string" ||
            !uuidPattern.test(claim.lease_token) ||
            typeof claim.respuesta !== "string" ||
            claim.respuesta.length < 1 ||
            claim.respuesta.length > 1_000
          ) {
            throw new Error("No se pudo reclamar la respuesta.");
          }

          return {
            state: "claimed" as const,
            leaseToken: claim.lease_token,
            reply: claim.respuesta,
          };
        }

        if (claim.estado === "ocupado") return { state: "busy" as const };
        if (claim.estado === "finalizado") {
          return { state: "completed" as const };
        }
        if (claim.estado === "sin_respuesta") return { state: "none" as const };

        throw new Error("No se pudo reclamar la respuesta.");
      },
      completeReply: async (inboxId, leaseToken, outcome) => {
        const { data, error } = await supabase.rpc(
          "finalizar_respuesta_mensaje",
          {
            p_lease_token: leaseToken,
            p_mensaje_entrante_id: inboxId,
            p_resultado: outcome === "delivered"
              ? "entregada"
              : outcome === "rejected"
              ? "rechazada"
              : "indeterminada",
          },
        );

        if (error || data !== true) {
          throw new Error("No se pudo finalizar la respuesta.");
        }
      },
      expectedInstance: evolutionInstance,
      isAmbiguousDeliveryError: isAmbiguousEvolutionError,
      isRejectedDeliveryError: isRejectedEvolutionError,
      persistMessage: async (message) => {
        const { data, error } = await supabase.rpc(
          "registrar_mensaje_entrante",
          {
            p_proveedor: message.proveedor,
            p_instancia: message.instancia,
            p_mensaje_origen_id: message.mensaje_origen_id,
            p_numero_whatsapp: message.numero_whatsapp,
            p_tipo: message.tipo,
            p_recibido_en: message.recibido_en,
          },
        );

        if (error || (data !== "insertado" && data !== "duplicado")) {
          throw new Error("No se pudo registrar el mensaje.");
        }

        return data === "insertado" ? "inserted" : "duplicate";
      },
      processText: async (instance, message, extraction) => {
        const { data, error } = await supabase.rpc(
          "procesar_mensaje_texto",
          {
            p_categoria_nombre: extraction.categoria,
            p_confianza: extraction.confianza,
            p_descripcion: extraction.descripcion,
            p_fecha_gasto: extraction.fecha_gasto,
            p_instancia: instance,
            p_mensaje_origen_id: message.mensaje_origen_id,
            p_metodo_pago: extraction.metodo_pago,
            p_monto: extraction.monto,
            p_numero_whatsapp: message.numero_whatsapp,
            p_proveedor: "evolution",
            p_recibido_en: message.timestamp,
            p_texto_original: message.contenido,
          },
        );

        if (error || !data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("No se pudo procesar el mensaje.");
        }

        const result = data as { mensaje_entrante_id?: unknown };

        if (
          typeof result.mensaje_entrante_id !== "string" ||
          !uuidPattern.test(result.mensaje_entrante_id)
        ) {
          throw new Error("No se pudo procesar el mensaje.");
        }

        return { inboxId: result.mensaje_entrante_id };
      },
      releaseReply: async (inboxId, leaseToken) => {
        const { data, error } = await supabase.rpc(
          "liberar_respuesta_mensaje",
          {
            p_lease_token: leaseToken,
            p_mensaje_entrante_id: inboxId,
          },
        );

        if (error || data !== true) {
          throw new Error("No se pudo liberar la respuesta.");
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
