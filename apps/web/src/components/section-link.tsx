import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function SectionLink({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: LucideIcon; active?: boolean }) {
  return <Link className={`back-link section-link ${active ? "is-active" : ""}`} href={href} aria-label={label} title={label}><Icon size={16} aria-hidden="true" />{active && <span>{label}</span>}</Link>;
}
