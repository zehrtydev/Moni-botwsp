# Estado del proyecto

**Actualizado:** 2026-09-14

Este estado describe evidencia del repositorio; no sustituye una verificación del entorno desplegado.

## Funciona según código y pruebas presentes

- Aplicación Next.js con login, callback de autenticación y dashboard.
- Landing pública responsive en `/`, con CTA resuelto por sesión en servidor, mockups estáticos del flujo conversacional y del dashboard, y acceso público limitado al inicio de sesión.
- `/login` redirige en servidor a usuarios autenticados y ofrece inicio de sesión o registro público mediante Supabase Auth; el cierre de sesión vuelve a `/`.
- Vinculación de WhatsApp con formato E.164 y pairing temporal; el número solo se asigna al usuario al consumir un código válido mediante una operación transaccional que también retira mappings LID obsoletos.
- Webhook de Evolution con validación, normalización, idempotencia y manejo de errores.
- Parsing determinista de gastos, ingresos, comandos, correcciones y presupuestos.
- Interpretación opcional de gastos mediante proveedor OpenAI-compatible/Ollama.
- Historial, edición/eliminación de gastos y eliminación de ingresos autenticadas.
- Estadísticas de seis meses, categorías y balance neto.
- Presupuestos mensuales y health check.
- Migraciones Supabase con RLS, restricciones de propiedad e índices de idempotencia.
- Suite Vitest, pruebas de rutas y una prueba E2E smoke configuradas.

El repositorio contiene 28 archivos de pruebas Vitest. La validación de esta actualización ejecutó 136/136 pruebas, ESLint y TypeScript sin errores. El nuevo archivo pgTAP de pairing pasó 37/37 pruebas contra Supabase local.

## Desarrollo o cobertura incompleta observable

- Hay soporte de entrada de imagen y columnas de media, pero no se demuestra un pipeline completo de visión/OCR en el código actual.
- Existe el rol y la tabla de administración/auditoría, pero no una consola admin visible en las rutas actuales.
- El flujo de cambio de número está representado por esquema y funciones, pero no se observa una ruta UI/API completa para soporte.
- La configuración de producción documenta una adopción automática al VPS, pero la checklist de `docs/DEPLOYMENT.md` todavía tiene pasos sin marcar.

## Problemas o riesgos verificables

- `supabase test db` mantiene un fallo preexistente en `001_foundation.sql`: la prueba espera diez categorías activas, mientras que el seed actual contiene quince. El nuevo `002_whatsapp_pairing.sql` pasa 37/37; la carpeta completa queda en 57/58 por esa contradicción entre el test fundacional y `supabase/seed.sql`.
- La documentación ya fue normalizada para usar `https://moni.zehrty.dev` como dominio canónico actual de producción. Sigue pendiente verificar en el panel real de Supabase que **Site URL** y **Redirect URLs** coincidan con `https://moni.zehrty.dev`; esto no puede comprobarse únicamente desde el repositorio.
- El PRD describe `n8n` como superficie de webhook, pero el código actual procesa directamente en `/api/webhooks/whatsapp`; no hay configuración de n8n en el árbol inspeccionado.
- El PRD histórico declara fuera de alcance presupuestos e ingresos, aunque ambos están implementados en código y migraciones.
- El PRD y su catálogo inicial no reflejan todas las categorías actuales de `supabase/seed.sql`.
- No se puede afirmar desde el checkout que la producción esté actualmente saludable; debe comprobarse con la guía de despliegue y `/api/health`.

## Componentes importantes

- Web: `apps/web/src/app`, `apps/web/src/components`, `apps/web/src/lib`.
- Persistencia: `supabase/migrations`, `supabase/seed.sql`.
- Producción: `docker-compose.prod.yml`, `deploy/caddy/Caddyfile`, `.github/workflows/deploy-vps.yml`.
- Operación: [BETA-OPERATIONS.md](BETA-OPERATIONS.md) y [docs/testing/](testing/).

## Siguiente foco inferido

La única prioridad operativa que puede inferirse de la documentación es seguir la beta, medir errores del webhook y resolver fallos repetidos del flujo principal antes de ampliar áreas del producto. Cualquier siguiente funcionalidad concreta queda **Por definir**.
