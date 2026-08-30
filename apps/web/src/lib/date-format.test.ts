import { describe, expect, it } from "vitest";
import { formatExpenseDate } from "./date-format";

describe("expense date format", () => {
  it("uses relative labels for recent dates", () => {
    const reference = new Date("2026-08-30T15:00:00-05:00");
    expect(formatExpenseDate("2026-08-30", reference)).toBe("Hoy");
    expect(formatExpenseDate("2026-08-29", reference)).toBe("Ayer");
  });

  it("uses a readable long date for older expenses", () => {
    expect(formatExpenseDate("2026-08-01", new Date("2026-08-30T15:00:00-05:00"))).toContain("1 de agosto de 2026");
  });
});
