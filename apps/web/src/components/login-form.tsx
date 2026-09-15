"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAuthErrorMessage, getSignupSuccessMessage } from "@/lib/auth-error";

export function LoginForm({ initialMode = "login" }: { initialMode?: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(initialMode === "register");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const normalizedName = name.trim();
    if (registering && normalizedName.length < 2) {
      setError("Escribe un nombre de al menos 2 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (registering) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nombre: normalizedName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setNotice(getSignupSuccessMessage(false));
        }
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.replace("/dashboard");
      router.refresh();
    } catch (caughtError) {
      const errorCode = caughtError && typeof caughtError === "object" && "code" in caughtError
        ? caughtError.code
        : undefined;
      console.error("auth_action_failed", { code: errorCode });
      setError(getAuthErrorMessage(caughtError, registering));
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setRegistering((value) => !value);
    setError(null);
    setNotice(null);
  }

  return <>
    <p className="eyebrow">{registering ? "Empieza con Moni" : "Qué bueno verte"}</p><h1>{registering ? "Crea tu cuenta" : "Iniciar sesión"}</h1>
    <p className="muted">{registering ? "Empieza a organizar tus gastos con Moni." : "Entra para revisar tus movimientos, estadísticas y presupuestos."}</p>
    <form onSubmit={handleSubmit} className="form-stack" aria-label={registering ? "Formulario de registro" : "Formulario de acceso"}>
      <p className="eyebrow">{registering ? "Registro de usuario" : "Acceso de usuario"}</p>
      {registering && <label>Nombre<input type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={100} /></label>}
      <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={registering ? "new-password" : "current-password"} required minLength={6} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <button type="submit" disabled={loading}>{loading ? "Procesando…" : registering ? "Crear cuenta" : "Entrar"}</button>
      <button type="button" className="secondary-button" onClick={toggleMode} disabled={loading}>
        {registering ? "Ya tengo cuenta" : "Crear una cuenta"}
      </button>
    </form>
  </>;
}
