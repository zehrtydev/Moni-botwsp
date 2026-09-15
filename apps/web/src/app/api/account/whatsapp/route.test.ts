import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPairingCode } from "@/lib/whatsapp-pairing";

const {
  adminFrom,
  createSupabaseAdminClient,
  createSupabaseServerClient,
  sendEvolutionText,
} = vi.hoisted(() => ({
  adminFrom: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  sendEvolutionText: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient, createSupabaseServerClient }));
vi.mock("@/lib/evolution", () => ({ sendEvolutionText }));
vi.mock("@/lib/whatsapp-pairing", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/whatsapp-pairing")>(),
  checkPairingRateLimit: vi.fn(() => true),
  generatePairingCode: vi.fn(() => "AB2 CD3"),
}));

function requestFor(numeroWhatsapp: string) {
  return new Request("http://localhost/api/account/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify({ numero_whatsapp: numeroWhatsapp }),
  });
}

describe("POST /api/account/whatsapp", () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    });
    createSupabaseAdminClient.mockReturnValue({ from: adminFrom });
    sendEvolutionText.mockResolvedValue(undefined);
  });

  it("creates only a pending pairing and does not modify usuarios", async () => {
    const invalidationQuery = {
      update: vi.fn(() => invalidationQuery),
      eq: vi.fn(() => invalidationQuery),
      is: vi.fn().mockResolvedValue({ error: null }),
    };
    const insert = vi.fn().mockResolvedValue({ error: null });
    adminFrom
      .mockReturnValueOnce(invalidationQuery)
      .mockReturnValueOnce({ insert });

    const { POST } = await import("./route");
    const response = await POST(requestFor("+573001234567"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, welcomeSent: true });
    expect(adminFrom).toHaveBeenNthCalledWith(1, "whatsapp_vinculaciones_pendientes");
    expect(adminFrom).toHaveBeenNthCalledWith(2, "whatsapp_vinculaciones_pendientes");
    expect(adminFrom).not.toHaveBeenCalledWith("usuarios");
    expect(invalidationQuery.update).toHaveBeenCalledWith({ usado_en: expect.any(String) });
    expect(invalidationQuery.eq).toHaveBeenCalledWith("usuario_id", "user-1");
    expect(invalidationQuery.is).toHaveBeenCalledWith("usado_en", null);
    expect(insert).toHaveBeenCalledWith({
      usuario_id: "user-1",
      numero_whatsapp: "+573001234567",
      codigo_hash: hashPairingCode("AB2CD3"),
      expira_en: expect.any(String),
    });
    expect(sendEvolutionText).toHaveBeenCalledWith("+573001234567", expect.stringContaining("AB2 CD3"));
  });

  it("reports a failed delivery while leaving only a pending pairing", async () => {
    const invalidationQuery = {
      update: vi.fn(() => invalidationQuery),
      eq: vi.fn(() => invalidationQuery),
      is: vi.fn().mockResolvedValue({ error: null }),
    };
    const insert = vi.fn().mockResolvedValue({ error: null });
    adminFrom.mockReturnValueOnce(invalidationQuery).mockReturnValueOnce({ insert });
    sendEvolutionText.mockRejectedValue(new Error("delivery failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("./route");
    const response = await POST(requestFor("+573001234567"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, welcomeSent: false });
    expect(insert).toHaveBeenCalledOnce();
    expect(adminFrom).not.toHaveBeenCalledWith("usuarios");
  });
});
