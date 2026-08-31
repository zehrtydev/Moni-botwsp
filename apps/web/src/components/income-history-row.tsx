"use client";

import { ArrowDownToLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatExpenseDate } from "@/lib/date-format";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export function IncomeHistoryRow({ income, categoryName }: { income: { id: string; fecha_ingreso: string; monto: number; descripcion: string; estado: string }; categoryName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`¿Eliminar ${income.descripcion}? Esta acción no se puede deshacer.`)) return;
    setDeleting(true); setError(null);
    try {
      const response = await fetch(`/api/incomes/${income.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo eliminar el ingreso.");
      router.refresh();
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "No se pudo eliminar el ingreso."); setDeleting(false); }
  }

  return <article className="full-expense-row income-history-row">{error && <p className="error history-row-error" role="alert">{error}</p>}<div className="expense-avatar income-avatar"><ArrowDownToLine size={19} /></div><div className="expense-details"><strong>{income.descripcion}</strong><span>{formatExpenseDate(income.fecha_ingreso)} · {categoryName}</span></div><div className="history-row-end"><strong className="income-amount">+{formatCurrency(Number(income.monto))}</strong><span className={`status-badge status-${income.estado}`}>{income.estado === "pendiente_confirmacion" ? "Pendiente" : income.estado[0].toUpperCase() + income.estado.slice(1)}</span></div><button type="button" className="icon-button delete-button" onClick={remove} disabled={deleting} aria-label={`Eliminar ${income.descripcion}`}><Trash2 size={16} aria-hidden="true" /></button></article>;
}
