import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEvolutionText } from "@/lib/evolution";
import { buildPairingMessage } from "@/lib/whatsapp-messages";
import { checkPairingRateLimit, generatePairingCode, hashPairingCode } from "@/lib/whatsapp-pairing";
import { safeErrorCode } from "@/lib/safe-log";

const bodySchema = z.object({ numero_whatsapp: z.string().regex(/^\+[1-9][0-9]{7,14}$/) });

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")?.trim() ?? "unknown";
  if (!checkPairingRateLimit(user.id, ipAddress)) {
    return NextResponse.json({ success: false, error: "Demasiados intentos. Espera unos minutos." }, { status: 429, headers: { "Retry-After": "900" } });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Número E.164 no válido" }, { status: 400 });
  const { error } = await createSupabaseAdminClient()
    .from("usuarios")
    .upsert({
      id: user.id,
      numero_whatsapp: parsed.data.numero_whatsapp,
      numero_whatsapp_actualizado_en: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) return NextResponse.json({ success: false, error: "No se pudo vincular el número" }, { status: 409 });

  const pairingCode = generatePairingCode();
  const admin = createSupabaseAdminClient();
  await admin
    .from("whatsapp_vinculaciones_pendientes")
    .update({ usado_en: new Date().toISOString() })
    .eq("usuario_id", user.id)
    .is("usado_en", null);
  const { error: pairingError } = await admin
    .from("whatsapp_vinculaciones_pendientes")
    .insert({
      usuario_id: user.id,
      numero_whatsapp: parsed.data.numero_whatsapp,
      codigo_hash: hashPairingCode(pairingCode),
      expira_en: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  if (pairingError) return NextResponse.json({ success: false, error: "No se pudo preparar la vinculación" }, { status: 409 });

  let welcomeSent = false;
  try {
    await sendEvolutionText(parsed.data.numero_whatsapp, buildPairingMessage(pairingCode));
    welcomeSent = true;
  } catch (welcomeError) {
    console.error("whatsapp_welcome_failed", safeErrorCode(welcomeError));
  }

  return NextResponse.json({ success: true, welcomeSent });
}
