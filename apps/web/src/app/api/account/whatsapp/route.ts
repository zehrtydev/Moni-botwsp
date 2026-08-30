import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({ numero_whatsapp: z.string().regex(/^\+[1-9][0-9]{7,14}$/) });

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
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
  return NextResponse.json({ success: true });
}
