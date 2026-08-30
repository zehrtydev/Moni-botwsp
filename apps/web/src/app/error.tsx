"use client";

import { useEffect } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("app_render_error", { digest: error.digest });
  }, [error]);

  return <main className="shell state-page"><section className="clay-panel state-card" role="alert"><span className="state-icon state-icon-error"><CircleAlert size={25} aria-hidden="true" /></span><p className="eyebrow">Algo no salió bien</p><h1>No pudimos cargar esta sección</h1><p className="muted">Puede ser un problema temporal de conexión. Intenta cargarla nuevamente.</p><button type="button" onClick={reset}><RefreshCw size={17} aria-hidden="true" /> Intentar de nuevo</button></section></main>;
}
