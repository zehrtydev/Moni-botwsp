export interface TextExpenseExtraction {
  monto: number | null;
  fecha_gasto: string;
  categoria: string;
  descripcion: string | null;
  metodo_pago: null;
  confianza: number;
}

const amountPattern =
  /(?<![\d.,])(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+)(?:\s*(mil))?(?![\d.,])/i;

const categoryRules = [
  {
    category: "Alimentación",
    pattern:
      /\b(almuerzo|cena|desayuno|comida|mercado|restaurante|hamburguesa)\b/i,
  },
  {
    category: "Transporte",
    pattern: /\b(uber|taxi|bus|transporte|gasolina|parqueadero)\b/i,
  },
  {
    category: "Hogar",
    pattern: /\b(arriendo|hogar|mueble|ferreter[ií]a)\b/i,
  },
  {
    category: "Salud",
    pattern: /\b(salud|m[eé]dico|farmacia|medicina)\b/i,
  },
  {
    category: "Servicios",
    pattern: /\b(internet|energ[ií]a|agua|gas|celular|servicio)\b/i,
  },
] as const;

function bogotaDate(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha de recepcion no es valida.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Bogota",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function shiftedIsoDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function expenseDate(text: string, receivedAt: string) {
  const receivedDate = bogotaDate(receivedAt);

  return /\bayer\b/i.test(text)
    ? shiftedIsoDate(receivedDate, -1)
    : receivedDate;
}

function parsedAmount(match: RegExpMatchArray | null) {
  if (!match) return null;

  const digits = match[1].replace(/[.,]/g, "");
  const multiplier = match[2] ? 1_000 : 1;
  const amount = Number(digits) * multiplier;

  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error("El monto no es valido.");
  }

  return amount;
}

export function extractTextExpense(
  originalText: string,
  receivedAt: string,
): TextExpenseExtraction {
  const text = originalText.trim().replace(/\s+/g, " ");

  if (text.length < 1 || text.length > 4_000) {
    throw new Error("El texto del gasto no es valido.");
  }

  const amountMatch = text.match(amountPattern);
  const amount = parsedAmount(amountMatch);
  const description = amountMatch
    ? `${text.slice(0, amountMatch.index)} ${
      text.slice((amountMatch.index ?? 0) + amountMatch[0].length)
    }`
      .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
      .replace(/\s+/g, " ")
    : text;
  const category = categoryRules.find((rule) => rule.pattern.test(text));

  return {
    monto: amount,
    fecha_gasto: expenseDate(text, receivedAt),
    categoria: category?.category ?? "Otros",
    descripcion: description || null,
    metodo_pago: null,
    confianza: amount === null ? 0.6 : category ? 0.9 : 0.75,
  };
}
