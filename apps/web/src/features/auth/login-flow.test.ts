import { describe, expect, it, vi } from "vitest";
import {
  initialLoginState,
  processLoginForm,
} from "./login-flow";

function createAuthClient() {
  return {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: "00000000-0000-0000-0000-000000000032" },
          },
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

function form(entries: Record<string, string>) {
  const data = new FormData();

  Object.entries(entries).forEach(([name, value]) => {
    data.set(name, value);
  });

  return data;
}

describe("processLoginForm", () => {
  it("moves from phone entry to OTP entry after requesting a code", async () => {
    const client = createAuthClient();

    const state = await processLoginForm(
      client,
      initialLoginState,
      form({ intent: "request", phone: "+573001234567" }),
    );

    expect(state).toEqual({
      step: "otp",
      phone: "+573001234567",
      message: "Codigo enviado. Revisa tu telefono.",
      tone: "success",
    });
  });

  it("returns a safe phone error without provider details", async () => {
    const client = createAuthClient();
    client.auth.signInWithOtp.mockResolvedValue({
      error: new Error("provider key leaked detail"),
    });

    const state = await processLoginForm(
      client,
      initialLoginState,
      form({ intent: "request", phone: "+573001234567" }),
    );

    expect(state).toEqual({
      step: "phone",
      phone: "+573001234567",
      message: "No pudimos enviar el codigo. Intenta nuevamente.",
      tone: "error",
    });
  });

  it("returns authenticated only after OTP verification and linking", async () => {
    const client = createAuthClient();

    const state = await processLoginForm(
      client,
      {
        step: "otp",
        phone: "+573001234567",
        message: "",
        tone: "idle",
      },
      form({
        intent: "verify",
        phone: "+573001234567",
        token: "123456",
      }),
    );

    expect(state).toEqual({
      step: "authenticated",
      phone: "+573001234567",
      message: "",
      tone: "success",
    });
    expect(client.rpc).toHaveBeenCalledWith(
      "vincular_numero_autenticado",
    );
  });

  it("keeps the OTP step when verification fails", async () => {
    const client = createAuthClient();
    client.auth.verifyOtp.mockResolvedValue({
      data: { session: null },
      error: new Error("expired token detail"),
    });

    const state = await processLoginForm(
      client,
      initialLoginState,
      form({
        intent: "verify",
        phone: "+573001234567",
        token: "123456",
      }),
    );

    expect(state).toEqual({
      step: "otp",
      phone: "+573001234567",
      message: "No pudimos verificar el codigo. Solicita uno nuevo.",
      tone: "error",
    });
  });

  it("keeps a safe OTP state when authenticated linking fails", async () => {
    const client = createAuthClient();
    client.rpc.mockResolvedValue({
      data: null,
      error: new Error("database policy detail"),
    });

    const state = await processLoginForm(
      client,
      initialLoginState,
      form({
        intent: "verify",
        phone: "+573001234567",
        token: "123456",
      }),
    );

    expect(state).toEqual({
      step: "otp",
      phone: "+573001234567",
      message: "No pudimos vincular el numero verificado.",
      tone: "error",
    });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("rejects missing phone data without contacting Supabase", async () => {
    const client = createAuthClient();

    const state = await processLoginForm(
      client,
      initialLoginState,
      form({ intent: "request" }),
    );

    expect(state.tone).toBe("error");
    expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("rejects missing token data without verifying", async () => {
    const client = createAuthClient();

    const state = await processLoginForm(
      client,
      initialLoginState,
      form({ intent: "verify", phone: "+573001234567" }),
    );

    expect(state).toMatchObject({ step: "otp", tone: "error" });
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("rejects an unknown form intent without contacting Supabase", async () => {
    const client = createAuthClient();

    const state = await processLoginForm(
      client,
      initialLoginState,
      form({ intent: "unexpected", phone: "+573001234567" }),
    );

    expect(state.tone).toBe("error");
    expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
  });
});
