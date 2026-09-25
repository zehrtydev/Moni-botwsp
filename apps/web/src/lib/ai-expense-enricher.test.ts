import { describe, expect, it } from "vitest";
import {
  aiExpenseEnrichmentSchema,
  toEnrichedExpenseDraft,
} from "./ai-expense-enricher";

describe("AI expense enricher contract", () => {
  it("accepts category and description", () => {
    expect(
      aiExpenseEnrichmentSchema.parse({
        categoria: "Alimentación",
        descripcion: "Corrientazo",
      }),
    ).toEqual({
      categoria: "Alimentación",
      descripcion: "Corrientazo",
    });
  });

  it("preserves deterministic amount and date", () => {
    const originalDraft = {
      monto: 12000,
      fecha_gasto: "2026-09-25",
      categoria: "Otros",
      descripcion: "Me gasté un corrientazo",
    };

    const enriched = toEnrichedExpenseDraft(originalDraft, {
      categoria: "Alimentación",
      descripcion: "Corrientazo",
    });

    expect(enriched).toEqual({
      monto: 12000,
      fecha_gasto: "2026-09-25",
      categoria: "Alimentación",
      descripcion: "Corrientazo",
    });
  });

  it("strips fields that AI is not allowed to control", () => {
    const result = aiExpenseEnrichmentSchema.parse({
      categoria: "Alimentación",
      descripcion: "Corrientazo",
      confianza: 5,
      monto: 999999,
      fecha_gasto: "2030-01-01",
    });

    expect(result).toEqual({
      categoria: "Alimentación",
      descripcion: "Corrientazo",
    });

    expect(result).not.toHaveProperty("confianza");
    expect(result).not.toHaveProperty("monto");
    expect(result).not.toHaveProperty("fecha_gasto");
  });
});
