import { describe, expect, it, vi } from "vitest";
import { loadDashboardData } from "./dashboard-data";

function createClient({
  profile = {
    data: { nombre: "Manuel", numero_whatsapp: "+573001234567" },
    error: null,
  },
  expenses = {
    data: [
      {
        id: "00000000-0000-0000-0000-000000000099",
        fecha_gasto: "2026-07-16",
        monto: 28500,
        moneda: "COP",
        descripcion: "Almuerzo",
        categorias: { nombre: "Alimentacion" },
      },
    ],
    error: null,
  },
} = {}) {
  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(profile),
  };
  profileQuery.select.mockReturnValue(profileQuery);
  profileQuery.eq.mockReturnValue(profileQuery);

  const expenseQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue(expenses),
  };
  expenseQuery.select.mockReturnValue(expenseQuery);
  expenseQuery.eq.mockReturnValue(expenseQuery);
  expenseQuery.order.mockReturnValue(expenseQuery);

  const client = {
    from: vi.fn((table: string) =>
      table === "usuarios" ? profileQuery : expenseQuery,
    ),
  };

  return { client, expenseQuery, profileQuery };
}

describe("loadDashboardData", () => {
  it("loads only the linked profile and its confirmed recent expenses", async () => {
    const { client, expenseQuery, profileQuery } = createClient();

    await expect(
      loadDashboardData(
        client as never,
        "00000000-0000-0000-0000-000000000032",
      ),
    ).resolves.toEqual({
      profile: { name: "Manuel", phone: "+573001234567" },
      expenses: [
        {
          id: "00000000-0000-0000-0000-000000000099",
          date: "2026-07-16",
          amount: 28500,
          currency: "COP",
          description: "Almuerzo",
          category: "Alimentacion",
        },
      ],
    });

    expect(profileQuery.select).toHaveBeenCalledWith(
      "nombre, numero_whatsapp",
    );
    expect(profileQuery.eq).toHaveBeenCalledWith(
      "id",
      "00000000-0000-0000-0000-000000000032",
    );
    expect(expenseQuery.eq).toHaveBeenCalledWith(
      "usuario_id",
      "00000000-0000-0000-0000-000000000032",
    );
    expect(expenseQuery.eq).toHaveBeenCalledWith("estado", "confirmado");
    expect(expenseQuery.limit).toHaveBeenCalledWith(8);
  });

  it("returns null and does not read expenses for an unlinked profile", async () => {
    const { client } = createClient({
      profile: {
        data: { nombre: null, numero_whatsapp: null },
        error: null,
      },
    });

    await expect(
      loadDashboardData(
        client as never,
        "00000000-0000-0000-0000-000000000032",
      ),
    ).resolves.toBeNull();
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("does not expose database details when a query fails", async () => {
    const { client } = createClient({
      profile: {
        data: null,
        error: new Error("private database detail"),
      },
    });

    await expect(
      loadDashboardData(
        client as never,
        "00000000-0000-0000-0000-000000000032",
      ),
    ).rejects.toThrow("No pudimos cargar tu dashboard.");
  });
});
