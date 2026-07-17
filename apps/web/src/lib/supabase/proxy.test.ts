import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { updateSession } from "./proxy";

describe("updateSession", () => {
  beforeEach(() => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://example.supabase.co",
    );
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_example",
    );
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    mocks.createServerClient.mockImplementation((_url, _key, options) => {
      expect(options.cookies.getAll()).toEqual([
        { name: "existing", value: "cookie" },
      ]);
      options.cookies.setAll(
        [
          {
            name: "session",
            value: "updated",
            options: { httpOnly: true, path: "/" },
          },
        ],
        { "cache-control": "private, no-store" },
      );

      return { auth: { getClaims: mocks.getClaims } };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("refreshes claims and propagates cookies and private headers", async () => {
    const request = new NextRequest("https://moni.example/login", {
      headers: { cookie: "existing=cookie" },
    });

    const response = await updateSession(request);

    expect(mocks.getClaims).toHaveBeenCalledOnce();
    expect(response.cookies.get("session")).toMatchObject({
      name: "session",
      value: "updated",
      httpOnly: true,
    });
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store",
    );
  });

  it("remains build-safe when public configuration is unavailable", async () => {
    vi.unstubAllEnvs();

    const response = await updateSession(
      new NextRequest("https://moni.example/login"),
    );

    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("does not turn a transient claim refresh failure into a site outage", async () => {
    mocks.getClaims.mockRejectedValue(new Error("temporary auth outage"));

    await expect(
      updateSession(new NextRequest("https://moni.example/login", {
        headers: { cookie: "existing=cookie" },
      })),
    ).resolves.toBeDefined();
  });
});
