import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient, createSupabaseAdminClient } = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn(), createSupabaseAdminClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient, createSupabaseAdminClient }));

import { DELETE } from "./route";

describe("DELETE /api/incomes/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes only the authenticated user's income", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "income-1" }, error: null });
    const query = { delete: vi.fn(() => query), eq: vi.fn(() => query), select: vi.fn(() => query), maybeSingle };
    createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) } });
    createSupabaseAdminClient.mockReturnValue({ from: vi.fn(() => query) });

    const response = await DELETE(new Request("http://localhost/api/incomes/income-1"), { params: Promise.resolve({ id: "income-1" }) });

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "income-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "usuario_id", "user-1");
  });

  it("rejects unauthenticated requests", async () => {
    createSupabaseServerClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } });

    const response = await DELETE(new Request("http://localhost/api/incomes/income-1"), { params: Promise.resolve({ id: "income-1" }) });

    expect(response.status).toBe(401);
  });
});
