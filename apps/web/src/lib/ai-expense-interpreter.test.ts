import { describe, expect, it } from "vitest";
import { aiExpenseInterpretationSchema, getAIProviderConfig, toExpenseDraft } from "./ai-expense-interpreter";

describe("AI expense interpreter contract", () => {
  it("accepts only the structured expense contract", () => {
    const result = aiExpenseInterpretationSchema.parse({ intencion: "registrar_gasto", monto: 30000, categoria: "Alimentación", fecha_gasto: "2026-08-29", descripcion: "Comida fuera de casa", confianza: 0.9 });
    expect(toExpenseDraft(result, "2026-08-30")).toMatchObject({ monto: 30000, categoria: "Alimentación", fecha_gasto: "2026-08-29" });
  });

  it("does not create a draft from an unrecognized intent", () => {
    const result = aiExpenseInterpretationSchema.parse({ intencion: "no_reconocido", monto: null, categoria: null, fecha_gasto: null, descripcion: null, confianza: 0.2 });
    expect(toExpenseDraft(result, "2026-08-30")).toBeNull();
  });

  it("configures Ollama without requiring an API key", () => {
    expect(getAIProviderConfig({ AI_PROVIDER: "ollama" })).toMatchObject({
      provider: "ollama",
      apiKey: "ollama",
      baseURL: "http://127.0.0.1:11434/v1",
      model: "qwen3:1.7b",
    });
  });

  it("does not activate OpenAI with a placeholder key", () => {
    expect(getAIProviderConfig({ OPENAI_API_KEY: "replace-with-openai-api-key" })).toBeNull();
  });
});
