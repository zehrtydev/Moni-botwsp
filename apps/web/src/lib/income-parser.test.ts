import { describe, expect, it } from "vitest";
import { extractIncomeDraft } from "./income-parser";

describe("income parser", () => {
  it("classifies family transfers", () => {
    expect(extractIncomeDraft("Mi hermano me mandó 300 mil")).toMatchObject({ monto: 300000, categoria: "Ayuda familiar" });
  });

  it("classifies money deposited into a bank account as a transfer income", () => {
    expect(extractIncomeDraft("me ingresaron 600000 a la cuenta de Bancolombia")).toMatchObject({
      monto: 600000,
      categoria: "Transferencias",
    });
  });

  it.each([
    "recibí 100000",
    "me pagaron 100000",
    "me consignaron 100000",
    "me depositaron 100000",
    "me transfirieron 100000",
    "me abonaron 100000",
    "me giraron 100000",
    "me entraron 100000",
    "me devolvieron 100000",
    "me reembolsaron 100000",
    "me llegó 100000",
    "me mandaron 100000",
    "me enviaron 100000",
    "me dieron 100000",
    "me regalaron 100000",
    "me cayó 100000",
    "cobré 100000",
    "facturé 100000",
    "vendí 100000",
  ])("recognizes money received with the income synonym: %s", (text) => {
    expect(extractIncomeDraft(text)?.monto).toBe(100000);
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
