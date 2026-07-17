import type { Metadata } from "next";
import { loginAction } from "./actions";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Entrar | Moni Bot WSP",
  description: "Accede con el numero verificado de tu WhatsApp.",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <LoginForm action={loginAction} />
    </main>
  );
}
