import { ArrowDownToLine } from "lucide-react";
import { formatExpenseDate } from "@/lib/date-format";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

export function IncomeHistoryRow({ income, categoryName }: { income: { fecha_ingreso: string; monto: number; descripcion: string; estado: string }; categoryName: string }) {
  return <article className="full-expense-row income-history-row"><div className="expense-avatar income-avatar"><ArrowDownToLine size={19} /></div><div className="expense-details"><strong>{income.descripcion}</strong><span>{formatExpenseDate(income.fecha_ingreso)} · {categoryName}</span></div><div className="history-row-end"><strong className="income-amount">+{formatCurrency(Number(income.monto))}</strong><span className={`status-badge status-${income.estado}`}>{income.estado === "pendiente_confirmacion" ? "Pendiente" : income.estado[0].toUpperCase() + income.estado.slice(1)}</span></div></article>;
}
