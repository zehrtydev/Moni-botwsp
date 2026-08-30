import { describe, expect, it } from "vitest";
import { getChartMax, getDailyTotals } from "./chart-insights";

describe("chart insights", () => {
  it("fills days without expenses with zero", () => {
    expect(getDailyTotals([{ fecha_gasto: "2026-08-02", monto: 15000 }], "2026-08-01", "2026-08-03")).toEqual([
      { date: "2026-08-01", day: "01", total: 0 },
      { date: "2026-08-02", day: "02", total: 15000 },
      { date: "2026-08-03", day: "03", total: 0 },
    ]);
  });

  it("groups multiple expenses from the same day", () => {
    expect(getDailyTotals([
      { fecha_gasto: "2026-08-02", monto: 15000 },
      { fecha_gasto: "2026-08-02", monto: "5000" },
    ], "2026-08-02", "2026-08-02")[0].total).toBe(20000);
  });

  it("keeps an empty chart usable", () => {
    expect(getChartMax([0, 0])).toBe(1);
  });
});
