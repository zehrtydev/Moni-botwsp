import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsappLinkForm } from "./whatsapp-link-form";


const fetchMock = vi.fn();
const sentMessage = "Código enviado. Revisa tu WhatsApp y responde con el código para completar la vinculación.";
const failedMessage = "No pudimos enviar el código por WhatsApp. Inténtalo de nuevo en unos minutos.";

async function submitNumber() {
  const user = userEvent.setup();
  const input = screen.getByRole("textbox", { name: /Número de WhatsApp/ });
  await user.clear(input);
  await user.type(input, "+573001234567");
  await user.click(screen.getByRole("button", { name: "Enviar código" }));
}

describe("WhatsappLinkForm", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("disables sending while pending and asks for verification after delivery", async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((done) => { resolve = done; }));
    render(<WhatsappLinkForm />);

    await submitNumber();
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/account/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero_whatsapp: "+573001234567" }),
    });

    resolve(Response.json({ success: true, welcomeSent: true }));
    expect(await screen.findByRole("status")).toHaveTextContent(sentMessage);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar código" })).toBeEnabled();
    expect(document.body).not.toHaveTextContent(/Número vinculado|Evolution|Supabase/i);
  });

  it("shows failed delivery as an error and allows a successful retry", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, welcomeSent: false }));
    render(<WhatsappLinkForm />);
    await submitNumber();

    expect(await screen.findByRole("alert")).toHaveTextContent(failedMessage);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Número vinculado|Evolution|Supabase/i);

    fetchMock.mockResolvedValueOnce(Response.json({ success: true, welcomeSent: true }));
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByRole("status")).toHaveTextContent(sentMessage);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears a previous delivery notice when a retry fails", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, welcomeSent: true }));
    render(<WhatsappLinkForm />);
    await submitNumber();
    expect(await screen.findByRole("status")).toHaveTextContent(sentMessage);

    fetchMock.mockResolvedValueOnce(Response.json({ success: true, welcomeSent: false }));
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(failedMessage);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("preserves the actionable API rate limit error", async () => {
    fetchMock.mockResolvedValue(Response.json({ success: false, error: "Demasiados intentos. Espera unos minutos." }, { status: 429 }));
    render(<WhatsappLinkForm />);
    await submitNumber();

    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos. Espera unos minutos.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["network", "invalid JSON", "missing error", "unsuccessful response"])("shows the generic fallback for %s", async (failure) => {
    if (failure === "network") fetchMock.mockRejectedValue(new Error("Evolution API unavailable"));
    else if (failure === "invalid JSON") fetchMock.mockResolvedValue(new Response("invalid"));
    else if (failure === "missing error") fetchMock.mockResolvedValue(Response.json({}, { status: 500 }));
    else fetchMock.mockResolvedValue(Response.json({ success: false, welcomeSent: true }));
    render(<WhatsappLinkForm />);
    await submitNumber();

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo enviar el código.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar código" })).toBeEnabled();
    expect(document.body).not.toHaveTextContent(/Número vinculado|Evolution|Supabase/i);
  });
});
