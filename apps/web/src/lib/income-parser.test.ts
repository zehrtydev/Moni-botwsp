import { describe, expect, it } from "vitest";
import { extractIncomeDraft } from "./income-parser";

describe("income parser", () => {
  it("classifies family transfers", () => {
    expect(extractIncomeDraft("Mi hermano me mandó 300 mil")).toMatchObject({ monto: 300000, categoria: "Ayuda familiar" });
  });

  it("classifies occasional work", () => {
    expect(extractIncomeDraft("Trabajé y recibí 150k")).toMatchObject({ monto: 150000, categoria: "Trabajo" });
  });

  it("classifies casino winnings", () => {
    expect(extractIncomeDraft("Gané 50 lucas en el casino")).toMatchObject({ monto: 50000, categoria: "Casino" });
  });

  it("does not interpret an ordinary expense as income", () => {
    expect(extractIncomeDraft("Gasté 20 mil en almuerzo")).toBeNull();
  });
});
