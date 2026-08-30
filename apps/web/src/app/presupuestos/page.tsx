import { redirect } from "next/navigation";
import { BarChart3, LayoutDashboard, PiggyBank } from "lucide-react";
import { BudgetSettingsForm } from "@/components/budget-settings-form";
import { SignOutButton } from "@/components/sign-out-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SectionLink } from "@/components/section-link";

function getMonthStart() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-01`;
}

export default async function BudgetsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const month = getMonthStart();
  const [{ data: categories }, { data: budgets }] = await Promise.all([
    supabase.from("categorias").select("id, nombre").eq("activa", true).order("nombre"),
    supabase.from("presupuestos_mensuales").select("categoria_id, monto_limite").eq("usuario_id", user.id).eq("mes", month),
  ]);
  return <main className="dashboard-shell"><header className="dashboard-header"><div><p className="brand-mark"><span className="brand-dot" /> moni</p><p className="eyebrow">Configuración</p><h1>Mis presupuestos</h1><p className="muted">Define cuánto quieres destinar a cada categoría durante el mes.</p></div><div className="header-actions"><SectionLink href="/dashboard" label="Dashboard" icon={LayoutDashboard} /><SectionLink href="/estadisticas" label="Estadísticas" icon={BarChart3} /><SectionLink href="/presupuestos" label="Presupuestos" icon={PiggyBank} active /><SignOutButton /></div></header><section className="clay-panel budget-panel"><div className="budget-intro"><span className="panel-icon"><PiggyBank size={22} aria-hidden="true" /></span><div><h2>Límites de {new Intl.DateTimeFormat("es-CO", { month: "long" }).format(new Date(`${month}T12:00:00-05:00`))}</h2><p className="muted">El semáforo del dashboard se actualizará con estos límites.</p></div></div><BudgetSettingsForm categories={categories ?? []} budgets={budgets ?? []} month={month} /></section></main>;
}
