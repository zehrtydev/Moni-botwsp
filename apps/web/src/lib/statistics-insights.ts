type DatedAmount = { fecha_gasto: string; monto: number | string | null };
type DatedIncome = { fecha_ingreso: string; monto: number | string | null };

export function getRecentMonthRanges(reference = new Date(), count = 6) {
  const months: { start: string; end: string; label: string }[] = [];
  const current = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const startDate = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - offset, 1));
    const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0));
    const start = startDate.toISOString().slice(0, 10);
    const end = endDate.toISOString().slice(0, 10);
    months.push({ start, end, label: new Intl.DateTimeFormat("es-CO", { month: "short" }).format(startDate).replace(".", "") });
  }
  return months;
}

export function getMonthlyTotals(expenses: DatedAmount[], months: { start: string; end: string; label: string }[]) {
  return months.map((month) => ({
    month: month.label,
    start: month.start,
    total: expenses.filter((expense) => expense.fecha_gasto >= month.start && expense.fecha_gasto <= month.end).reduce((sum, expense) => sum + Number(expense.monto ?? 0), 0),
  }));
}

export function getMonthlyNetTotals(expenses: DatedAmount[], incomes: DatedIncome[], months: { start: string; end: string; label: string }[]) {
  return months.map((month) => {
    const expense = expenses.filter((item) => item.fecha_gasto >= month.start && item.fecha_gasto <= month.end).reduce((sum, item) => sum + Number(item.monto ?? 0), 0);
    const income = incomes.filter((item) => item.fecha_ingreso >= month.start && item.fecha_ingreso <= month.end).reduce((sum, item) => sum + Number(item.monto ?? 0), 0);
    return { month: month.label, start: month.start, total: income - expense, income, expense };
  });
}
