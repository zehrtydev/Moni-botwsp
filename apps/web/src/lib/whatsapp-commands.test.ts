import { describe, expect, it } from "vitest";
import { isGreeting, isThanks, parseCorrectionCommand, parseExpenseQuery } from "./whatsapp-commands";

describe("WhatsApp commands", () => {
  it("recognizes friendly greetings without treating them as expenses", () => {
    expect(isGreeting("¡Holaaa! 👋")).toBe(true);
    expect(isGreeting("Holip")).toBe(true);
    expect(isGreeting("Holis")).toBe(true);
    expect(isGreeting("buenas tardes")).toBe(true);
    expect(isGreeting("hola, gasté 20 mil")).toBe(false);
  });

  it("recognizes thanks without treating them as expenses", () => {
    expect(isThanks("gracias 😊")).toBe(true);
    expect(isThanks("mil gracias")).toBe(true);
    expect(isThanks("gracias, gasté 20 mil")).toBe(false);
  });

  it("parses a correction amount", () => {
    expect(parseCorrectionCommand("Corrige el último gasto, eran 45 mil")).toEqual({ monto: 45000 });
  });

  it("parses a category correction", () => {
    expect(parseCorrectionCommand("Cambia la categoría del último gasto a Alimentación")).toEqual({ categoria: "Alimentación" });
  });

  it("parses spent and budget queries", () => {
    expect(parseExpenseQuery("¿Cuánto llevo gastado en alimentación?")).toEqual({ kind: "spent", categoria: "Alimentación" });
    expect(parseExpenseQuery("¿Cuánto presupuesto me queda para transporte?")).toEqual({ kind: "budget", categoria: "Transporte" });
  });

  it("tolerates common typos in correction and query commands", () => {
    expect(parseCorrectionCommand("Corrije el ultimo gasto, eran 45 mil")).toEqual({ monto: 45000 });
    expect(parseExpenseQuery("Quanto llevo gastado en alimentacion?")).toEqual({ kind: "spent", categoria: "Alimentación" });
  });

  it("parses lucas in correction commands", () => {
    expect(parseCorrectionCommand("Corrige el último gasto, eran 20 lucas")).toEqual({ monto: 20000 });
  });
});
