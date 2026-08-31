import { describe, expect, it } from "vitest";
import { extractExpenseDraft, normalizeExpenseDescription } from "./expense-parser";

describe("expense message parser", () => {
  it("converts mil notation and detects the category", () => {
    const draft = extractExpenseDraft("Gasté 20 mil en una hamburguesa", new Date("2026-08-30T15:00:00Z"));

    expect(draft).toMatchObject({
      monto: 20000,
      categoria: "Alimentación",
      fecha_gasto: "2026-08-30",
    });
  });

  it("returns null when the message has no amount", () => {
    expect(extractExpenseDraft("Hoy fui al cine")).toBeNull();
  });

  it.each([
    ["Pagué 25 mil de almuerzo", "Almuerzo"],
    ["Me cobraron 45 mil por internet", "Internet"],
    ["Me costó 18 mil el taxi", "Taxi"],
    ["Cancelé 12 mil de transporte", "Transporte"],
    ["Desembolsé 50 mil para un curso", "Curso"],
    ["Consumí 20 mil en restaurante", "Restaurante"],
    ["Adquirí 80 mil de ropa", "Ropa"],
    ["Recargué 10 mil de celular", "Celular"],
  ])("recognizes a common expense synonym: %s", (text, description) => {
    expect(extractExpenseDraft(text)?.descripcion).toBe(description);
  });

  it("accepts mil without a space", () => {
    expect(extractExpenseDraft("Gaste 20mil en gasolina")?.monto).toBe(20000);
  });

  it("converts Colombian lucas notation to pesos", () => {
    expect(extractExpenseDraft("Ayer pagué 20 lucas de comida con mi mamá")?.monto).toBe(20000);
  });

  it("creates a clean human description", () => {
    expect(normalizeExpenseDescription("35000 en plan celular")).toBe("Plan de celular");
    expect(normalizeExpenseDescription("un almuerzo de 15 mil")).toBe("Almuerzo");
    expect(normalizeExpenseDescription("Quiero registrar un gasto, acabo de comprar el almuerzo y me salió")).toBe("Almuerzo");
    expect(normalizeExpenseDescription("Quiero registar un gasto, acabo comprar el almuerzo y me salio por 25k")).toBe("Almuerzo");
  });

  it("uses the consolidated category catalog", () => {
    expect(extractExpenseDraft("35000 en plan celular")?.categoria).toBe("Servicios");
    expect(extractExpenseDraft("15 mil de peluquería")?.categoria).toBe("Cuidado personal");
    expect(extractExpenseDraft("80 mil de arriendo")?.categoria).toBe("Vivienda");
    expect(extractExpenseDraft("30 mil para mi perro")?.categoria).toBe("Mascotas");
  });

  it("tolerates a small category typo without changing the description", () => {
    expect(extractExpenseDraft("35000 en trasporte")?.categoria).toBe("Transporte");
    expect(normalizeExpenseDescription("35000 en trasporte")).toBe("Trasporte");
  });
});
