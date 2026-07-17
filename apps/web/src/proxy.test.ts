import { describe, expect, it, vi } from "vitest";

const updateSession = vi.hoisted(() => vi.fn());

vi.mock("./lib/supabase/proxy", () => ({ updateSession }));

import { config, proxy } from "./proxy";

describe("Next proxy", () => {
  it("delegates session refresh and excludes static assets", async () => {
    const request = { url: "https://moni.example/login" };
    const response = new Response(null, { status: 204 });
    updateSession.mockResolvedValue(response);

    await expect(proxy(request as never)).resolves.toBe(response);
    expect(updateSession).toHaveBeenCalledWith(request);
    expect(config.matcher[0]).toContain("_next/static");
  });
});
