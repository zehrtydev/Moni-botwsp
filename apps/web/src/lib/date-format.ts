const TIME_ZONE = "America/Bogota";

function localDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00-05:00`);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function formatExpenseDate(value: string | null, referenceDate = new Date()) {
  if (!value) return "Sin fecha";
  const expenseDate = localDate(value);
  const today = localDate(referenceDate);
  const yesterdayDate = new Date(`${today}T12:00:00Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  if (expenseDate === today) return "Hoy";
  if (expenseDate === yesterday) return "Ayer";
  return new Intl.DateTimeFormat("es-CO", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00-05:00`));
}
