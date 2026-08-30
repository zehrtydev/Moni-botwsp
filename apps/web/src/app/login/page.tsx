"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAuthErrorMessage, getSignupSuccessMessage } from "@/lib/auth-error";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setNotice(null); setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (registering) {
        const normalizedName = name.trim();
        if (normalizedName.length < 2) {
          setError("Escribe tu nombre para crear la cuenta.");
          return;
        }
        const { data: { session }, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nombre: normalizedName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        if (session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setNotice(getSignupSuccessMessage(false));
        }
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.replace("/dashboard"); router.refresh();
    } catch (caughtError) {
      const errorCode = caughtError && typeof caughtError === "object" && "code" in caughtError
        ? caughtError.code
        : undefined;
      console.error("auth_action_failed", { code: errorCode });
      setError(getAuthErrorMessage(caughtError, registering));
    } finally { setLoading(false); }
  }

  return <main className="shell landing"><section className="card auth-card">
    <p className="eyebrow">Moni</p><h1>Iniciar sesión</h1>
    <p className="muted">{registering ? "Crea tu cuenta para comenzar." : "Base de autenticación lista para conectar el flujo de WhatsApp."}</p>
    <form onSubmit={handleSubmit} className="form-stack">
      <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      {registering && <label>Nombre<input type="text" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={100} autoComplete="name" /></label>}
      <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <button type="submit" disabled={loading}>{loading ? "Procesando…" : registering ? "Crear cuenta" : "Entrar"}</button>
      <button type="button" className="secondary-button" onClick={() => { setRegistering((value) => !value); setError(null); setNotice(null); }}>
        {registering ? "Ya tengo cuenta" : "Crear una cuenta"}
      </button>
    </form>
  </section></main>;
}
