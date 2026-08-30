import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const budgetSchema = z.object({ categoria_id: z.string().uuid(), mes: z.string().regex(/^\d{4}-\d{2}-01$/), monto_limite: z.number().int().positive() });

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const parsed = budgetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos del presupuesto no válidos" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: category } = await admin.from("categorias").select("id").eq("id", parsed.data.categoria_id).eq("activa", true).maybeSingle();
  if (!category) return NextResponse.json({ error: "Categoría no válida" }, { status: 400 });
  const { error } = await admin.from("presupuestos_mensuales").upsert({ usuario_id: user.id, ...parsed.data, monto_limite: parsed.data.monto_limite, actualizado_en: new Date().toISOString() }, { onConflict: "usuario_id,categoria_id,mes" });
  if (error) { console.error("budget_upsert_failed", error); return NextResponse.json({ error: "No se pudo guardar el presupuesto" }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
