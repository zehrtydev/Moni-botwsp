import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

afterEach(cleanup);

describe("LoginForm", () => {
  it("starts with an accessible E.164 phone form", () => {
    render(<LoginForm action={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Entra a Moni" }),
    ).toBeInTheDocument();
    const phone = screen.getByLabelText("Numero de WhatsApp");
    expect(phone).toHaveAttribute("autocomplete", "tel");
    expect(phone).toHaveAttribute("name", "phone");
    expect(phone).toHaveAttribute("placeholder", "+573001234567");
    expect(phone).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Enviar codigo" }),
    ).toBeInTheDocument();
  });

  it("shows the OTP form after the request action succeeds", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({
      step: "otp",
      phone: "+573001234567",
      message: "Codigo enviado. Revisa tu telefono.",
      tone: "success",
    });

    render(<LoginForm action={action} />);

    await user.type(
      screen.getByLabelText("Numero de WhatsApp"),
      "+573001234567",
    );
    await user.click(
      screen.getByRole("button", { name: "Enviar codigo" }),
    );

    const token = await screen.findByLabelText("Codigo de 6 digitos");
    expect(token).toHaveAttribute("autocomplete", "one-time-code");
    expect(token).toHaveAttribute("inputmode", "numeric");
    expect(token).toHaveAttribute("name", "token");
    expect(token).toBeRequired();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Codigo enviado",
    );
    expect(
      screen.getByRole("button", { name: "Verificar y entrar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar otro codigo" }),
    ).toHaveAttribute("formnovalidate");
    expect(screen.getByDisplayValue("+573001234567")).toBeInTheDocument();
  });
});
