import { describe, expect, it } from "vitest";
import { buildExpenseProposal, correctionHelpMessages, correctionSuccessMessages, expenseNotUnderstoodMessages, greetingMessages, thanksMessages } from "./whatsapp-messages";

describe("WhatsApp response variants", () => {
  it("keeps three variants for each conversational response", () => {
    expect(greetingMessages).toHaveLength(3);
    expect(correctionSuccessMessages).toHaveLength(3);
    expect(correctionHelpMessages).toHaveLength(3);
    expect(expenseNotUnderstoodMessages).toHaveLength(3);
    expect(thanksMessages).toHaveLength(3);
  });

  it("builds a friendly expense proposal", () => {
    expect(buildExpenseProposal(25000, "Alimentación", "Almuerzo")).toMatch(/25\.000 COP/);
    expect(buildExpenseProposal(25000, "Alimentación", "Almuerzo")).toMatch(/Alimentación/);
    expect(buildExpenseProposal(25000, "Alimentación", "Almuerzo")).toMatch(/sí|correcto/i);
  });
});
