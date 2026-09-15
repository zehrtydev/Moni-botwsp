import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

describe("public landing", () => {
  beforeEach(() => getUser.mockReset());
  afterEach(cleanup);

  it("offers login and direct registration CTAs to visitors", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    render(await Home());

    expect(screen.getByRole("heading", { level: 1, name: "Tus gastos, registrados por WhatsApp." })).toBeInTheDocument();
    const navbar = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(within(navbar).getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
    expect(within(navbar).getByRole("link", { name: "Registrarse" })).toHaveAttribute("href", "/login?mode=register");
    const hero = screen.getByRole("region", { name: "Tus gastos, registrados por WhatsApp." });
    expect(within(hero).getByRole("link", { name: "Empezar ahora" })).toHaveAttribute("href", "/login?mode=register");
    const finalCta = screen.getByRole("region", { name: "Registrar tus gastos puede ser fácil." });
    expect(within(finalCta).getByRole("link", { name: "Empezar ahora" })).toHaveAttribute("href", "/login?mode=register");
  });

  it("links authenticated users to the dashboard without hiding the landing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    render(await Home());

    expect(screen.getByRole("heading", { level: 1, name: "Tus gastos, registrados por WhatsApp." })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Ir al dashboard" })).toHaveLength(3);
    screen.getAllByRole("link", { name: "Ir al dashboard" }).forEach((link) => expect(link).toHaveAttribute("href", "/dashboard"));
    expect(screen.queryByRole("link", { name: "Registrarse" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Empezar ahora" })).not.toBeInTheDocument();
  });

  it("shows the real text-based confirmation flow", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    render(await Home());

    expect(screen.getByText("1. Sí")).toBeInTheDocument();
    expect(screen.getByText("2. No")).toBeInTheDocument();
    expect(screen.getByText("Responde con 1 o 2, también puedes escribir Sí o No.")).toBeInTheDocument();
    expect(screen.queryByText("Confirmar")).not.toBeInTheDocument();
    expect(screen.queryByText("Corregir")).not.toBeInTheDocument();
  });
});
