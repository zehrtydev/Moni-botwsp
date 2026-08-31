"use client";

import { AlertTriangle, X } from "lucide-react";

export function DeleteConfirmationModal({ itemLabel, isDeleting, onCancel, onConfirm }: { itemLabel: string; isDeleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) onCancel(); }}><section className="delete-modal clay-panel" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" aria-describedby="delete-modal-description"><button type="button" className="modal-close-button" onClick={onCancel} disabled={isDeleting} aria-label="Cerrar confirmación"><X size={18} aria-hidden="true" /></button><span className="delete-modal-icon" aria-hidden="true"><AlertTriangle size={22} /></span><p className="eyebrow">Eliminar registro</p><h2 id="delete-modal-title">¿Quieres eliminar este registro?</h2><p id="delete-modal-description" className="muted">Se eliminará <strong>{itemLabel}</strong>. Esta acción no se puede deshacer.</p><div className="delete-modal-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={isDeleting}>Cancelar</button><button type="button" className="delete-confirm-button" onClick={onConfirm} disabled={isDeleting}>{isDeleting ? "Eliminando…" : "Sí, eliminar"}</button></div></section></div>;
}
