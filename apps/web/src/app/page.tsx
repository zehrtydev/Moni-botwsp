import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  History,
  MessageCircle,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const steps = [
  { icon: MessageCircle, number: "01", title: "Envía un mensaje", copy: "Escríbele a Moni lo que acabas de gastar." },
  { icon: CheckCircle2, number: "02", title: "Confirma el registro", copy: "Revisa el monto y la categoría antes de guardarlo." },
  { icon: BarChart3, number: "03", title: "Revisa tu dashboard", copy: "Tus movimientos quedan organizados para consultarlos cuando quieras." },
];

const capabilities = [
  { icon: History, title: "Historial", copy: "Consulta tus movimientos cuando los necesites." },
  { icon: BarChart3, title: "Estadísticas", copy: "Entiende cómo se mueve tu dinero mes a mes." },
  { icon: PiggyBank, title: "Presupuestos mensuales", copy: "Define límites y sigue tu avance por categoría." },
];

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const primaryCta = user
    ? { href: "/dashboard", label: "Ir al dashboard" }
    : { href: "/login?mode=register", label: "Empezar ahora" };

  return (
    <main className={styles.page}>
      <nav className={styles.navbar} aria-label="Navegación principal">
        <Link className={styles.brand} href="/" aria-label="Moni, inicio">moni<span className={styles.brandDot} aria-hidden="true" /></Link>
        {user
          ? <Link className={styles.navCta} href="/dashboard">Ir al dashboard</Link>
          : <div className={styles.navActions}>
            <Link className={styles.navCta} href="/login">Iniciar sesión</Link>
            <Link className={styles.navPrimaryCta} href="/login?mode=register">Registrarse</Link>
          </div>}
      </nav>

      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Tu dinero, más claro</p>
          <h1 id="landing-title">Tus gastos, registrados por WhatsApp.</h1>
          <p className={styles.heroText}>Escríbele a Moni lo que gastaste. Moni organiza el movimiento y lo deja listo para que lo revises cuando quieras.</p>
          <Link className={styles.primaryCta} href={primaryCta.href}>{primaryCta.label}<ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        <ConversationMockup />
      </section>

      <section className={styles.stepsSection} aria-labelledby="steps-title">
        <div className={styles.sectionIntro}><p className={styles.eyebrow}>Así de simple</p><h2 id="steps-title">Menos fricción, más control.</h2></div>
        <div className={styles.stepsGrid}>
          {steps.map(({ icon: Icon, number, title, copy }) => (
            <article className={styles.stepCard} key={number}>
              <div className={styles.stepTopline}><span className={styles.stepIcon}><Icon size={22} aria-hidden="true" /></span><span className={styles.stepNumber}>{number}</span></div>
              <h3>{title}</h3><p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.dashboardSection} aria-labelledby="dashboard-preview-title">
        <div className={styles.dashboardCopy}>
          <p className={styles.eyebrow}>Todo en su lugar</p>
          <h2 id="dashboard-preview-title">Una vista clara de tus finanzas.</h2>
          <p className={styles.sectionText}>Cada registro queda listo para que puedas revisar tus números y tomar mejores decisiones.</p>
          <div className={styles.capabilityList}>
            {capabilities.map(({ icon: Icon, title, copy }) => (
              <article className={styles.capability} key={title}><span><Icon size={19} aria-hidden="true" /></span><div><h3>{title}</h3><p>{copy}</p></div></article>
            ))}
          </div>
        </div>
        <DashboardPreview />
      </section>

      <section className={styles.finalCta} aria-labelledby="final-cta-title">
        <span className={styles.finalSpark} aria-hidden="true">✦</span>
        <p className={styles.eyebrow}>Moni te acompaña</p>
        <h2 id="final-cta-title">Registrar tus gastos puede ser fácil.</h2>
        <p>Empieza por lo más simple: contarle a Moni en qué gastaste.</p>
        <Link className={styles.primaryCta} href={primaryCta.href}>{primaryCta.label}<ArrowRight size={18} aria-hidden="true" /></Link>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/" aria-label="Moni, inicio">moni<span className={styles.brandDot} aria-hidden="true" /></Link>
        <p>Gastos organizados, tranquilidad a la vista.</p><p>© {new Date().getFullYear()} Moni</p>
      </footer>
    </main>
  );
}

function ConversationMockup() {
  return (
    <div className={styles.conversationWrap} aria-label="Ejemplo de registro de un gasto con Moni">
      <div className={styles.conversationGlow} aria-hidden="true" />
      <div className={styles.conversation}>
        <div className={styles.conversationHeader}><span className={styles.avatar} aria-hidden="true">m</span><div><strong>Moni</strong><span>Tu espacio financiero</span></div><span className={styles.onlineDot} aria-hidden="true" /></div>
        <div className={styles.messages}>
          <div className={styles.userMessage}>Gasté 32.000 en gasolina</div>
          <div className={styles.moniMessage}>
            <span className={styles.messageLabel}>Nuevo gasto</span><strong>$32.000</strong><span>Transporte</span><p>¿Confirmamos este gasto?</p>
            <div className={styles.messageOptions}><span>1. Sí</span><span>2. No</span><small>Responde con 1 o 2, también puedes escribir Sí o No.</small></div>
          </div>
        </div>
        <div className={styles.composer} aria-hidden="true"><span>Escribe un mensaje…</span><span className={styles.sendButton}><ArrowRight size={16} /></span></div>
      </div>
    </div>
  );
}

function DashboardPreview() {
  const categories = [
    { name: "Alimentación", value: "$620.000", width: "78%", color: styles.purpleBar },
    { name: "Transporte", value: "$410.000", width: "55%", color: styles.peachBar },
    { name: "Otros", value: "$250.000", width: "35%", color: styles.mintBar },
  ];

  return (
    <div className={styles.dashboardPreview} aria-label="Vista de ejemplo del dashboard con datos ficticios">
      <div className={styles.previewHeader}><div><span className={styles.previewBrandDot} aria-hidden="true" /><strong>moni</strong></div><span><Clock3 size={14} aria-hidden="true" /> Este mes</span></div>
      <section className={styles.balanceCard}><span>Balance este mes</span><strong>$2.450.000</strong><small>Todo al día</small></section>
      <div className={styles.previewStats}>
        <article><span className={styles.incomeIcon}><TrendingUp size={17} aria-hidden="true" /></span><div><small>Ingresos</small><strong>$4.000.000</strong></div></article>
        <article><span className={styles.expenseIcon}><TrendingDown size={17} aria-hidden="true" /></span><div><small>Gastos</small><strong>$1.550.000</strong></div></article>
      </div>
      <section className={styles.categoryPreview}>
        <div className={styles.categoryHeading}><strong>Categorías</strong><span>Este mes</span></div>
        {categories.map((category) => <div className={styles.categoryRow} key={category.name}><div><span>{category.name}</span><strong>{category.value}</strong></div><span className={styles.track}><span className={category.color} style={{ width: category.width }} /></span></div>)}
      </section>
    </div>
  );
}
