import { redirect } from "next/navigation";
import { BarChart3, CheckCircle2, LayoutDashboard, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { CategoryExpenseChart, MonthlyExpenseChart } from "@/components/expense-charts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMonthlyTotals, getRecentMonthRanges } from "@/lib/statistics-insights";
import { SectionLink } from "@/components/section-link";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export default async function StatisticsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const months = getRecentMonthRanges();
  const { data: expenses } = await supabase.from("gastos").select("id, fecha_gasto, monto, categoria_id").eq("usuario_id", user.id).eq("estado", "confirmado").gte("fecha_gasto", months[0].start).lte("fecha_gasto", months.at(-1)?.end ?? months[0].end).limit(1000);
  const categoryIds = (expenses ?? []).map((expense) => expense.categoria_id).filter((id): id is string => Boolean(id));
  const { data: categories } = categoryIds.length ? await supabase.from("categorias").select("id, nombre").in("id", categoryIds) : { data: [] };
  const categoryNames = new Map((categories ?? []).map((category) => [category.id, category.nombre]));
  const monthlyTotals = getMonthlyTotals(expenses ?? [], months);
  const categoryTotals = (expenses ?? []).reduce((totals, expense) => { const name = categoryNames.get(expense.categoria_id ?? "") ?? "Otros"; return { ...totals, [name]: (totals[name] ?? 0) + Number(expense.monto ?? 0) }; }, {} as Record<string, number>);
  const categoryData = Object.entries(categoryTotals).sort(([, first], [, second]) => second - first).map(([name, total]) => ({ name, total }));
  const total = monthlyTotals.reduce((sum, month) => sum + month.total, 0);
  const current = monthlyTotals.at(-1)?.total ?? 0;
  const previous = monthlyTotals.at(-2)?.total ?? 0;
  const change = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  const highestMonth = monthlyTotals.reduce((highest, month) => month.total > highest.total ? month : highest, monthlyTotals[0]);

  return <main className="dashboard-shell"><header className="dashboard-header statistics-header"><div><p className="brand-mark"><span className="brand-dot" /> moni</p><p className="eyebrow">Tu actividad financiera</p><h1>Estadísticas <BarChart3 className="title-icon" size={27} aria-hidden="true" /></h1><p className="muted">Observa tus hábitos y tendencias de gasto.</p></div><div className="header-actions"><SectionLink href="/dashboard" label="Dashboard" icon={LayoutDashboard} /><SectionLink href="/estadisticas" label="Estadísticas" icon={BarChart3} active /><SectionLink href="/presupuestos" label="Presupuestos" icon={PiggyBank} /><SignOutButton /></div></header><section className="statistics-summary" aria-label="Resumen de estadísticas"><article className="clay-panel statistics-total"><span className="label">Total últimos 6 meses</span><strong>{formatCurrency(total)}</strong><span className="muted">{expenses?.length ?? 0} movimientos confirmados</span></article><article className="clay-panel stat-panel"><span className="stat-icon purple">{change !== null && change > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}</span><div><span className="label">Último mes</span><strong>{change === null ? "Nuevo" : `${change > 0 ? "+" : ""}${change}%`}</strong><p className="muted">vs. mes anterior</p></div></article><article className="clay-panel stat-panel"><span className="stat-icon peach"><CheckCircle2 size={20} /></span><div><span className="label">Mes más alto</span><strong>{formatCurrency(highestMonth?.total ?? 0)}</strong><p className="muted">{highestMonth?.month ?? "—"}</p></div></article></section><section className="statistics-grid"><section className="clay-panel chart-panel" aria-labelledby="monthly-title"><div className="section-heading"><div><p className="eyebrow">Tendencia</p><h2 id="monthly-title">Gasto mensual</h2></div><span className="section-badge">6 meses</span></div><MonthlyExpenseChart months={monthlyTotals} /></section><section className="clay-panel chart-panel" aria-labelledby="category-title"><div className="section-heading"><div><p className="eyebrow">Distribución</p><h2 id="category-title">Por categoría</h2></div><span className="section-badge">Acumulado</span></div>{categoryData.length ? <CategoryExpenseChart categories={categoryData} /> : <div className="empty-state"><h3>Sin datos todavía</h3><p className="muted">Confirma gastos para ver tus categorías.</p></div>}</section></section></main>;
}
