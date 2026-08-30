"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";

export function WhatsappLinkForm() {
  const router = useRouter();
  const [number, setNumber] = useState("+57");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setSaving(true);
    try {
      const response = await fetch("/api/account/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numero_whatsapp: number }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo vincular el número.");
      router.refresh();
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "No se pudo vincular el número."); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="form-stack"><label>Número de WhatsApp (E.164)<input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="+573001234567" required /></label>{error && <p className="error" role="alert">{error}</p>}<button type="submit" disabled={saving}><Link2 size={17} aria-hidden="true" />{saving ? "Vinculando…" : "Vincular número"}</button></form>;
}
