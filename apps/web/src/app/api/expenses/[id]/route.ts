import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const updateExpenseSchema = z.object({
  monto: z.number().int().positive(),
  fecha_gasto: z.string().date(),
  categoria_id: z.string().uuid(),
  descripcion: z.string().trim().min(1).max(500),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await context.params;
  const parsed = updateExpenseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos del gasto no válidos" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: category } = await admin.from("categorias").select("id").eq("id", parsed.data.categoria_id).eq("activa", true).maybeSingle();
  if (!category) return NextResponse.json({ error: "Categoría no válida" }, { status: 400 });
  const { data: expense, error } = await admin.from("gastos").update(parsed.data).eq("id", id).eq("usuario_id", user.id).select("id").maybeSingle();
  if (error) { console.error("expense_update_failed", error); return NextResponse.json({ error: "No se pudo actualizar el gasto" }, { status: 500 }); }
  if (!expense) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
  return NextResponse.json({ success: true });
}
