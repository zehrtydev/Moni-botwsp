import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "../../features/auth/claims";
import {
  loadDashboardData,
  type DashboardData,
} from "../../features/dashboard/dashboard-data";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { logoutAction } from "./actions";
import styles from "./dashboard.module.css";

export const metadata: Metadata = {
  title: "Dashboard | Moni Bot WSP",
};

function formatCop(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function DashboardPage() {
  let userId: string | null = null;
  let client: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  > | null = null;

  try {
    client = await createServerSupabaseClient();
    userId = getAuthenticatedUserId(await client.auth.getClaims());
  } catch {
    userId = null;
  }

  if (!userId || !client) {
    redirect("/login");
    return null;
  }

  let dashboard: DashboardData | null;

  try {
    dashboard = await loadDashboardData(client, userId);
  } catch {
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <div className={styles.errorCard} role="alert">
            <p className={styles.eyebrow}>Error temporal</p>
            <h1>No pudimos cargar tu dashboard</h1>
            <p>
              Tu sesion sigue activa. Reintenta en unos segundos.
            </p>
            <Link href="/dashboard">Reintentar</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!dashboard) {
    redirect("/login");
    return null;
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="dashboard-title">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Moni Bot WSP</p>
            <h1 id="dashboard-title">Tu espacio Moni</h1>
          </div>
          <form action={logoutAction}>
            <button type="submit">Cerrar sesion</button>
          </form>
        </header>

        <div className={styles.statusCard}>
          <span className={styles.statusDot} aria-hidden="true" />
          <div>
            <h2>Sesion protegida</h2>
            <p>
              Hola, {dashboard.profile.name ?? "bienvenido"}. Tu numero
              vinculado es <strong>{dashboard.profile.phone}</strong>.
            </p>
          </div>
        </div>

        <section className={styles.metrics} aria-label="Resumen confirmado">
          <article>
            <p>Total confirmado</p>
            <strong>{formatCop(dashboard.summary.totalAmount)}</strong>
          </article>
          <article>
            <p>Gastos confirmados</p>
            <strong>{dashboard.summary.count}</strong>
          </article>
        </section>

        <section className={styles.expenses} aria-labelledby="expenses-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Actividad reciente</p>
              <h2 id="expenses-title">Gastos confirmados</h2>
            </div>
            <span>{dashboard.expenses.length} recientes</span>
          </div>

          {dashboard.expenses.length > 0 ? (
            <div className={styles.expenseList}>
              {dashboard.expenses.map((expense) => (
                <article className={styles.expense} key={expense.id}>
                  <div>
                    <h3>{expense.description}</h3>
                    <p>
                      {expense.category} · {" "}
                      <time dateTime={expense.date}>{expense.date}</time>
                    </p>
                  </div>
                  <strong>{formatCop(expense.amount)}</strong>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              Aun no hay gastos confirmados. Envia el primero por WhatsApp.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
