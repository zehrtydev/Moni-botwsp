import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  loadDashboardData: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../features/dashboard/dashboard-data", () => ({
  loadDashboardData: mocks.loadDashboardData,
}));

import DashboardPage from "./page";

afterEach(cleanup);

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { getClaims: mocks.getClaims },
    });
    mocks.loadDashboardData.mockResolvedValue({
      profile: { name: "Manuel", phone: "+573001234567" },
      summary: { count: 1, totalAmount: 28500 },
      expenses: [
        {
          id: "00000000-0000-4000-8000-000000000099",
          date: "2026-07-16",
          amount: 28500,
          currency: "COP",
          description: "Almuerzo",
          category: "Alimentacion",
        },
      ],
    });
  });

  it("redirects an unauthenticated request to login", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: {} },
      error: new Error("missing session"),
    });

    await expect(DashboardPage()).resolves.toBeNull();
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.loadDashboardData).not.toHaveBeenCalled();
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
    const sessionCard = screen.getByText("Sesion protegida").parentElement;
    expect(sessionCard).toHaveTextContent("Hola, Manuel");
    expect(screen.getByText("+573001234567")).toBeInTheDocument();
    const expenseCard = screen.getByText("Almuerzo").closest("article");
    expect(expenseCard).toHaveTextContent("Alimentacion");
    expect(screen.getByText("Total confirmado")).toBeInTheDocument();
    expect(screen.getAllByText("$ 28.500")).toHaveLength(2);
    expect(mocks.loadDashboardData).toHaveBeenCalledWith(
      expect.objectContaining({ auth: expect.any(Object) }),
      "00000000-0000-0000-0000-000000000032",
    );
    expect(
      screen.getByRole("button", { name: "Cerrar sesion" }),
    ).toBeInTheDocument();
  });
});
