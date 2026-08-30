import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ArrowLeft, Sparkles } from "lucide-react";
import { ExpenseHistoryRow } from "@/components/expense-history-row";
import { IncomeHistoryRow } from "@/components/income-history-row";

const filters = [
  { value: "todos", label: "Todos" },
  { value: "confirmado", label: "Confirmados" },
  { value: "pendiente_confirmacion", label: "Pendientes" },
  { value: "rechazado", label: "Rechazados" },
] as const;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const activeFilter = filters.some((filter) => filter.value === params.estado) ? params.estado! : "todos";
  let query = supabase.from("gastos").select("id, fecha_gasto, monto, descripcion, categoria_id, estado").eq("usuario_id", user.id).order("fecha_gasto", { ascending: false }).limit(100);
  if (activeFilter !== "todos") query = query.eq("estado", activeFilter);
  const { data: expenses } = await query;
  let incomeQuery = supabase.from("ingresos").select("id, fecha_ingreso, monto, descripcion, categoria_id, estado").eq("usuario_id", user.id).order("fecha_ingreso", { ascending: false }).limit(100);
  if (activeFilter !== "todos") incomeQuery = incomeQuery.eq("estado", activeFilter);
  const { data: incomes } = await incomeQuery;
  const { data: categories } = await supabase.from("categorias").select("id, nombre").eq("activa", true).order("nombre");
  const { data: incomeCategories } = await supabase.from("categorias_ingreso").select("id, nombre").eq("activa", true).order("nombre");
  const categoryNames = new Map((categories ?? []).map((category) => [category.id, category.nombre]));
  const incomeCategoryNames = new Map((incomeCategories ?? []).map((category) => [category.id, category.nombre]));

  return <main className="dashboard-shell"><header className="dashboard-header"><div><p className="brand-mark"><span className="brand-dot" /> moni</p><p className="eyebrow">Tu actividad</p><h1>Historial</h1><p className="muted">Revisa tus gastos e ingresos procesados por Moni.</p></div><div className="header-actions"><Link className="back-link" href="/dashboard"><ArrowLeft size={16} aria-hidden="true" /> Dashboard</Link><SignOutButton /></div></header><section className="clay-panel history-page-panel"><nav className="filter-nav" aria-label="Filtrar historial">{filters.map((filter) => <Link key={filter.value} className={`filter-link ${activeFilter === filter.value ? "is-active" : ""}`} href={filter.value === "todos" ? "/historial" : `/historial?estado=${filter.value}`}>{filter.label}</Link>)}</nav>{expenses?.length === 0 && incomes?.length === 0 ? <div className="empty-state"><span className="empty-mark" aria-hidden="true"><Sparkles size={20} /></span><h3>No hay movimientos en este filtro</h3><p className="muted">Registra un gasto o ingreso por WhatsApp para verlo aquí.</p></div> : <><div className="full-history-list">{expenses?.map((expense) => <ExpenseHistoryRow key={`expense-${expense.id}`} expense={expense} categoryName={categoryNames.get(expense.categoria_id ?? "") ?? "Otros"} categories={categories ?? []} />)}</div>{incomes?.length ? <><h2 className="history-subheading">Ingresos</h2><div className="full-history-list">{incomes.map((income) => <IncomeHistoryRow key={`income-${income.id}`} income={income} categoryName={incomeCategoryNames.get(income.categoria_id) ?? "Otros"} />)}</div></> : null}</>}</section></main>;
}
