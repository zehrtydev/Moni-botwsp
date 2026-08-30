import { describe, expect, it } from "vitest";
import { parseBudgetCommand } from "./budget-parser";

describe("budget command parser", () => {
  it("reads category and mil notation", () => {
    expect(parseBudgetCommand("Presupuesto alimentación 500 mil")).toEqual({ monto: 500000, categoria: "Alimentación" });
  });

  it("accepts natural wording", () => {
    expect(parseBudgetCommand("Mi presupuesto de transporte es 250000")).toEqual({ monto: 250000, categoria: "Transporte" });
  });

  it("rejects unknown categories", () => {
    expect(parseBudgetCommand("Presupuesto marcianos 100 mil")).toBeNull();
  });

  it("maps phone plans to services", () => {
    expect(parseBudgetCommand("Presupuesto de plan celular 100 mil")).toEqual({ monto: 100000, categoria: "Servicios" });
  });

  it("tolerates missing accents and small typos in commands and categories", () => {
    expect(parseBudgetCommand("Presupesto alimntacion 500 mil")).toEqual({ monto: 500000, categoria: "Alimentación" });
    expect(parseBudgetCommand("Mi presupesto de trasporte es 250000")).toEqual({ monto: 250000, categoria: "Transporte" });
  });
});
