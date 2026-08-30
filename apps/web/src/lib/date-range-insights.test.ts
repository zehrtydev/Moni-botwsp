import { describe, expect, it } from "vitest";
import { getChangePercentage, getPreviousMonthRange, getPreviousPeriod, isValidDateRange } from "./date-range-insights";

describe("date range insights", () => {
  it("validates a date range", () => {
    expect(isValidDateRange("2026-08-01", "2026-08-30")).toBe(true);
    expect(isValidDateRange("2026-08-30", "2026-08-01")).toBe(false);
  });

  it("creates the equivalent previous period", () => {
    expect(getPreviousPeriod("2026-08-01", "2026-08-30")).toEqual({ start: "2026-07-02", end: "2026-07-31" });
  });

  it("creates the full previous calendar month", () => {
    expect(getPreviousMonthRange("2026-08-01")).toEqual({ start: "2026-07-01", end: "2026-07-31" });
  });

  it("calculates a safe comparison percentage", () => {
    expect(getChangePercentage(120, 100)).toBe(20);
    expect(getChangePercentage(100, 0)).toBeNull();
  });
});
