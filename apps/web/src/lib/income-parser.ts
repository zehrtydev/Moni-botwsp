import { z } from "zod";
import { normalizeMatchingText } from "./text-normalization";
import { parseAmountText } from "./expense-parser";

export const incomeDraftSchema = z.object({
  monto: z.number().int().positive(),
  fecha_ingreso: z.string().date(),
  categoria: z.string().min(1).max(100),
  descripcion: z.string().min(1).max(500),
});

const incomeCategories: Record<string, string[]> = {
  "Ayuda familiar": ["hermano", "hermana", "mama", "mamá", "papa", "papá", "familia", "ayuda", "me mandó", "me mando", "me envió", "me envio"],
  Trabajo: ["trabajo", "trabajé", "trabaje", "salario", "sueldo", "pago por trabajar", "jornal", "cliente"],
  Transferencias: ["transferencia", "consignaron", "consignación", "consignacion", "ingresaron", "depositaron", "transfirieron", "abonaron", "giraron", "entraron", "devolvieron", "reembolsaron", "bancolombia", "cuenta bancaria", "transferí", "transferi"],
  Casino: ["casino", "aposté", "aposte", "gané", "gane", "premio", "apuesta"],
};

const incomeIntentPatterns = [
  /\b(?:me\s+)?ingres(?:o|aron|e)\b/i,
  /\brecib(?:i|io|ieron|imos|iste)\b/i,
  /\bme\s+(?:pagaron|consign(?:o|aron)|depositaron|transfirieron|abonaron|giraron|entraron|devolvieron|reembolsaron|lleg[oó]|mand(?:o|aron)|envi(?:o|aron)|dieron|regalaron|cay[oó])\b/i,
  /\bme\s+hicieron\s+(?:una\s+)?transferencia\b/i,
  /\b(?:entrada|pago recibido|devolucion|reembolso|salario|sueldo|premio|casino|apuesta)\b/i,
  /\b(?:trabaj[eé]|gane|cobre|facture|vendi)\b/i,
];

function isIncomeIntent(text: string) {
  const normalized = normalizeMatchingText(text);
  return incomeIntentPatterns.some((pattern) => pattern.test(normalized));
}

function parseIncomeCategory(text: string) {
  const normalized = normalizeMatchingText(text);
  return Object.entries(incomeCategories).find(([, keywords]) => keywords.some((keyword) => normalized.includes(normalizeMatchingText(keyword))))?.[0] ?? "Otros";
}

function normalizeIncomeDescription(text: string) {
  let description = text.toLocaleLowerCase("es").trim();
  description = description.replace(/(?:me\s+)?(?:lleg[oó]|mand[oó]|envi[oó]|consignaron?|ingres(?:aron|o|é|e)|depositaron|transfirieron|abonaron|giraron|entraron|devolvieron|reembolsaron|dieron|regalaron|cay[oó])\s*/i, "");
  description = description.replace(/(?:recib[ií]|recibió|gan[eé]|trabaj[eé]|cobr[eé]|factur[eé]|vend[ií])\s*/i, "");
  description = description.replace(/(?:\$\s*)?[0-9][0-9.\s]*(?:mil|k|lucas?)?\b/gi, "");
  description = description.replace(/^\s*(?:a|en)\s+(?:la\s+)?/i, "");
  description = description.replace(/\s+(?:de|por|en)\s*$/i, "").trim();
  if (!description) return "Ingreso registrado por WhatsApp";
  return description.charAt(0).toLocaleUpperCase("es") + description.slice(1);
}

export function extractIncomeDraft(text: string, receivedAt = new Date()) {
  if (!isIncomeIntent(text)) return null;
  const monto = parseAmountText(text);
  if (!monto) return null;
  return incomeDraftSchema.parse({
    monto,
    fecha_ingreso: receivedAt.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
    categoria: parseIncomeCategory(text),
    descripcion: normalizeIncomeDescription(text),
  });
}
