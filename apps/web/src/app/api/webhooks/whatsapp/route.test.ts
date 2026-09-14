import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPairingCode } from "@/lib/whatsapp-pairing";

const { adminFrom, adminRpc, createSupabaseAdminClient, sendEvolutionText } = vi.hoisted(() => ({
  adminFrom: vi.fn(),
  adminRpc: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  sendEvolutionText: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient }));
vi.mock("@/lib/evolution", () => ({
  sendEvolutionButtons: vi.fn(),
  sendEvolutionText,
}));

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

function lidPayload(content: string) {
  return {
    ...payload,
    data: {
      ...payload.data,
      key: { ...payload.data.key, remoteJid: "12345@lid" },
      message: { conversation: content },
    },
  };
}

function mockUnknownContact() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle };
  adminFrom.mockReturnValue(query);
}

describe("WhatsApp webhook processing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.WHATSAPP_WEBHOOK_SECRET = "test-secret";
    createSupabaseAdminClient.mockReturnValue({ from: adminFrom, rpc: adminRpc });
    sendEvolutionText.mockResolvedValue(undefined);
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

  it("does not infer an unknown LID from the only linked user", async () => {
    mockUnknownContact();

    const { POST } = await import("./route");
    const response = await POST(requestFor(lidPayload("Hola")));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, ignored: true, reason: "contact_lid_requires_explicit_pairing" });
    expect(adminFrom).toHaveBeenCalledWith("whatsapp_contactos_lid");
    expect(adminFrom).not.toHaveBeenCalledWith("usuarios");
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it("links the pending number only after a valid pairing code is completed", async () => {
    adminRpc.mockResolvedValue({
      data: { usuario_id: "user-1", numero_whatsapp: "+573001234567" },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(requestFor(lidPayload("MONI-AB2CD3")));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ success: true, paired: true });
    expect(adminRpc).toHaveBeenCalledWith("completar_vinculacion_whatsapp", {
      p_codigo_hash: hashPairingCode("MONI-AB2CD3"),
      p_instancia: "moni-test",
      p_lid: "12345@lid",
    });
    expect(adminFrom).not.toHaveBeenCalled();
    expect(sendEvolutionText).toHaveBeenCalledWith("+573001234567", expect.stringContaining("Este chat ya está conectado"));
  });

  it.each(["expired", "already used"])("does not link a number when the pairing code is %s", async () => {
    adminRpc.mockResolvedValue({ data: null, error: null });
    mockUnknownContact();

    const { POST } = await import("./route");
    const response = await POST(requestFor(lidPayload("MONI-AB2CD3")));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, ignored: true, reason: "contact_lid_requires_explicit_pairing" });
    expect(adminFrom).not.toHaveBeenCalledWith("usuarios");
    expect(sendEvolutionText).not.toHaveBeenCalled();
  });

  it("returns a controlled conflict without completing the pairing", async () => {
    adminRpc.mockResolvedValue({ data: null, error: { code: "23505", message: "WHATSAPP_NUMBER_ALREADY_LINKED" } });

    const { POST } = await import("./route");
    const response = await POST(requestFor(lidPayload("MONI-AB2CD3")));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ success: false, error: "El número ya está vinculado a otra cuenta" });
    expect(adminFrom).not.toHaveBeenCalled();
    expect(sendEvolutionText).not.toHaveBeenCalled();
  });
});
