import { describe, expect, it } from "vitest";
import { getCategoryLevel, getCategoryLevelLabel } from "./category-insights";

describe("category insights", () => {
  it("classifies category participation in the monthly total", () => {
    expect(getCategoryLevel(600, 1000)).toBe("alta");
    expect(getCategoryLevel(300, 1000)).toBe("media");
    expect(getCategoryLevel(200, 1000)).toBe("baja");
  });

  it("provides a human label for the dashboard", () => {
    expect(getCategoryLevelLabel("media")).toBe("Participación media");
  });
});
