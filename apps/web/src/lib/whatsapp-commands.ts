import { parseAmountText, parseCategoryName } from "./expense-parser";
import { isCloseWord, levenshteinDistance, normalizeCommandText, normalizeMatchingText } from "./text-normalization";

const commandWords = ["corrige", "corregir", "actualiza", "cambia", "cuanto", "resumen", "gasto", "presupuesto", "llevo", "gastado", "queda", "resta"];

export const correctionCommandPattern = /^(?:corrige|corregir|actualiza|cambia)\b/i;
export const queryCommandPattern = /^(?:cuanto|resumen|gasto|presupuesto)\b/i;

export function isGreeting(text: string) {
  const normalized = normalizeMatchingText(text).replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  if (/^(?:hola+|holi+|holis|hey+|ey+|hello|buenas|buenos dias|buenas tardes|buenas noches|que tal|como estas)$/.test(normalized)) return true;

  const words = normalized.split(" ");
  if (words.length !== 1 || !/^hol/.test(words[0]) || words[0].length > 7) return false;
  return isCloseWord(words[0], "hola") || levenshteinDistance(words[0], "hola") <= 2;
}

export function isThanks(text: string) {
  const normalized = normalizeMatchingText(text).replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  return /^(?:gracias+|muchas gracias|mil gracias|te agradezco|grax+|grx)$/.test(normalized);
}

export function isCorrectionCommand(text: string) {
  return correctionCommandPattern.test(normalizeCommandText(text, commandWords));
}

export function parseCorrectionCommand(text: string) {
  const matchingText = normalizeCommandText(text, commandWords);
  if (!correctionCommandPattern.test(matchingText)) return null;
  const categoryMatch = matchingText.match(/categoria\b.*?\b(?:a|por)\s+(.+)$/i);
  if (categoryMatch) {
    const categoria = parseCategoryName(categoryMatch[1]);
    return categoria === "Otros" && !/\botros?\b/i.test(categoryMatch[1]) ? { invalid: true as const } : { categoria };
  }
  const amountMatch = text.match(/(?:\$?\s*)[0-9][0-9.\s]*(?:mil|k|lucas?)?\s*$/i);
  if (!amountMatch) return { invalid: true as const };
  const monto = parseAmountText(amountMatch[0]);
  return monto ? { monto } : { invalid: true as const };
}

export function parseExpenseQuery(text: string) {
  const normalized = normalizeCommandText(text, commandWords);
  if (/presupuesto/.test(normalized) && /cuanto|queda|resta/.test(normalized)) {
    const categoryText = normalized.replace(/^.*?(?:en|de|para)\s+/, "").trim();
    if (!categoryText || categoryText === text.trim()) return { kind: "budget" as const };
    const categoria = parseCategoryName(categoryText.replace(/[?¿!]$/g, ""));
    return categoria === "Otros" ? { kind: "invalid" as const } : { kind: "budget" as const, categoria };
  }
  if (/cuanto llevo|resumen del mes|gastos de este mes/.test(normalized)) {
    const categoryMatch = normalized.match(/(?:en|de)\s+(.+?)$/i);
    if (!categoryMatch) return { kind: "spent" as const };
    const categoria = parseCategoryName(categoryMatch[1].replace(/[?¿!]$/g, ""));
    return categoria === "Otros" ? { kind: "invalid" as const } : { kind: "spent" as const, categoria };
  }
  return null;
}
