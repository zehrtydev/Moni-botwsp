import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  processLoginForm: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("../../features/auth/login-flow", () => ({
  processLoginForm: mocks.processLoginForm,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { loginAction } from "./actions";

const phoneState = {
  step: "phone" as const,
  phone: "",
  message: "",
  tone: "idle" as const,
};

describe("loginAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: {} });
  });

  it("creates the request-scoped server client and returns non-auth state", async () => {
    const nextState = { ...phoneState, message: "validation" };
    const data = new FormData();
    mocks.processLoginForm.mockResolvedValue(nextState);

    await expect(loginAction(phoneState, data)).resolves.toEqual(nextState);
    expect(mocks.createServerSupabaseClient).toHaveBeenCalledOnce();
    expect(mocks.processLoginForm).toHaveBeenCalledWith(
      { auth: {} },
      phoneState,
      data,
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects only after the flow reports authenticated", async () => {
    mocks.processLoginForm.mockResolvedValue({
      step: "authenticated",
      phone: "+573001234567",
      message: "",
      tone: "success",
    });

    await loginAction(phoneState, new FormData());

    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("returns a safe state if server configuration fails", async () => {
    mocks.createServerSupabaseClient.mockRejectedValue(
      new Error("private environment detail"),
    );

    await expect(
      loginAction(phoneState, new FormData()),
    ).resolves.toEqual({
      ...phoneState,
      message: "No pudimos iniciar el acceso. Intenta nuevamente.",
      tone: "error",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
