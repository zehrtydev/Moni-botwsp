import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const { getUser, redirect } = vi.hoisted(() => ({ getUser: vi.fn(), redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));
vi.mock("@/components/login-form", () => ({ LoginForm: () => <form aria-label="Formulario de acceso" /> }));

describe("login page", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockReset();
  });

  it("renders the login form for visitors", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    render(await LoginPage());

    expect(screen.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Formulario de acceso" })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects authenticated users to the dashboard on the server", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });

    await expect(LoginPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
