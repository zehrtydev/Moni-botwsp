import { describe, expect, it, vi } from "vitest";
import {
  requestPhoneOtp,
  verifyPhoneOtpAndLink,
} from "./phone-otp";

function createAuthClient() {
  return {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: "00000000-0000-0000-0000-000000000031" },
          },
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

describe("requestPhoneOtp", () => {
  it("asks Supabase to create or sign in the E.164 phone user", async () => {
    const client = createAuthClient();

    await requestPhoneOtp(client, "+573001234567");

    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: "+573001234567",
      options: { shouldCreateUser: true },
    });
  });

  it("rejects an invalid phone before contacting Supabase", async () => {
    const client = createAuthClient();

    await expect(requestPhoneOtp(client, "3001234567")).rejects.toThrow(
      "formato E.164",
    );
    expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("does not leak the provider error when the OTP request fails", async () => {
    const client = createAuthClient();
    client.auth.signInWithOtp.mockResolvedValue({
      error: new Error("provider credentials are invalid"),
    });

    await expect(
      requestPhoneOtp(client, "+573001234567"),
    ).rejects.toEqual(
      new Error("No pudimos enviar el codigo. Intenta nuevamente."),
    );
  });
});

describe("verifyPhoneOtpAndLink", () => {
  it("validates E.164 again before verifying the OTP", async () => {
    const client = createAuthClient();

    await expect(
      verifyPhoneOtpAndLink(client, "3001234567", "123456"),
    ).rejects.toThrow("formato E.164");
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("validates the six-digit OTP before contacting Supabase", async () => {
    const client = createAuthClient();

    await expect(
      verifyPhoneOtpAndLink(client, "+573001234567", "12ab"),
    ).rejects.toThrow("6 digitos");
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("does not call the linking RPC when OTP verification fails", async () => {
    const client = createAuthClient();
    client.auth.verifyOtp.mockResolvedValue({
      data: { session: null },
      error: new Error("otp expired"),
    });

    await expect(
      verifyPhoneOtpAndLink(client, "+573001234567", "123456"),
    ).rejects.toEqual(
      new Error("No pudimos verificar el codigo. Solicita uno nuevo."),
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("requires a valid session before calling the linking RPC", async () => {
    const client = createAuthClient();
    client.auth.verifyOtp.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(
      verifyPhoneOtpAndLink(client, "+573001234567", "123456"),
    ).rejects.toThrow("No pudimos verificar el codigo");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects a verification response without an authenticated user", async () => {
    const client = createAuthClient();
    client.auth.verifyOtp.mockResolvedValue({
      data: { session: { user: null } },
      error: null,
    });

    await expect(
      verifyPhoneOtpAndLink(client, "+573001234567", "123456"),
    ).rejects.toEqual(
      new Error("No pudimos verificar el codigo. Solicita uno nuevo."),
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("links the authenticated phone only after successful verification", async () => {
    const client = createAuthClient();

    await verifyPhoneOtpAndLink(client, "+573001234567", "123456");

    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      phone: "+573001234567",
      token: "123456",
      type: "sms",
    });
    expect(client.rpc).toHaveBeenCalledWith(
      "vincular_numero_autenticado",
    );
    expect(
      client.auth.verifyOtp.mock.invocationCallOrder[0],
    ).toBeLessThan(client.rpc.mock.invocationCallOrder[0]);
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it("closes the session if authenticated phone linking fails", async () => {
    const client = createAuthClient();
    client.rpc.mockResolvedValue({
      data: null,
      error: new Error("number replacement requires support"),
    });

    await expect(
      verifyPhoneOtpAndLink(client, "+573001234567", "123456"),
    ).rejects.toEqual(
      new Error("No pudimos vincular el numero verificado."),
    );
    expect(client.auth.signOut).toHaveBeenCalledOnce();
    expect(client.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      client.auth.signOut.mock.invocationCallOrder[0],
    );
  });

  it("closes the session when the linking request throws", async () => {
    const client = createAuthClient();
    client.rpc.mockRejectedValue(new Error("network details"));

    await expect(
      verifyPhoneOtpAndLink(client, "+573001234567", "123456"),
    ).rejects.toEqual(
      new Error("No pudimos vincular el numero verificado."),
    );
    expect(client.auth.signOut).toHaveBeenCalledOnce();
  });

  it("keeps the public linking error even if closing the session fails", async () => {
    const client = createAuthClient();
    client.rpc.mockRejectedValue(new Error("network details"));
    client.auth.signOut.mockRejectedValue(new Error("sign out details"));

    await expect(
      verifyPhoneOtpAndLink(client, "+573001234567", "123456"),
    ).rejects.toEqual(
      new Error("No pudimos vincular el numero verificado."),
    );
  });
});
