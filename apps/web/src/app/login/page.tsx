import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Iniciar sesión — Moni",
};

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return <main className="shell landing"><section className="card auth-card">
    <Link className="brand-mark" href="/"><span className="brand-dot" aria-hidden="true" /> moni</Link>
    <p className="eyebrow">Qué bueno verte</p><h1>Iniciar sesión</h1>
    <p className="muted">Entra para revisar tus movimientos, estadísticas y presupuestos.</p>
    <LoginForm />
  </section></main>;
}
