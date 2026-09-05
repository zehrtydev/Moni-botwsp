# Decisiones arquitectónicas observables

Formato ADR simple. Solo se registran decisiones que pueden demostrarse desde el código o la documentación; no se inventan motivos.

## ADR-001 — Next.js concentra la aplicación web y el webhook

- **Estado:** Implementado.
- **Decisión:** La UI, las rutas API y el procesamiento del webhook de WhatsApp viven en `apps/web`.
- **Evidencia:** `apps/web/src/app`, `/api/webhooks/whatsapp/route.ts` y el workflow de producción.
- **Motivo:** No documentado. El PRD menciona n8n, pero no hay configuración de n8n y el código actual procesa el webhook directamente.

## ADR-002 — Supabase es Auth y persistencia principal

- **Estado:** Implementado.
- **Decisión:** Supabase Auth identifica usuarios; Supabase Postgres almacena movimientos, mensajes, pairing, categorías y presupuestos.
- **Evidencia:** clientes Supabase en `apps/web/src/lib/supabase`, migraciones y políticas RLS.
- **Motivo:** No documentado explícitamente.

## ADR-003 — El acceso a datos se limita por usuario mediante RLS y filtros de propiedad

- **Estado:** Implementado.
- **Decisión:** Las tablas principales tienen RLS habilitado/forzado y las consultas/escrituras autenticadas comprueban la identidad propietaria.
- **Evidencia:** migraciones `20260711150000_foundation_data.sql`, `20260711153000_secure_state_and_number_audit.sql` y rutas de gastos/ingresos/presupuestos.
- **Motivo:** La separación de datos es una propiedad explícita del esquema; el motivo histórico no está documentado.

## ADR-004 — Evolution API es el adaptador de WhatsApp

- **Estado:** Implementado.
- **Decisión:** Evolution API recibe eventos y envía respuestas; se ejecuta como servicio separado en local y producción.
- **Evidencia:** `apps/web/src/lib/evolution.ts`, `infra/evolution/docker-compose.yml`, `docker-compose.prod.yml` y [DEPLOYMENT.md](DEPLOYMENT.md).
- **Motivo:** No documentado en el código. El PRD sí indica que se reutiliza la misma instancia para el canal de vinculación.

## ADR-005 — La interpretación de gastos admite IA opcional y validación estructurada

- **Estado:** Implementado.
- **Decisión:** El proveedor IA usa un contrato JSON estricto validado con Zod; Ollama es una opción local y, si no hay configuración o falla la llamada, el procesamiento puede continuar sin esa interpretación.
- **Evidencia:** `apps/web/src/lib/ai-expense-interpreter.ts`, variables `AI_*` y [LOCAL-SETUP.md](LOCAL-SETUP.md).
- **Motivo:** La documentación indica que Ollama evita exigir una API key; no se documenta una razón más amplia.

## ADR-006 — Los movimientos requieren confirmación antes de quedar confirmados

- **Estado:** Implementado.
- **Decisión:** Gastos e ingresos se crean como propuestas pendientes y solo las respuestas de confirmación los llevan a `confirmado`.
- **Evidencia:** enums y restricciones de las migraciones; procesamiento del webhook y mensajes de propuesta.
- **Motivo:** El PRD lo declara como política de producto para evitar cambios silenciosos, pero la razón no aparece como decisión técnica independiente.

## ADR-007 — Producción usa una pila Docker versionada con Supabase externo

- **Estado:** Implementado/documentado.
- **Decisión:** Caddy, web, Ollama, Evolution, PostgreSQL y Redis se administran con `docker-compose.prod.yml`; Supabase permanece alojado externamente.
- **Evidencia:** Compose, Caddyfile, workflow y [DEPLOYMENT.md](DEPLOYMENT.md).
- **Motivo:** La documentación indica que se adopta la pila existente del VPS; no se documenta el motivo original de separar Supabase.
