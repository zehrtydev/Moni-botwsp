import OpenAI from "openai";
import { z } from "zod";
import { expenseDraftSchema, normalizeExpenseDescription } from "./expense-parser";

const categories = ["Alimentación", "Transporte", "Vivienda", "Hogar", "Servicios", "Compras", "Salud", "Cuidado personal", "Educación", "Ocio", "Viajes", "Deudas", "Mascotas", "Familia y regalos", "Otros"] as const;

export const aiExpenseInterpretationSchema = z.object({
  intencion: z.enum(["registrar_gasto", "no_reconocido"]),
  monto: z.number().int().positive().nullable(),
  categoria: z.enum(categories).nullable(),
  fecha_gasto: z.string().date().nullable(),
  descripcion: z.string().min(1).max(500).nullable(),
  confianza: z.number().min(0).max(1),
});

const responseSchema = {
  type: "object",
  properties: {
    intencion: { type: "string", enum: ["registrar_gasto", "no_reconocido"] },
    monto: { type: ["integer", "null"] },
    categoria: { type: ["string", "null"], enum: [...categories, null] },
    fecha_gasto: { type: ["string", "null"] },
    descripcion: { type: ["string", "null"] },
    confianza: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["intencion", "monto", "categoria", "fecha_gasto", "descripcion", "confianza"],
  additionalProperties: false,
} as const;

export type AIExpenseResult = z.infer<typeof aiExpenseInterpretationSchema>;

export type AIProvider = "openai" | "ollama";

export function getAIProviderConfig(env: Record<string, string | undefined> = process.env) {
  const provider = env.AI_PROVIDER === "ollama" ? "ollama" : "openai" as AIProvider;
  const apiKey = env.AI_API_KEY ?? env.OPENAI_API_KEY;

  if (provider === "openai" && (!apiKey || apiKey.startsWith("replace-with-"))) return null;

  return {
    provider,
    apiKey: provider === "ollama" ? "ollama" : apiKey,
    baseURL: env.AI_BASE_URL ?? (provider === "ollama" ? "http://127.0.0.1:11434/v1" : undefined),
    model: env.AI_MODEL ?? env.OPENAI_MODEL ?? (provider === "ollama" ? "qwen3:1.7b" : "gpt-4o-mini"),
  };
}

export function toExpenseDraft(result: AIExpenseResult, fallbackDate: string) {
  if (result.intencion !== "registrar_gasto" || !result.monto || !result.categoria || !result.descripcion) return null;
  return expenseDraftSchema.parse({ monto: result.monto, categoria: result.categoria, descripcion: normalizeExpenseDescription(result.descripcion), fecha_gasto: result.fecha_gasto ?? fallbackDate });
}

export async function interpretExpenseWithAI(text: string, receivedAt: Date) {
  const config = getAIProviderConfig();
  if (!config || !text.trim() || text.length > 1000) return null;

  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, timeout: 8000, maxRetries: 0 });
  const fallbackDate = receivedAt.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const prompt = `Eres el intérprete de gastos de Moni. Devuelve exclusivamente el JSON solicitado. No ejecutes acciones ni inventes información. Interpreta solo mensajes que representen un gasto. Categorías válidas: ${categories.join(", ")}. Convierte expresiones colombianas como "lucas", "mil" o "k" a pesos COP. Resuelve "hoy" y "ayer" usando como fecha de referencia ${fallbackDate}. La descripcion debe ser únicamente el concepto breve del gasto, de 1 a 5 palabras, por ejemplo "Almuerzo", "Plan de celular" o "Gasolina"; nunca copies instrucciones, saludos ni la frase completa del usuario. Si falta el monto, la intención no es un gasto o hay ambigüedad importante, usa "no_reconocido" y valores nulos. La confianza debe reflejar la certeza real. Mensaje: ${text}`;

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "moni_expense_interpretation", strict: true, schema: responseSchema },
      },
      ...(config.provider === "ollama" ? { extra_body: { think: false, options: { num_predict: 256 } } } : {}),
    });
    const output = response.choices[0]?.message.content;
    if (!output) return null;
    const parsed = aiExpenseInterpretationSchema.safeParse(JSON.parse(output));
    if (!parsed.success) return null;
    const draft = toExpenseDraft(parsed.data, fallbackDate);
    return draft ? { draft, confianza: parsed.data.confianza } : null;
  } catch (error) {
    console.warn("ai_expense_interpretation_failed", error instanceof Error ? error.message : "unknown_error");
    return null;
  }
}
