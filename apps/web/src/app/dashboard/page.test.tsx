import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import DashboardPage from "./page";

afterEach(cleanup);

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { getClaims: mocks.getClaims },
    });
  });

  it("redirects an unauthenticated request to login", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: {} },
      error: new Error("missing session"),
    });

    await expect(DashboardPage()).resolves.toBeNull();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("renders a protected landing surface for a valid session", async () => {
    mocks.getClaims.mockResolvedValue({
      data: {
        claims: { sub: "00000000-0000-0000-0000-000000000032" },
      },
      error: null,
    });

    render(await DashboardPage());

    expect(
      screen.getByRole("heading", { name: "Tu espacio Moni" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sesion protegida")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cerrar sesion" }),
    ).toBeInTheDocument();
  });
});
