const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function isValidDateRange(start: string, end: string) {
  if (!datePattern.test(start) || !datePattern.test(end)) return false;
  const startDate = toUtcDate(start);
  const endDate = toUtcDate(end);
  return !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && start <= end;
}

export function getPreviousPeriod(start: string, end: string) {
  const startDate = toUtcDate(start);
  const endDate = toUtcDate(end);
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const previousEnd = new Date(startDate.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  return { start: toDateString(previousStart), end: toDateString(previousEnd) };
}

export function getPreviousMonthRange(monthStart: string) {
  const currentMonth = toUtcDate(`${monthStart.slice(0, 7)}-01`);
  const previousMonthEnd = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 0));
  const previousMonthStart = new Date(Date.UTC(previousMonthEnd.getUTCFullYear(), previousMonthEnd.getUTCMonth(), 1));
  return { start: toDateString(previousMonthStart), end: toDateString(previousMonthEnd) };
}

export function getChangePercentage(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}
