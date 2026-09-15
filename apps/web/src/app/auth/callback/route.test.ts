import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { createSupabaseServerClient, exchangeCodeForSession, verifyOtp } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

function callbackRequest(query = "") {
  return new Request(`http://localhost/auth/callback${query}`);
}

describe("auth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClient.mockResolvedValue({
      auth: { exchangeCodeForSession, verifyOtp },
    });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("verifies a valid email token hash and redirects to the dashboard", async () => {
    const response = await GET(callbackRequest("?token_hash=token-hash&type=email"));

    expect(createSupabaseServerClient).toHaveBeenCalledOnce();
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "token-hash", type: "email" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/dashboard");
  });

  it("redirects to confirmation failed when token verification fails", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "invalid token" } });

    const response = await GET(callbackRequest("?token_hash=token-hash&type=email"));

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "token-hash", type: "email" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/login?error=confirmacion_fallida");
  });

  it("exchanges a legacy code and redirects to the dashboard", async () => {
    const response = await GET(callbackRequest("?code=legacy-code"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("legacy-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/dashboard");
  });

  it("redirects to confirmation failed when legacy code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid code" } });

    const response = await GET(callbackRequest("?code=legacy-code"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("legacy-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/login?error=confirmacion_fallida");
  });

  it("rejects a callback without valid confirmation parameters", async () => {
    const response = await GET(callbackRequest());

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/login?error=confirmacion_invalida");
  });

  it("rejects an arbitrary email OTP type", async () => {
    const response = await GET(callbackRequest("?token_hash=token-hash&type=arbitrary"));

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/login?error=confirmacion_invalida");
  });

  it("prioritizes a valid token hash over a simultaneous legacy code", async () => {
    const response = await GET(callbackRequest("?token_hash=token-hash&type=email&code=legacy-code"));

    expect(createSupabaseServerClient).toHaveBeenCalledOnce();
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "token-hash", type: "email" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/dashboard");
  });
});
