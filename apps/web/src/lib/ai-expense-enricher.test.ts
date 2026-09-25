import { describe, expect, it } from "vitest";
import {
  aiExpenseEnrichmentSchema,
  toEnrichedExpenseDraft,
} from "./ai-expense-enricher";

describe("AI expense enricher contract", () => {
  it("accepts a valid enrichment response", () => {
    expect(
      aiExpenseEnrichmentSchema.parse({
        categoria: "Alimentación",
        descripcion: "Corrientazo",
        confianza: 0.9,
      }),
    ).toEqual({
      categoria: "Alimentación",
      descripcion: "Corrientazo",
      confianza: 0.9,
    });
  });

  it("preserves deterministic amount and date", () => {
    const originalDraft = {
      monto: 12000,
      fecha_gasto: "2026-09-25",
      categoria: "Otros",
      descripcion: "Corrientazo",
    };

    const enriched = toEnrichedExpenseDraft(originalDraft, {
      categoria: "Alimentación",
      descripcion: "Corrientazo",
      confianza: 0.9,
    });

    expect(enriched).toEqual({
      monto: 12000,
      fecha_gasto: "2026-09-25",
      categoria: "Alimentación",
      descripcion: "Corrientazo",
    });
  });

  it("cannot inject amount or date through the enrichment contract", () => {
    const result = aiExpenseEnrichmentSchema.safeParse({
      categoria: "Alimentación",
      descripcion: "Corrientazo",
      confianza: 0.9,
      monto: 999999,
      fecha_gasto: "2030-01-01",
    });

    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.data).not.toHaveProperty("monto");
    expect(result.data).not.toHaveProperty("fecha_gasto");
  });
});
