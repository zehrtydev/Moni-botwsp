import OpenAI from "openai";
import { z } from "zod";
import {
  expenseDraftSchema,
  normalizeExpenseDescription,
} from "./expense-parser";
import {
  getAIProviderConfig,
  getOllamaNativeChatUrl,
} from "./ai-expense-interpreter";

const categories = [
  "Alimentación",
  "Transporte",
  "Vivienda",
  "Hogar",
  "Servicios",
  "Compras",
  "Salud",
  "Cuidado personal",
  "Educación",
  "Ocio",
  "Viajes",
  "Deudas",
  "Mascotas",
  "Familia y regalos",
  "Otros",
] as const;

export const aiExpenseEnrichmentSchema = z.object({
  categoria: z.enum(categories),
  descripcion: z.string().min(1).max(500),
  confianza: z.number().min(0).max(1),
});

const responseSchema = {
  type: "object",
  properties: {
    categoria: {
      type: "string",
      enum: categories,
    },
    descripcion: {
      type: "string",
    },
    confianza: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
  },
  required: ["categoria", "descripcion", "confianza"],
  additionalProperties: false,
} as const;

type ExpenseDraft = z.infer<typeof expenseDraftSchema>;
type AIExpenseEnrichment = z.infer<typeof aiExpenseEnrichmentSchema>;

export function toEnrichedExpenseDraft(
  draft: ExpenseDraft,
  enrichment: AIExpenseEnrichment,
) {
  return expenseDraftSchema.parse({
    ...draft,
    categoria: enrichment.categoria,
    descripcion: normalizeExpenseDescription(enrichment.descripcion),
  });
}

async function enrichWithOllama(
  baseURL: string,
  model: string,
  prompt: string,
) {
  const response = await fetch(getOllamaNativeChatUrl(baseURL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      think: false,
      stream: false,
      format: responseSchema,
      options: {
        num_predict: 64,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama respondió ${response.status}.`);
  }

  const payload = (await response.json()) as {
    message?: {
      content?: string;
    };
  };

  return payload.message?.content ?? null;
}

async function enrichWithOpenAI(
  apiKey: string,
  baseURL: string | undefined,
  model: string,
  prompt: string,
) {
  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: 15_000,
    maxRetries: 0,
  });

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "moni_expense_enrichment",
        strict: true,
        schema: responseSchema,
      },
    },
  });

  return response.choices[0]?.message.content ?? null;
}

export async function enrichExpenseDraftWithAI(
  text: string,
  draft: ExpenseDraft,
) {
  const config = getAIProviderConfig();

  if (!config || !text.trim() || text.length > 1000) {
    return null;
  }

  const prompt =
    `Clasifica un gasto personal colombiano. ` +
    `El sistema ya determinó correctamente que es un gasto, su monto y su fecha. ` +
    `No debes volver a interpretar ni modificar esos datos. ` +
    `Solo determina categoria, descripcion y confianza. ` +
    `Categorías válidas: ${categories.join(", ")}. ` +
    `Comprende expresiones y modismos colombianos. ` +
    `Por ejemplo: corrientazo es Alimentación, pasaje es Transporte y tinto es Alimentación. ` +
    `La descripcion debe tener entre 1 y 5 palabras, sin explicaciones ni paréntesis. ` +
    `Texto original: ${text}. ` +
    `Descripción base: ${draft.descripcion}.`;

  try {
    const output =
      config.provider === "ollama"
        ? await enrichWithOllama(
            config.baseURL ?? "http://127.0.0.1:11434/v1",
            config.model,
            prompt,
          )
        : await enrichWithOpenAI(
            config.apiKey!,
            config.baseURL,
            config.model,
            prompt,
          );

    if (!output) return null;

    const parsed = aiExpenseEnrichmentSchema.safeParse(
      JSON.parse(output),
    );

    if (!parsed.success) return null;

    return {
      draft: toEnrichedExpenseDraft(draft, parsed.data),
      confianza: parsed.data.confianza,
    };
  } catch (error) {
    console.warn(
      "ai_expense_enrichment_failed",
      error instanceof Error ? error.name : "unknown_error",
    );

    return null;
  }
}
