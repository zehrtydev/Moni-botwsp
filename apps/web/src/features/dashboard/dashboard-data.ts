import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const e164Pattern = /^\+[1-9][0-9]{7,14}$/;

const profileSchema = z.object({
  nombre: z.string().max(100).nullable(),
  numero_whatsapp: z.string().regex(e164Pattern),
});

const expenseSchema = z.object({
  id: z.string().uuid(),
  fecha_gasto: z.iso.date(),
  monto: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  moneda: z.literal("COP"),
  descripcion: z.string().min(1).max(500),
  categorias: z.object({ nombre: z.string().min(1) }).nullable(),
});

const summarySchema = z
  .array(
    z.object({
      cantidad: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      monto_total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    }),
  )
  .length(1);

export interface DashboardData {
  profile: { name: string | null; phone: string };
  summary: { count: number; totalAmount: number };
  expenses: Array<{
    id: string;
    date: string;
    amount: number;
    currency: "COP";
    description: string;
    category: string;
  }>;
}

const dashboardError = new Error("No pudimos cargar tu dashboard.");

export async function loadDashboardData(
  client: SupabaseClient,
  userId: string,
): Promise<DashboardData | null> {
  const profileResult = await client
    .from("usuarios")
    .select("nombre, numero_whatsapp")
    .eq("id", userId)
    .maybeSingle();

  if (profileResult.error) {
    throw dashboardError;
  }

  if (!profileResult.data?.numero_whatsapp) {
    return null;
  }

  const profile = profileSchema.safeParse(profileResult.data);

  if (!profile.success) {
    throw dashboardError;
  }

  const [expenseResult, summaryResult] = await Promise.all([
    client
      .from("gastos")
      .select(
        "id, fecha_gasto, monto, moneda, descripcion, categorias(nombre)",
      )
      .eq("usuario_id", userId)
      .eq("estado", "confirmado")
      .order("fecha_gasto", { ascending: false })
      .limit(8),
    client.rpc("resumen_gastos_confirmados", {
      p_categoria_id: null,
      p_desde: null,
      p_hasta: null,
    }),
  ]);

  if (expenseResult.error || summaryResult.error) {
    throw dashboardError;
  }

  const expenses = z.array(expenseSchema).safeParse(expenseResult.data ?? []);
  const summary = summarySchema.safeParse(summaryResult.data);

  if (!expenses.success || !summary.success) {
    throw dashboardError;
  }

  return {
    profile: {
      name: profile.data.nombre,
      phone: profile.data.numero_whatsapp,
    },
    summary: {
      count: summary.data[0].cantidad,
      totalAmount: summary.data[0].monto_total,
    },
    expenses: expenses.data.map((expense) => ({
      id: expense.id,
      date: expense.fecha_gasto,
      amount: expense.monto,
      currency: expense.moneda,
      description: expense.descripcion,
      category: expense.categorias?.nombre ?? "Sin categoria",
    })),
  };
}
