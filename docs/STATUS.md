# Estado del proyecto

**Actualizado:** 2026-09-26

Este estado describe evidencia del repositorio y la verificación puntual de despliegue del 2026-09-26; no sustituye la monitorización continua del entorno desplegado.

## Funciona según código y pruebas presentes

- Aplicación Next.js con login, callback SSR de confirmación por `token_hash` y `verifyOtp`, y dashboard.
- Landing pública responsive en `/`, con CTA resuelto por sesión en servidor, mockups estáticos del flujo conversacional y del dashboard, y acciones públicas diferenciadas para iniciar sesión o abrir directamente el registro.
- `/login` redirige en servidor a usuarios autenticados, abre el registro desde `?mode=register` y ofrece inicio de sesión o registro público mediante Supabase Auth; el cierre de sesión vuelve a `/`.
- Vinculación de WhatsApp con formato E.164 y pairing temporal de seis caracteres seguros mostrado como `AB2 CD3` (también acepta `AB2CD3`, minúsculas y espacios exteriores); el webhook admite contactos LID y contactos entregados directamente como JID/número normal. El número solo se asigna mediante una operación transaccional que consume un código válido, exige coincidencia entre hash y remitente en el flujo por número y retira mappings LID obsoletos.
- Webhook de Evolution con validación, normalización, idempotencia y manejo de errores; los conflictos de pairing con números ya vinculados se reconocen con 2xx y no provocan reintentos del proveedor.
- Parsing determinista de gastos, ingresos, comandos, correcciones y presupuestos.
- Interpretación opcional de gastos mediante proveedor OpenAI-compatible/Ollama.
- Historial, edición/eliminación de gastos y eliminación de ingresos autenticadas.
- Estadísticas de seis meses, categorías y balance neto.
- Presupuestos mensuales y health check.
- Migraciones Supabase con RLS, restricciones de propiedad e índices de idempotencia.
- Suite Vitest, pruebas de rutas y una prueba E2E smoke configuradas.
- Despliegue automático desde pushes a `main`: la ejecución de verificación del commit `73e888e` completó calidad, publicación de imagen, despliegue al VPS y health check público. La variable `PRODUCTION_DEPLOY_ENABLED` está habilitada.

El repositorio contiene 30 archivos de pruebas Vitest. La validación de esta actualización ejecutó 190/190 pruebas de la suite completa, ESLint y TypeScript sin errores directamente en este worktree. El formulario informa del envío pendiente de verificación y presenta el fallo de envío como error, sin anunciar una vinculación completada. El archivo pgTAP de pairing pasó 66/66 pruebas contra Supabase local.

## Desarrollo o cobertura incompleta observable

- Hay soporte de entrada de imagen y columnas de media, pero no se demuestra un pipeline completo de visión/OCR en el código actual.
- Existe el rol y la tabla de administración/auditoría, pero no una consola admin visible en las rutas actuales.
- El flujo de cambio de número está representado por esquema y funciones, pero no se observa una ruta UI/API completa para soporte.
- Quedan pendientes la verificación de migraciones/RLS en producción, backups con restauración de prueba y una prueba funcional real de WhatsApp; ver la checklist de `docs/DEPLOYMENT.md`.

## Problemas o riesgos verificables

- `supabase test db` mantiene un fallo preexistente en `001_foundation.sql`: la prueba espera diez categorías activas, mientras que el seed actual contiene quince. `002_whatsapp_pairing.sql` pasa 66/66; la carpeta completa queda en 86/87 por esa contradicción entre el test fundacional y `supabase/seed.sql`.
- La documentación ya fue normalizada para usar `https://moni.zehrty.dev` como dominio canónico actual de producción y la plantilla **Confirm signup** usa el callback SSR con `token_hash` y `type=email`. Sigue pendiente verificar en el panel real de Supabase que **Site URL** y **Redirect URLs** coincidan con `https://moni.zehrty.dev`; esto no puede comprobarse únicamente desde el repositorio.
- El PRD describe `n8n` como superficie de webhook, pero el código actual procesa directamente en `/api/webhooks/whatsapp`; no hay configuración de n8n en el árbol inspeccionado.
- El PRD histórico declara fuera de alcance presupuestos e ingresos, aunque ambos están implementados en código y migraciones.
- El PRD y su catálogo inicial no reflejan todas las categorías actuales de `supabase/seed.sql`.
- El health check público devolvió `status: ok` con configuración y base de datos en estado `ok` durante el despliegue verificado el 2026-09-26. Esa comprobación puntual no sustituye monitorización continua.

## Componentes importantes

- Web: `apps/web/src/app`, `apps/web/src/components`, `apps/web/src/lib`.
- Persistencia: `supabase/migrations`, `supabase/seed.sql`.
- Producción: `docker-compose.prod.yml`, `deploy/caddy/Caddyfile`, `.github/workflows/deploy-vps.yml`.
- Operación: [BETA-OPERATIONS.md](BETA-OPERATIONS.md) y [docs/testing/](testing/).

## Siguiente foco inferido

La única prioridad operativa que puede inferirse de la documentación es seguir la beta, medir errores del webhook y resolver fallos repetidos del flujo principal antes de ampliar áreas del producto. Cualquier siguiente funcionalidad concreta queda **Por definir**.
