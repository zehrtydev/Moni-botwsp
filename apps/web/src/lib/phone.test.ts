import { describe, expect, it } from "vitest";
import { normalizeE164 } from "./phone";

describe("normalizeE164", () => {
  it("accepts an E.164 Colombian number", () => {
    expect(normalizeE164("+573001234567")).toBe("+573001234567");
  });

  it("rejects a number without an international prefix", () => {
    expect(() => normalizeE164("3001234567")).toThrow("número");
  });

  it("rejects invalid E.164 characters", () => {
    expect(() => normalizeE164("+57 300 123 4567")).toThrow("número");
  });
});
