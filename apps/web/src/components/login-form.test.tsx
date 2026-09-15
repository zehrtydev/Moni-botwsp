import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import { getSignupSuccessMessage } from "@/lib/auth-error";

const { replace, refresh, signInWithPassword, signUp } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword, signUp } }),
}));

describe("LoginForm", () => {
  afterEach(cleanup);

  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    signInWithPassword.mockReset();
    signUp.mockReset();
  });

  it("signs in with the existing flow and opens the dashboard", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText("Contraseña");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    await user.type(screen.getByRole("textbox", { name: "Correo electrónico" }), "moni@example.com");
    await user.type(passwordInput, "secreto1");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(signInWithPassword).toHaveBeenCalledWith({ email: "moni@example.com", password: "secreto1" });
    expect(signUp).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the public registration fields and action", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByRole("textbox", { name: "Correo electrónico" });
    const passwordInput = screen.getByLabelText("Contraseña");
    await user.type(emailInput, "moni@example.com");
    await user.type(passwordInput, "secreto1");
    await user.click(screen.getByRole("button", { name: "Crear una cuenta" }));

    expect(screen.getByRole("form", { name: "Formulario de registro" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("autocomplete", "name");
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("maxlength", "100");
    expect(emailInput).toHaveAttribute("autocomplete", "email");
    expect(emailInput).toHaveValue("moni@example.com");
    expect(passwordInput).toHaveAttribute("autocomplete", "new-password");
    expect(passwordInput).toHaveValue("secreto1");
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();
  });

  it("signs up with a trimmed name and opens the dashboard when a session exists", async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({ data: { session: { access_token: "test-token" } }, error: null });
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Crear una cuenta" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "  Diana Caan  ");
    await user.type(screen.getByRole("textbox", { name: "Correo electrónico" }), "diana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "secreto1");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(signUp).toHaveBeenCalledWith({
      email: "diana@example.com",
      password: "secreto1",
      options: {
        data: { nombre: "Diana Caan" },
        emailRedirectTo: expect.stringMatching(/\/auth\/callback$/),
      },
    });
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a success notice without redirecting when signup requires confirmation", async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Crear una cuenta" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Diana Caan");
    await user.type(screen.getByRole("textbox", { name: "Correo electrónico" }), "diana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "secreto1");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("status")).toHaveTextContent(getSignupSuccessMessage(false));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a controlled signup error and leaves the form usable", async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({ data: { session: null }, error: { code: "email_exists", message: "Internal provider detail" } });
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Crear una cuenta" }));
    const nameInput = screen.getByRole("textbox", { name: "Nombre" });
    const emailInput = screen.getByRole("textbox", { name: "Correo electrónico" });
    const passwordInput = screen.getByLabelText("Contraseña");
    await user.type(nameInput, "Diana Caan");
    await user.type(emailInput, "diana@example.com");
    await user.type(passwordInput, "secreto1");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese correo ya tiene una cuenta. Intenta iniciar sesión.");
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
    expect(nameInput).toBeEnabled();
    expect(emailInput).toBeEnabled();
    expect(passwordInput).toBeEnabled();
    await user.clear(nameInput);
    await user.type(nameInput, "Otro nombre");
    expect(nameInput).toHaveValue("Otro nombre");
  });

  it("returns to login and clears registration notices without erasing credentials", async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<LoginForm />);

    const emailInput = screen.getByRole("textbox", { name: "Correo electrónico" });
    const passwordInput = screen.getByLabelText("Contraseña");
    await user.click(screen.getByRole("button", { name: "Crear una cuenta" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Diana Caan");
    await user.type(emailInput, "diana@example.com");
    await user.type(passwordInput, "secreto1");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ya tengo cuenta" }));

    expect(screen.getByRole("form", { name: "Formulario de acceso" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Nombre" })).not.toBeInTheDocument();
    expect(emailInput).toHaveValue("diana@example.com");
    expect(passwordInput).toHaveValue("secreto1");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
  });

  it("clears signup errors when returning to login", async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({ data: { session: null }, error: { code: "email_exists" } });
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Crear una cuenta" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Diana Caan");
    await user.type(screen.getByRole("textbox", { name: "Correo electrónico" }), "diana@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "secreto1");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ya tengo cuenta" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
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
