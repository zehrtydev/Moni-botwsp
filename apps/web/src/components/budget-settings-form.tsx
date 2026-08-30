"use client";

import { useState } from "react";
import { Check, PiggyBank } from "lucide-react";
import { useRouter } from "next/navigation";

type Category = { id: string; nombre: string };
type Budget = { categoria_id: string; monto_limite: number };

export function BudgetSettingsForm({ categories, budgets, month }: { categories: Category[]; budgets: Budget[]; month: string }) {
  const router = useRouter();
  const initial = new Map(budgets.map((budget) => [budget.categoria_id, String(budget.monto_limite)]));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(categories.map((category) => [category.id, initial.get(category.id) ?? ""] )));
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(categoryId: string) {
    const amount = Number(values[categoryId]);
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    setSaving(categoryId); setMessage(null);
    const response = await fetch("/api/budgets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoria_id: categoryId, mes: month, monto_limite: amount }) });
    const result = await response.json();
    setSaving(null);
    if (!response.ok) { setMessage(result.error ?? "No se pudo guardar"); return; }
    setMessage("Presupuesto guardado"); router.refresh();
  }

  return <div className="budget-settings-list">{categories.filter((category) => category.nombre !== "Otros").map((category) => <div className="budget-setting-row" key={category.id}><span className="budget-category-icon"><PiggyBank size={18} aria-hidden="true" /></span><div className="budget-category-name"><strong>{category.nombre}</strong><span>Tope mensual</span></div><div className="budget-input-wrap"><span>$</span><input type="number" min="1" step="1000" placeholder="Sin límite" value={values[category.id]} onChange={(event) => setValues({ ...values, [category.id]: event.target.value })} aria-label={`Presupuesto de ${category.nombre}`} /><button type="button" className="budget-save-button" disabled={saving === category.id || !values[category.id]} onClick={() => save(category.id)} aria-label={`Guardar presupuesto de ${category.nombre}`}><Check size={16} aria-hidden="true" /></button></div></div>)}{message && <p className="success-message" role="status">{message}</p>}</div>;
}
