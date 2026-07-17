import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

describe("createServerSupabaseClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://example.supabase.co",
    );
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_example",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it(
    "can be imported without reading environment variables",
    async () => {
      vi.unstubAllEnvs();

      await expect(import("./server")).resolves.toHaveProperty(
        "createServerSupabaseClient",
      );
      expect(mocks.createServerClient).not.toHaveBeenCalled();
    },
    15_000,
  );

  it("awaits Next cookies and wires reads and writes into Supabase SSR", async () => {
    const cookieStore = {
      getAll: vi.fn().mockReturnValue([
        { name: "existing", value: "cookie" },
      ]),
      set: vi.fn(),
    };
    const client = { auth: {} };
    mocks.cookies.mockResolvedValue(cookieStore);
    mocks.createServerClient.mockReturnValue(client);
    const { createServerSupabaseClient } = await import("./server");

    await expect(createServerSupabaseClient()).resolves.toBe(client);
    expect(mocks.cookies).toHaveBeenCalledOnce();
    expect(mocks.createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_example",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );

    const options = mocks.createServerClient.mock.calls[0][2];
    expect(options.cookies.getAll()).toEqual([
      { name: "existing", value: "cookie" },
    ]);
    options.cookies.setAll([
      { name: "session", value: "updated", options: { httpOnly: true } },
    ]);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "session",
      "updated",
      { httpOnly: true },
    );
  });
});
