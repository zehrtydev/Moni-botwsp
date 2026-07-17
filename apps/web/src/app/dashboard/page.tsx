import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "../../features/auth/claims";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { logoutAction } from "./actions";
import styles from "./dashboard.module.css";

export const metadata: Metadata = {
  title: "Dashboard | Moni Bot WSP",
};

export default async function DashboardPage() {
  let userId: string | null = null;

  try {
    const client = await createServerSupabaseClient();
    userId = getAuthenticatedUserId(await client.auth.getClaims());
  } catch {
    userId = null;
  }

  if (!userId) {
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
              Tu numero ya puede vincularse de forma segura. Los gastos
              confirmados apareceran aqui en el siguiente bloque.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
