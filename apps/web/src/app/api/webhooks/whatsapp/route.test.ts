import { beforeEach, describe, expect, it, vi } from "vitest";

const adminFrom = vi.fn();
const createSupabaseAdminClient = vi.fn(() => ({ from: adminFrom }));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient }));

function requestFor(payload: unknown) {
  return new Request("http://localhost/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-secret": "test-secret",
      "x-whatsapp-instance": "moni-test",
    },
    body: JSON.stringify(payload),
  });
}

const payload = {
  event: "messages.upsert",
  instance: "moni-test",
  data: {
    key: { id: "message-1", remoteJid: "573001234567@s.whatsapp.net", fromMe: false },
    message: { conversation: "Hola" },
    messageTimestamp: 1788091200,
  },
};

describe("WhatsApp webhook processing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.WHATSAPP_WEBHOOK_SECRET = "test-secret";
  });

  it("returns duplicate without processing the message again", async () => {
    adminFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
    });

    const { POST } = await import("./route");
    const response = await POST(requestFor(payload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, duplicate: true });
    expect(adminFrom).toHaveBeenCalledTimes(1);
  });

  it("marks the message as error when processing cannot start", async () => {
    const update = vi.fn(function update(this: { operation?: string }) {
      this.operation = "update";
      return this;
    });
    const query = {
      operation: "",
      insert: vi.fn().mockResolvedValue({ error: null }),
      update,
      eq: vi.fn(function eq(this: unknown) { return this; }),
      then(resolve: (value: { error: Error | null }) => unknown) {
        return resolve({ error: this.operation === "update" ? new Error("database unavailable") : null });
      },
    };
    adminFrom.mockReturnValue(query);

    const { POST } = await import("./route");
    const response = await POST(requestFor(payload));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ success: false, error: "No se pudo registrar el mensaje" });
    expect(update).toHaveBeenCalledWith({ estado_procesamiento: "procesando" });
    expect(update).toHaveBeenCalledWith({ estado_procesamiento: "error", codigo_error: "PROCESSING_FAILED" });
  });
});
