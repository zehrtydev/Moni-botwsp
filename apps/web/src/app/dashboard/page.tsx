import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { WhatsappLinkForm } from "@/components/whatsapp-link-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeExpenseDescription } from "@/lib/expense-parser";
import { getCategoryLevel } from "@/lib/category-insights";
import { ArrowUpRight, BarChart3, CheckCircle2, Link2, Minus, Sparkles } from "lucide-react";
import { PiggyBank } from "lucide-react";
import { SectionLink } from "@/components/section-link";
import { CategoryIcon } from "@/components/category-icon";
import { formatExpenseDate } from "@/lib/date-format";
import { getBudgetLevel, getBudgetLevelLabel } from "@/lib/budget-insights";
import { getChangePercentage, getPreviousMonthRange, getPreviousPeriod, isValidDateRange } from "@/lib/date-range-insights";
import { getDailyTotals } from "@/lib/chart-insights";
import { CategoryExpenseChart, DailyExpenseChart } from "@/components/expense-charts";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function getCurrentMonthRange() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const end = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  return { start: `${year}-${month}-01`, end };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("usuarios").select("nombre, numero_whatsapp").eq("id", user.id).maybeSingle();
  const params = await searchParams;
  const defaults = getCurrentMonthRange();
  const requestedStart = typeof params.desde === "string" ? params.desde : defaults.start;
  const requestedEnd = typeof params.hasta === "string" ? params.hasta : defaults.end;
  const selectedRange = isValidDateRange(requestedStart, requestedEnd) ? { start: requestedStart, end: requestedEnd } : defaults;
  const isAutomaticMonthView = selectedRange.start === defaults.start && selectedRange.end === defaults.end;
  const previousRange = isAutomaticMonthView ? getPreviousMonthRange(selectedRange.start) : getPreviousPeriod(selectedRange.start, selectedRange.end);
  const { data: expenses } = profile?.numero_whatsapp
    ? await supabase.from("gastos").select("id, fecha_gasto, monto, descripcion, categoria_id").eq("usuario_id", user.id).eq("estado", "confirmado").gte("fecha_gasto", previousRange.start).lte("fecha_gasto", selectedRange.end).order("fecha_gasto", { ascending: false }).limit(500)
    : { data: [] };
  const monthStart = `${selectedRange.start.slice(0, 7)}-01`;
  const { data: budgets } = profile?.numero_whatsapp
    ? await supabase.from("presupuestos_mensuales").select("categoria_id, monto_limite").eq("usuario_id", user.id).eq("mes", monthStart)
    : { data: [] };
  const categoryIds = (expenses ?? []).map((expense) => expense.categoria_id).filter((id): id is string => Boolean(id));
  const { data: categories } = categoryIds.length ? await supabase.from("categorias").select("id, nombre").in("id", categoryIds) : { data: [] };
  const categoryNames = new Map((categories ?? []).map((category) => [category.id, category.nombre]));
  const monthExpenses = (expenses ?? []).filter((expense) => expense.fecha_gasto >= selectedRange.start && expense.fecha_gasto <= selectedRange.end);
  const previousExpenses = (expenses ?? []).filter((expense) => expense.fecha_gasto >= previousRange.start && expense.fecha_gasto <= previousRange.end);
  const monthTotal = monthExpenses.reduce((total, expense) => total + Number(expense.monto ?? 0), 0);
  const previousTotal = previousExpenses.reduce((total, expense) => total + Number(expense.monto ?? 0), 0);
  const changePercentage = getChangePercentage(monthTotal, previousTotal);
  const dailyTotals = getDailyTotals(monthExpenses, selectedRange.start, selectedRange.end);
  const categoryTotals = monthExpenses.reduce((totals, expense) => {
    const name = categoryNames.get(expense.categoria_id ?? "") ?? "Otros";
    return { ...totals, [name]: (totals[name] ?? 0) + Number(expense.monto ?? 0) };
  }, {} as Record<string, number>);
  const topCategories = Object.entries(categoryTotals).sort(([, first], [, second]) => second - first).slice(0, 4);
  const topCategoryTotal = topCategories[0]?.[1] ?? 0;
  const categoryChartData = Object.entries(categoryTotals).sort(([, first], [, second]) => second - first).map(([name, total]) => ({ name, total }));
  const budgetsByCategory = new Map((budgets ?? []).map((budget) => [budget.categoria_id, Number(budget.monto_limite)]));
  const userName = profile?.nombre?.trim().split(" ")[0] || "Manuel";

  return <main className="dashboard-shell">
    <header className="dashboard-header"><div><p className="brand-mark"><span className="brand-dot" /> moni</p><p className="eyebrow">Tu espacio financiero</p><h1>Hola, {userName} <Sparkles className="title-icon" size={27} aria-hidden="true" /></h1><p className="muted">Esto es lo que está pasando con tus gastos.</p></div><div className="header-actions"><SectionLink href="/estadisticas" label="Estadísticas" icon={BarChart3} /><SectionLink href="/presupuestos" label="Presupuestos" icon={PiggyBank} /><SignOutButton /></div></header>
    {!profile?.numero_whatsapp && <section className="clay-panel setup-panel"><div className="panel-icon" aria-hidden="true"><Link2 size={22} /></div><div><p className="eyebrow">Primer paso</p><h2>Conecta tu WhatsApp</h2><p className="muted">Vincula el número conectado a Evolution para empezar a registrar gastos.</p><WhatsappLinkForm /></div></section>}
    {profile?.numero_whatsapp && <>
      <section className="clay-panel date-filter-panel" aria-label="Filtros del dashboard"><div><p className="eyebrow">Periodo</p><h2>Explora tus gastos</h2></div><form className="date-filter-form"><label>Desde<input type="date" name="desde" defaultValue={selectedRange.start} /></label><label>Hasta<input type="date" name="hasta" defaultValue={selectedRange.end} /></label><button type="submit">Aplicar</button></form></section>
      <section className="summary-grid" aria-label="Resumen financiero"><article className="clay-panel total-panel"><div className="panel-topline"><span className="label">{isAutomaticMonthView ? "Gastado este mes" : "Gastado en el periodo"}</span><span className="status-pill"><CheckCircle2 size={14} aria-hidden="true" /> Confirmado</span></div><p className="total-value">{formatCurrency(monthTotal)}</p><p className="muted">{monthExpenses.length === 1 ? "1 gasto registrado" : `${monthExpenses.length} gastos registrados`}</p><div className="total-orbit" aria-hidden="true" /></article><article className="clay-panel stat-panel"><span className="stat-icon purple"><ArrowUpRight size={20} aria-hidden="true" /></span><div><span className="label">Comparación</span><strong>{changePercentage === null ? "Nuevo" : `${changePercentage > 0 ? "+" : ""}${changePercentage}%`}</strong><p className="muted">{isAutomaticMonthView ? "vs. mes anterior" : "vs. periodo anterior"}</p></div></article><article className="clay-panel stat-panel"><span className="stat-icon peach"><Minus size={20} aria-hidden="true" /></span><div><span className="label">Categoría principal</span><strong>{topCategories[0]?.[0] ?? "—"}</strong><p className="muted">{topCategoryTotal ? formatCurrency(topCategoryTotal) : "Aún sin registros"}</p></div></article></section>
      <div className="chart-grid"><section className="clay-panel chart-panel" aria-labelledby="daily-chart-title"><div className="section-heading"><div><p className="eyebrow">Ritmo de gasto</p><h2 id="daily-chart-title">Evolución diaria</h2></div><span className="section-badge">{selectedRange.start.slice(5).replace("-", "/")} — {selectedRange.end.slice(5).replace("-", "/")}</span></div>{monthExpenses.length === 0 ? <EmptyState title="Sin gastos en este rango" text="Prueba otro periodo para ver la evolución." /> : <DailyExpenseChart dailyTotals={dailyTotals} total={monthTotal} expenses={monthExpenses.map((expense) => ({ id: expense.id, fecha_gasto: expense.fecha_gasto, monto: expense.monto, descripcion: expense.descripcion, categoria: categoryNames.get(expense.categoria_id ?? "") ?? "Otros" }))} />}</section><section className="clay-panel chart-panel" aria-labelledby="category-chart-title"><div className="section-heading"><div><p className="eyebrow">Distribución</p><h2 id="category-chart-title">Por categoría</h2></div><span className="section-badge">{categoryChartData.length} categorías</span></div>{categoryChartData.length === 0 ? <EmptyState title="Sin categorías en este rango" text="Prueba otro periodo para ver la distribución." /> : <CategoryExpenseChart categories={categoryChartData} />}</section></div>
      <div className="dashboard-columns"><section className="clay-panel categories-panel"><div className="section-heading"><div><p className="eyebrow">Dónde se va tu dinero</p><h2>Por categoría</h2></div><span className="section-badge">Este mes</span></div>{topCategories.length === 0 ? <EmptyState title="Todavía no hay categorías" text="Confirma tu primer gasto para ver el resumen." /> : <div className="category-list">{topCategories.map(([name, total], index) => { const categoryId = [...categoryNames.entries()].find(([, categoryName]) => categoryName === name)?.[0]; const budget = categoryId ? budgetsByCategory.get(categoryId) : undefined; const level = budget ? getBudgetLevel(total, budget) : getCategoryLevel(total, monthTotal); const label = budget ? getBudgetLevelLabel(level) : "Sin presupuesto"; const percentage = budget ? Math.round((total / budget) * 100) : Math.round((total / monthTotal) * 100); return <div className="category-item" key={name}><div className="category-line"><span className={`category-dot dot-${index + 1}`} /><span>{name}</span><strong>{formatCurrency(total)}</strong></div><div className="category-meta"><span className={`category-level ${budget ? `level-${level}` : "level-neutral"}`}><span />{label}</span><span>{percentage}%{budget ? ` de ${formatCurrency(budget)}` : ""}</span></div><div className="progress-track"><span className={`progress-fill fill-${index + 1} ${budget && level === "alta" ? "progress-over" : ""}`} style={{ width: `${Math.min(Math.max((total / (budget ?? topCategories[0]?.[1] ?? total)) * 100, 8), 100)}%` }} /></div></div>})}</div>}</section><section className="clay-panel history-panel"><div className="section-heading"><div><p className="eyebrow">Tu actividad</p><h2>Últimos gastos</h2></div><Link className="section-badge history-link" href="/historial">Ver todo →</Link></div>{expenses?.length === 0 ? <EmptyState title="Tu historial está vacío" text="Envía un gasto por WhatsApp y confírmalo para verlo aquí." /> : <div className="expense-list">{expenses?.slice(0, 8).map((expense) => { const category = categoryNames.get(expense.categoria_id ?? "") ?? "Otros"; return <article key={expense.id} className="expense-row"><span className="expense-avatar"><CategoryIcon category={category} size={19} /></span><div className="expense-details"><strong>{normalizeExpenseDescription(expense.descripcion ?? "")}</strong><span>{formatExpenseDate(expense.fecha_gasto)} · {category}</span></div><strong className="expense-amount">{formatCurrency(Number(expense.monto))}</strong></article>})}</div>}</section></div>
    </>}
  </main>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">✦</span><h3>{title}</h3><p className="muted">{text}</p></div>;
}
