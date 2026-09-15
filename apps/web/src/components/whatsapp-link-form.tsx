"use client";

import { FormEvent, useState } from "react";
import { Link2 } from "lucide-react";

export function WhatsappLinkForm() {
  const [number, setNumber] = useState("+57");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setNotice(null); setSaving(true);
    try {
      const response = await fetch("/api/account/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numero_whatsapp: number }) });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result?.error === "string" ? result.error : "No se pudo enviar el código.");
        return;
      }
      if (result?.success !== true) {
        setError("No se pudo enviar el código.");
        return;
      }
      if (result.welcomeSent !== true) {
        setError("No pudimos enviar el código por WhatsApp. Inténtalo de nuevo en unos minutos.");
        return;
      }
      setNotice("Código enviado. Revisa tu WhatsApp y responde con el código para completar la vinculación.");
    } catch { setError("No se pudo enviar el código."); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="form-stack"><label>Número de WhatsApp (E.164)<input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="+573001234567" required /></label>{error && <p className="error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}<button type="submit" disabled={saving}><Link2 size={17} aria-hidden="true" />{saving ? "Enviando…" : "Enviar código"}</button></form>;
}
