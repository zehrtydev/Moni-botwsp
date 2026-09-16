import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { createSupabaseServerClient, verifyOtp } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
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
      auth: { verifyOtp },
    });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("verifies a valid email token hash and redirects to the dashboard", async () => {
    const response = await GET(callbackRequest("?token_hash=token-hash&type=email"));

    expect(createSupabaseServerClient).toHaveBeenCalledOnce();
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "token-hash", type: "email" });
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/dashboard");
  });

  it("redirects to confirmation failed when token verification fails", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "invalid token" } });

    const response = await GET(callbackRequest("?token_hash=token-hash&type=email"));

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "token-hash", type: "email" });
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/login?error=confirmacion_fallida");
  });

  it("rejects a legacy code as an invalid confirmation", async () => {
    const response = await GET(callbackRequest("?code=legacy-code"));

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/login?error=confirmacion_invalida");
  });

  it("rejects a callback without valid confirmation parameters", async () => {
    const response = await GET(callbackRequest());

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/login?error=confirmacion_invalida");
  });

  it("rejects an arbitrary email OTP type", async () => {
    const response = await GET(callbackRequest("?token_hash=token-hash&type=arbitrary"));

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/login?error=confirmacion_invalida");
  });

  it("ignores a simultaneous legacy code when the token hash is valid", async () => {
    const response = await GET(callbackRequest("?token_hash=token-hash&type=email&code=legacy-code"));

    expect(createSupabaseServerClient).toHaveBeenCalledOnce();
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "token-hash", type: "email" });
    expect(response.headers.get("location")).toBe("https://moni.zehrty.dev/dashboard");
  });
});
