import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Iniciar sesión — Moni",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  const initialMode = params.mode === "register" ? "register" : "login";

  return <main className="shell landing"><section className="card auth-card">
    <Link className="brand-mark" href="/"><span className="brand-dot" aria-hidden="true" /> moni</Link>
    <LoginForm initialMode={initialMode} />
  </section></main>;
}
