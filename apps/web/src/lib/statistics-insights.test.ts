import { describe, expect, it } from "vitest";
import { getMonthlyNetTotals, getMonthlyTotals, getRecentMonthRanges } from "./statistics-insights";

describe("statistics insights", () => {
  it("creates the requested number of calendar months", () => {
    const months = getRecentMonthRanges(new Date("2026-08-30T12:00:00Z"), 6);
    expect(months[0].start).toBe("2026-03-01");
    expect(months.at(-1)?.start).toBe("2026-08-01");
  });

  it("groups confirmed amounts by month", () => {
    const months = getRecentMonthRanges(new Date("2026-08-30T12:00:00Z"), 2);
    expect(getMonthlyTotals([{ fecha_gasto: "2026-07-08", monto: 10000 }, { fecha_gasto: "2026-08-08", monto: "25000" }], months).map((month) => month.total)).toEqual([10000, 25000]);
  });
});

describe("monthly net totals", () => {
  it("subtracts confirmed expenses from confirmed income", () => {
    const months = [{ start: "2026-08-01", end: "2026-08-31", label: "ago" }];
    expect(getMonthlyNetTotals(
      [{ fecha_gasto: "2026-08-10", monto: 40000 }],
      [{ fecha_ingreso: "2026-08-05", monto: 100000 }],
      months,
    )).toEqual([{ month: "ago", start: "2026-08-01", total: 60000, income: 100000, expense: 40000 }]);
  });
});
