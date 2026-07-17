import { createClient } from "@supabase/supabase-js";
import { createRelayVerifier } from "../_shared/relay-signature.ts";
import { createEvolutionWebhookHandler } from "./handler.ts";

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
    const handler = createEvolutionWebhookHandler({
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
