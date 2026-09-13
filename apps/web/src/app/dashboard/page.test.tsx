import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

const { createSupabaseServerClient, dailyExpenseChart, categoryExpenseChart } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  dailyExpenseChart: vi.fn(),
  categoryExpenseChart: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/components/sign-out-button", () => ({ SignOutButton: () => <button type="button">Cerrar sesión</button> }));
vi.mock("@/components/whatsapp-link-form", () => ({ WhatsappLinkForm: () => <div>Formulario de WhatsApp</div> }));
vi.mock("@/components/section-link", () => ({ SectionLink: ({ href, label }: { href: string; label: string }) => <a href={href}>{label}</a> }));
vi.mock("@/components/category-icon", () => ({ CategoryIcon: () => <span aria-hidden="true" /> }));
vi.mock("@/components/expense-charts", () => ({
  DailyExpenseChart: (props: unknown) => {
    dailyExpenseChart(props);
    return <div data-testid="daily-chart" />;
  },
  CategoryExpenseChart: (props: unknown) => {
    categoryExpenseChart(props);
    return <div data-testid="category-chart" />;
  },
}));

type QueryResponse = { data: unknown };
type QueryCall = { table: string; method: string; args: unknown[] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setupSupabase(responses: Record<string, QueryResponse | Promise<QueryResponse>>) {
  const calls: QueryCall[] = [];
  const started: string[] = [];
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "lte", "order", "limit", "in", "maybeSingle"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    builder.then = (onFulfilled: (value: QueryResponse) => unknown, onRejected: (reason: unknown) => unknown) => {
      started.push(table);
      return Promise.resolve(responses[table]).then(onFulfilled, onRejected);
    };
    return builder;
  });

  createSupabaseServerClient.mockResolvedValue({ auth: { getUser }, from });
  return { calls, started, from };
}

function callsFor(calls: QueryCall[], table: string) {
  return calls.filter((call) => call.table === table).map(({ method, args }) => [method, ...args]);
}

describe("dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("keeps the financial query contract and renders the same dashboard result", async () => {
    const { calls } = setupSupabase({
      usuarios: { data: { nombre: "Ana Pérez", numero_whatsapp: "+573001234567" } },
      gastos: { data: [
        { id: "expense-1", fecha_gasto: "2026-09-11", monto: 10_000, descripcion: "Almuerzo", categoria_id: "category-1" },
        { id: "expense-2", fecha_gasto: "2026-09-10", monto: 5_000, descripcion: "Cena", categoria_id: "category-1" },
        { id: "expense-3", fecha_gasto: "2026-09-08", monto: 3_000, descripcion: "Café", categoria_id: "category-2" },
      ] },
      ingresos: { data: [
        { id: "income-1", fecha_ingreso: "2026-09-12", monto: 30_000, categoria_id: "income-category-1", descripcion: "Pago" },
        { id: "income-2", fecha_ingreso: "2026-09-09", monto: 10_000, categoria_id: "income-category-1", descripcion: "Pago anterior" },
      ] },
      presupuestos_mensuales: { data: [{ categoria_id: "category-1", monto_limite: 50_000 }] },
      categorias: { data: [
        { id: "category-1", nombre: "Alimentación" },
        { id: "category-2", nombre: "Otros" },
      ] },
    });

    render(await DashboardPage({ searchParams: Promise.resolve({ desde: "2026-09-10", hasta: "2026-09-12" }) }));

    expect(document.body.textContent).toContain("Hola, Ana");
    expect(document.body.textContent).toContain("$ 30.000 ingresos · $ 15.000 gastos");
    expect(document.body.textContent).toContain("$ 15.000");
    expect(screen.getByTestId("daily-chart")).toBeInTheDocument();
    expect(screen.getByTestId("category-chart")).toBeInTheDocument();

    expect(callsFor(calls, "gastos")).toEqual([
      ["select", "id, fecha_gasto, monto, descripcion, categoria_id"],
      ["eq", "usuario_id", "user-1"],
      ["eq", "estado", "confirmado"],
      ["gte", "fecha_gasto", "2026-09-07"],
      ["lte", "fecha_gasto", "2026-09-12"],
      ["order", "fecha_gasto", { ascending: false }],
      ["limit", 500],
    ]);
    expect(callsFor(calls, "ingresos")).toEqual([
      ["select", "id, fecha_ingreso, monto, categoria_id, descripcion"],
      ["eq", "usuario_id", "user-1"],
      ["eq", "estado", "confirmado"],
      ["gte", "fecha_ingreso", "2026-09-07"],
      ["lte", "fecha_ingreso", "2026-09-12"],
      ["order", "fecha_ingreso", { ascending: false }],
      ["limit", 500],
    ]);
    expect(callsFor(calls, "presupuestos_mensuales")).toEqual([
      ["select", "categoria_id, monto_limite"],
      ["eq", "usuario_id", "user-1"],
      ["eq", "mes", "2026-09-01"],
    ]);
    expect(callsFor(calls, "categorias")).toEqual([
      ["select", "id, nombre"],
      ["in", "id", ["category-1", "category-2"]],
    ]);
  });

  it("starts expenses, incomes and budgets before any of them resolves", async () => {
    const expenses = deferred<QueryResponse>();
    const incomes = deferred<QueryResponse>();
    const budgets = deferred<QueryResponse>();
    const categories = deferred<QueryResponse>();
    const { started } = setupSupabase({
      usuarios: { data: { nombre: "Ana", numero_whatsapp: "+573001234567" } },
      gastos: expenses.promise,
      ingresos: incomes.promise,
      presupuestos_mensuales: budgets.promise,
      categorias: categories.promise,
    });

    const page = DashboardPage({ searchParams: Promise.resolve({ desde: "2026-09-10", hasta: "2026-09-12" }) });

    await vi.waitFor(() => expect(started).toEqual(expect.arrayContaining(["gastos", "ingresos", "presupuestos_mensuales"])));
    expect(started).not.toContain("categorias");

    expenses.resolve({ data: [
      { id: "expense-1", fecha_gasto: "2026-09-10", monto: 10_000, descripcion: "Almuerzo", categoria_id: "category-1" },
      { id: "expense-2", fecha_gasto: "2026-09-11", monto: 5_000, descripcion: "Cena", categoria_id: "category-1" },
    ] });
    await vi.waitFor(() => expect(started).toContain("categorias"));
    categories.resolve({ data: [{ id: "category-1", nombre: "Alimentación" }] });
    incomes.resolve({ data: [] });
    budgets.resolve({ data: [] });

    render(await page);
  });

  it("does not query financial data or categories without a linked WhatsApp number", async () => {
    const { from } = setupSupabase({
      usuarios: { data: { nombre: "Ana", numero_whatsapp: null } },
    });

    render(await DashboardPage({ searchParams: Promise.resolve({ desde: "2026-09-10", hasta: "2026-09-12" }) }));

    expect(screen.getByText("Conecta tu WhatsApp")).toBeInTheDocument();
    expect(from.mock.calls.map(([table]) => table)).toEqual(["usuarios"]);
    expect(dailyExpenseChart).not.toHaveBeenCalled();
    expect(categoryExpenseChart).not.toHaveBeenCalled();
  });
});
