type DatedAmount = { fecha_gasto: string; monto: number | string | null };

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getDailyTotals(expenses: DatedAmount[], start: string, end: string) {
  const startDate = toUtcDate(start);
  const endDate = toUtcDate(end);
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    if (expense.fecha_gasto < start || expense.fecha_gasto > end) continue;
    totals.set(expense.fecha_gasto, (totals.get(expense.fecha_gasto) ?? 0) + Number(expense.monto ?? 0));
  }

  const days: { date: string; day: string; total: number }[] = [];
  for (let date = startDate; date <= endDate; date = new Date(date.getTime() + 86400000)) {
    const dateString = toDateString(date);
    days.push({ date: dateString, day: dateString.slice(8), total: totals.get(dateString) ?? 0 });
  }
  return days;
}

export function getChartMax(values: number[]) {
  return Math.max(...values, 0, 1);
}
