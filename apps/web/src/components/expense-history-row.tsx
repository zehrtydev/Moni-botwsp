"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { CategoryIcon } from "@/components/category-icon";
import { formatExpenseDate } from "@/lib/date-format";

type Category = { id: string; nombre: string };
type Expense = { id: string; fecha_gasto: string | null; monto: number | null; descripcion: string | null; categoria_id: string | null; estado: string };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export function ExpenseHistoryRow({ expense, categoryName, categories }: { expense: Expense; categoryName: string; categories: Category[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ monto: String(expense.monto ?? ""), descripcion: expense.descripcion ?? "", fecha_gasto: expense.fecha_gasto ?? "", categoria_id: expense.categoria_id ?? categories[0]?.id ?? "" });

  async function save() {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/expenses/${expense.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, monto: Number(form.monto) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo actualizar el gasto.");
      setEditing(false); router.refresh();
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "No se pudo actualizar el gasto."); }
    finally { setSaving(false); }
  }

  if (editing) return <article className="expense-edit-row"><div className="edit-heading"><CategoryIcon category={categoryName} size={20} /><strong>Editar gasto</strong></div><div className="edit-grid"><label>Descripción<input value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></label><label>Monto<input type="number" min="1" step="1" value={form.monto} onChange={(event) => setForm({ ...form, monto: event.target.value })} /></label><label>Fecha<input type="date" value={form.fecha_gasto} onChange={(event) => setForm({ ...form, fecha_gasto: event.target.value })} /></label><label>Categoría<select value={form.categoria_id} onChange={(event) => setForm({ ...form, categoria_id: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label></div>{error && <p className="error" role="alert">{error}</p>}<div className="edit-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}><X size={16} aria-hidden="true" />Cancelar</button><button type="button" onClick={save} disabled={saving}><Check size={16} aria-hidden="true" />{saving ? "Guardando…" : "Guardar"}</button></div></article>;

  return <article className="full-expense-row"><div className="expense-avatar"><CategoryIcon category={categoryName} size={19} /></div><div className="expense-details"><strong>{expense.descripcion ?? "Gasto sin descripción"}</strong><span>{formatExpenseDate(expense.fecha_gasto)} · {categoryName}</span></div><div className="history-row-end"><strong>{expense.monto ? formatCurrency(Number(expense.monto)) : "—"}</strong><span className={`status-badge status-${expense.estado}`}>{expense.estado === "pendiente_confirmacion" ? "Pendiente" : expense.estado[0].toUpperCase() + expense.estado.slice(1)}</span></div><button type="button" className="icon-button" onClick={() => setEditing(true)} aria-label={`Editar ${expense.descripcion ?? "gasto"}`}><Pencil size={16} aria-hidden="true" /></button></article>;
}
