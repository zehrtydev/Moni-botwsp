"use client";

import { useActionState } from "react";
import {
  initialLoginState,
  type LoginState,
} from "../../features/auth/login-flow";
import styles from "./login.module.css";

export type LoginAction = (
  state: LoginState,
  formData: FormData,
) => Promise<LoginState>;

export function LoginForm({ action }: { action: LoginAction }) {
  const [state, formAction, pending] = useActionState(
    action,
    initialLoginState,
  );

  return (
    <section className={styles.card} aria-labelledby="login-title">
      <div className={styles.brand} aria-hidden="true">
        M
      </div>
      <p className={styles.eyebrow}>Moni Bot WSP</p>
      <h1 id="login-title">Entra a Moni</h1>
      <p className={styles.intro}>
        Usa el numero de WhatsApp donde quieres registrar tus gastos.
      </p>

      <form action={formAction} className={styles.form}>
        {state.step === "phone" ? (
          <>
            <label htmlFor="phone">Numero de WhatsApp</label>
            <input
              autoComplete="tel"
              defaultValue={state.phone}
              id="phone"
              inputMode="tel"
              key="phone-entry"
              name="phone"
              pattern="\+[1-9][0-9]{7,14}"
              placeholder="+573001234567"
              required
              type="tel"
            />
            <p className={styles.hint}>Incluye el prefijo del pais.</p>
            <button
              disabled={pending}
              name="intent"
              type="submit"
              value="request"
            >
              {pending ? "Enviando..." : "Enviar codigo"}
            </button>
          </>
        ) : (
          <>
            <label htmlFor="verified-phone">Numero de WhatsApp</label>
            <input
              autoComplete="tel"
              id="verified-phone"
              key="phone-verified"
              name="phone"
              readOnly
              type="tel"
              value={state.phone}
            />
            <label htmlFor="token">Codigo de 6 digitos</label>
            <input
              autoComplete="one-time-code"
              id="token"
              inputMode="numeric"
              maxLength={6}
              name="token"
              pattern="[0-9]{6}"
              placeholder="123456"
              required
              type="text"
            />
            <button
              disabled={pending}
              name="intent"
              type="submit"
              value="verify"
            >
              {pending ? "Verificando..." : "Verificar y entrar"}
            </button>
            <button
              className={styles.secondaryButton}
              disabled={pending}
              formNoValidate
              name="intent"
              type="submit"
              value="request"
            >
              Enviar otro codigo
            </button>
          </>
        )}
      </form>

      {state.message ? (
        <p
          className={
            state.tone === "error" ? styles.error : styles.success
          }
          role={state.tone === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}

      <p className={styles.privacy}>
        Tu codigo lo genera y verifica Supabase. Nunca compartimos el OTP.
      </p>
    </section>
  );
}
