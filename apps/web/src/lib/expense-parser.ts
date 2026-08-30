import { z } from "zod";
import { isCloseWord, normalizeMatchingText } from "./text-normalization";

export const expenseDraftSchema = z.object({
  monto: z.number().int().positive(),
  fecha_gasto: z.string().date(),
  categoria: z.string().min(1).max(100),
  descripcion: z.string().min(1).max(500),
});

const categoryKeywords: Record<string, string[]> = {
  Alimentación: ["alimentación", "alimentacion", "comida", "hamburguesa", "almuerzo", "desayuno", "cena", "restaurante", "mercado", "alimento", "bebida", "snack", "verdura"],
  Transporte: ["uber", "taxi", "bus", "gasolina", "transporte", "metro", "auto", "carro"],
  Vivienda: ["arriendo", "alquiler", "administración", "administracion", "apartamento"],
  Hogar: ["casa", "mueble", "limpieza", "reparación", "reparacion", "mantenimiento"],
  Servicios: ["internet", "luz", "agua", "teléfono", "telefono", "celular", "plan celular"],
  Compras: ["compré", "compre", "ropa", "compra", "electrónico", "electronico", "accesorio"],
  Salud: ["médico", "medico", "farmacia", "medicina", "salud", "consulta"],
  "Cuidado personal": ["belleza", "peluquería", "peluqueria", "maquillaje", "barbería", "barberia"],
  Educación: ["curso", "libro", "educación", "educacion", "matrícula", "matricula"],
  Ocio: ["cine", "juego", "ocio", "entretenimiento", "deporte", "social", "lotería", "loteria"],
  Viajes: ["viaje", "hotel", "vuelo", "pasaje", "turismo"],
  Deudas: ["deuda", "cuota", "préstamo", "prestamo", "crédito", "credito"],
  Mascotas: ["mascota", "perro", "gato", "veterinario"],
  "Familia y regalos": ["hijo", "hija", "familia", "regalo", "donación", "donacion"],
};

export function parseAmountText(text: string) {
  const suffixMatch = text.match(/(?:\$\s*)?([0-9][0-9.\s]*)\s*(mil|k|lucas?)\b/i);
  const plainMatch = text.match(/(?:\$\s*)?([0-9][0-9.\s]*)/i);
  const match = suffixMatch ?? plainMatch;
  if (!match) return null;
  const raw = match[1].replace(/[.\s]/g, "");
  const amount = Number(raw) * (suffixMatch ? 1000 : 1);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function parseCategoryName(text: string) {
  const normalized = normalizeMatchingText(text);
  const entries = Object.entries(categoryKeywords);
  const exactMatch = entries.find(([, keywords]) => keywords.some((keyword) => normalized.includes(normalizeMatchingText(keyword))));
  if (exactMatch) return exactMatch[0];

  const words = normalized.split(" ");
  const fuzzyMatch = entries.find(([, keywords]) => keywords.some((keyword) => {
    const normalizedKeyword = normalizeMatchingText(keyword);
    return !normalizedKeyword.includes(" ") && words.some((word) => isCloseWord(word, normalizedKeyword));
  }));
  return fuzzyMatch?.[0] ?? "Otros";
}

export function normalizeExpenseDescription(text: string) {
  let description = text.toLocaleLowerCase("es").trim();
  description = description.replace(/^(?:quiero\s+regist\w*\s+(?:un\s+)?gasto\s*[,\-:]?\s*)/i, "");
  description = description.replace(/^(?:acabo\s+(?:de\s+)?(?:comprar|pagar|gastar)\s+)/i, "");
  description = description.replace(/\s+y\s+me\s+(?:salio|salió|costo|costó)(?:\s.*)?$/i, "");
  description = description.replace(/^(?:gast[eé]|pagu[eé]|compr[eé]|gasto)\s+/i, "");
  description = description.replace(/^(?:un|una|el|la|los|las)\s+/i, "");
  description = description.replace(/(?:\$\s*)?[0-9][0-9.\s]*(?:mil|k|lucas?)?\b/gi, "");
  description = description.replace(/\s+(?:en|de|por)\s*$/i, "");
  description = description.replace(/^\s*(?:en|de|por)\s+/i, "").replace(/\s+(?:en|de|por)\s+/i, " ").trim();
  if (/^plan celular$/.test(description)) description = "plan de celular";
  if (!description) return "Gasto registrado por WhatsApp";
  return description.charAt(0).toLocaleUpperCase("es") + description.slice(1);
}

export function extractExpenseDraft(text: string, receivedAt = new Date()) {
  const monto = parseAmountText(text);
  if (!monto) return null;
  const descripcion = normalizeExpenseDescription(text).slice(0, 500);
  return expenseDraftSchema.parse({ monto, fecha_gasto: receivedAt.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }), categoria: parseCategoryName(text), descripcion });
}
