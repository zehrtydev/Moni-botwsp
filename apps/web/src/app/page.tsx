import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return <main className="shell landing"><section className="card">
    <p className="eyebrow">Moni</p>
    <h1>Registra tus gastos sin fricción.</h1>
    <p className="muted">La base del dashboard ya está lista para recibir el flujo seguro de WhatsApp.</p>
    <Link className="button-link" href="/login">Entrar al dashboard <ArrowRight size={17} aria-hidden="true" /></Link>
  </section></main>;
}
