import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  redirect: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { logoutAction } from "./actions";

describe("logoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { signOut: mocks.signOut },
    });
  });

  it("clears only the local session and returns to login", async () => {
    await logoutAction();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
