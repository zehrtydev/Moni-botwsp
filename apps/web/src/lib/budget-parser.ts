import { parseAmountText, parseCategoryName } from "./expense-parser";
import { normalizeCommandText, normalizeMatchingText } from "./text-normalization";

const budgetCommandWords = ["mi", "presupuesto", "de", "para", "es", "otros"];

export function isBudgetCommand(text: string) {
  return /^(?:mi\s+)?presupuesto\b/i.test(normalizeCommandText(text, budgetCommandWords));
}

export const budgetCommandPattern = /^(?:mi\s+)?presupuesto\b/i;

export function parseBudgetCommand(text: string) {
  const matchingText = normalizeCommandText(text, budgetCommandWords);
  const amountMatch = text.match(/(?:\$?\s*)[0-9][0-9.\s]*(?:mil|k)?\s*$/i);
  if (!amountMatch || amountMatch.index === undefined) return null;
  const monto = parseAmountText(amountMatch[0]);
  if (!monto) return null;
  const categoryText = matchingText.slice(0, normalizeMatchingText(text.slice(0, amountMatch.index)).length).trim()
    .replace(/^(?:mi\s+)?presupuesto(?:\s+(?:de|para))?\s+/, "")
    .replace(/\s+(?:es|de)\s*$/i, "").trim();
  if (!categoryText) return null;
  const categoria = parseCategoryName(categoryText);
  if (categoria === "Otros" && !/\botros?\b/i.test(categoryText)) return null;
  return { monto, categoria };
}
