import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

describe("public landing", () => {
  beforeEach(() => getUser.mockReset());
  afterEach(cleanup);

  it("shows the approved public landing and login CTAs to visitors", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    render(await Home());

    expect(screen.getByRole("heading", { level: 1, name: "Tus gastos, registrados por WhatsApp." })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Iniciar sesión" })).toHaveLength(3);
    screen.getAllByRole("link", { name: "Iniciar sesión" }).forEach((link) => expect(link).toHaveAttribute("href", "/login"));
    expect(screen.queryByText(/crear cuenta|registrarse|comenzar gratis/i)).not.toBeInTheDocument();
  });

  it("links authenticated users to the dashboard without hiding the landing", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    render(await Home());

    expect(screen.getByRole("heading", { level: 1, name: "Tus gastos, registrados por WhatsApp." })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Ir al dashboard" })).toHaveLength(3);
    screen.getAllByRole("link", { name: "Ir al dashboard" }).forEach((link) => expect(link).toHaveAttribute("href", "/dashboard"));
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
