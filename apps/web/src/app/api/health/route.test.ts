import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient }));

describe("health endpoint", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    process.env.WHATSAPP_WEBHOOK_SECRET = "webhook-test-secret";
  });

  it("reports healthy when configuration and database are available", async () => {
    createSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ error: null }) })),
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", checks: { configuration: "ok", database: "ok" } });
  });

  it("does not expose configuration details when a required secret is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "degraded", checks: { configuration: "failed", database: "not_checked" } });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
