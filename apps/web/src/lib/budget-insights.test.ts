import { describe, expect, it } from "vitest";
import { getBudgetLevel, getBudgetLevelLabel } from "./budget-insights";

describe("budget insights", () => {
  it("classifies spending against a budget", () => {
    expect(getBudgetLevel(300, 1000)).toBe("baja");
    expect(getBudgetLevel(700, 1000)).toBe("media");
    expect(getBudgetLevel(1100, 1000)).toBe("alta");
  });

  it("provides a clear label", () => {
    expect(getBudgetLevelLabel("alta")).toBe("Límite superado");
  });
});
