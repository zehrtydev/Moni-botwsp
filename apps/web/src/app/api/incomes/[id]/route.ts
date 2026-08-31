import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await context.params;
  const admin = createSupabaseAdminClient();
  const { data: income, error } = await admin.from("ingresos").delete().eq("id", id).eq("usuario_id", user.id).select("id").maybeSingle();
  if (error) { console.error("income_delete_failed", error); return NextResponse.json({ error: "No se pudo eliminar el ingreso" }, { status: 500 }); }
  if (!income) return NextResponse.json({ error: "Ingreso no encontrado" }, { status: 404 });
  return NextResponse.json({ success: true });
}
