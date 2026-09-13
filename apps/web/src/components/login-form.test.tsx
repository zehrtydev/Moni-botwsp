import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const { replace, refresh, signInWithPassword } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
}));

describe("LoginForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    signInWithPassword.mockReset();
  });

  it("signs in and opens the dashboard without exposing signup", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm />);

    expect(screen.queryByText(/crear una cuenta|registrarse/i)).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Correo electrónico" }), "moni@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "secreto1");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(signInWithPassword).toHaveBeenCalledWith({ email: "moni@example.com", password: "secreto1" });
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an invalid credentials error and keeps the form usable", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    render(<LoginForm />);

    const emailInput = screen.getByRole("textbox", { name: "Correo electrónico" });
    const passwordInput = screen.getByLabelText("Contraseña");
    const submitButton = screen.getByRole("button", { name: "Entrar" });

    await user.type(emailInput, "moni@example.com");
    await user.type(passwordInput, "incorrecta");
    await user.click(submitButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("El correo o la contraseña no son correctos.");
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(emailInput).toBeEnabled();
    expect(passwordInput).toBeEnabled();
    expect(submitButton).toBeEnabled();

    await user.clear(passwordInput);
    await user.type(passwordInput, "otro-intento");
    expect(passwordInput).toHaveValue("otro-intento");
  });
});
