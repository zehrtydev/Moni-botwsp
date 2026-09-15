import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const { getUser, redirect } = vi.hoisted(() => ({ getUser: vi.fn(), redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));
vi.mock("@/components/login-form", () => ({
  LoginForm: ({ initialMode = "login" }: { initialMode?: "login" | "register" }) => {
    const registering = initialMode === "register";
    return <>
      <p>{registering ? "Empieza con Moni" : "Qué bueno verte"}</p>
      <h1>{registering ? "Crea tu cuenta" : "Iniciar sesión"}</h1>
      <p>{registering ? "Empieza a organizar tus gastos con Moni." : "Entra para revisar tus movimientos, estadísticas y presupuestos."}</p>
      <form aria-label={registering ? "Formulario de registro" : "Formulario de acceso"} />
    </>;
  },
}));

describe("login page", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockReset();
  });

  it("renders the login form for visitors", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Qué bueno verte")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.getByText("Entra para revisar tus movimientos, estadísticas y presupuestos.")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Formulario de acceso" })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("renders the registration heading and initializes the registration form from the query", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    render(await LoginPage({ searchParams: Promise.resolve({ mode: "register" }) }));

    expect(screen.getByText("Empieza con Moni")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Crea tu cuenta" })).toBeInTheDocument();
    expect(screen.getByText("Empieza a organizar tus gastos con Moni.")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Formulario de registro" })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects authenticated users to the dashboard on the server", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });

    await expect(LoginPage({ searchParams: Promise.resolve({ mode: "register" }) })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
