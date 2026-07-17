import { describe, expect, it } from "vitest";
import { getAuthenticatedUserId } from "./claims";

describe("getAuthenticatedUserId", () => {
  it("returns the subject only for valid claims without an auth error", () => {
    expect(
      getAuthenticatedUserId({
        data: { claims: { sub: "00000000-0000-0000-0000-000000000032" } },
        error: null,
      }),
    ).toBe("00000000-0000-0000-0000-000000000032");
  });

  it("rejects missing or malformed subjects", () => {
    expect(
      getAuthenticatedUserId({ data: { claims: {} }, error: null }),
    ).toBeNull();
    expect(
      getAuthenticatedUserId({
        data: { claims: { sub: 32 } },
        error: null,
      }),
    ).toBeNull();
  });

  it("rejects claims when Supabase reports an auth error", () => {
    expect(
      getAuthenticatedUserId({
        data: { claims: { sub: "00000000-0000-0000-0000-000000000032" } },
        error: new Error("invalid token"),
      }),
    ).toBeNull();
  });
});
