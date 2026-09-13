"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-error";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.replace("/dashboard");
      router.refresh();
    } catch (caughtError) {
      const errorCode = caughtError && typeof caughtError === "object" && "code" in caughtError
        ? caughtError.code
        : undefined;
      console.error("auth_action_failed", { code: errorCode });
      setError(getAuthErrorMessage(caughtError, false));
    } finally {
      setLoading(false);
    }
  }

  return <form onSubmit={handleSubmit} className="form-stack">
    <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
    <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={6} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button type="submit" disabled={loading}>{loading ? "Ingresando…" : "Entrar"}</button>
  </form>;
}
