"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (registering) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setError("Cuenta creada. Revisa tu correo si Supabase solicita confirmación.");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.replace("/dashboard"); router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo iniciar sesión.");
    } finally { setLoading(false); }
  }

  return <main className="shell landing"><section className="card auth-card">
    <p className="eyebrow">Moni</p><h1>Iniciar sesión</h1>
    <p className="muted">{registering ? "Crea tu cuenta para comenzar." : "Base de autenticación lista para conectar el flujo de WhatsApp."}</p>
    <form onSubmit={handleSubmit} className="form-stack">
      <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={loading}>{loading ? "Procesando…" : registering ? "Crear cuenta" : "Entrar"}</button>
      <button type="button" className="secondary-button" onClick={() => { setRegistering((value) => !value); setError(null); }}>
        {registering ? "Ya tengo cuenta" : "Crear una cuenta"}
      </button>
    </form>
  </section></main>;
}
