# Preparación para producción

## Arquitectura de producción

- Next.js y Evolution API se ejecutan en el VPS mediante `docker-compose.prod.yml`.
- PostgreSQL y Redis son servicios privados dedicados a Evolution, con volúmenes persistentes.
- Supabase permanece hosted y recibe las migraciones del repositorio.
- El proxy HTTPS instalado en el host dirige `moni.zehrty.dev` a `127.0.0.1:3000`.
- Evolution queda disponible solo en `127.0.0.1:8080`; su administración requiere un túnel SSH.
- Ollama no forma parte del stack inicial del VPS. La IA remota es opcional y el parser determinista sigue disponible sin ella.

La web se comunica con Evolution por la red Docker mediante `http://evolution-api:8080`. Evolution debe enviar el evento `MESSAGES_UPSERT` a `https://moni.zehrty.dev/api/webhooks/whatsapp` y usar un header `x-webhook-secret` que coincida con `WHATSAPP_WEBHOOK_SECRET`.

## Variables de entorno

Configura las variables de `apps/web/.env.example` en el proveedor. Las claves privadas deben configurarse en el panel de secretos del proveedor, nunca en GitHub.

Valores que deben cambiarse en producción:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_WEBHOOK_SECRET`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `EVOLUTION_SERVER_URL`, URL que Evolution usa para generar enlaces internos. Déjala en `http://127.0.0.1:8080` si solo entrarás por túnel SSH, o cámbiala a la URL HTTPS pública si decides exponer Evolution detrás del proxy.
- `EVOLUTION_POSTGRES_PASSWORD`, generado con caracteres seguros para una URL
- `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL` y `AI_MODEL`, si se usa IA remota

Genera un secreto fuerte para el webhook, por ejemplo con PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

## Archivo de entorno del VPS

El archivo real vive en `/opt/moni/.env.production`, debe tener permisos `600` y nunca se versiona. Usa `.env.production.example` como inventario y reemplaza todos los placeholders en el VPS.

```bash
cd /opt/moni
cp .env.production.example .env.production
chmod 600 .env.production
```

No reutilices claves del Supabase local. `NEXT_PUBLIC_SUPABASE_URL`, las claves de Supabase y las URLs de autenticación deben pertenecer al proyecto hosted de producción.

Antes del primer despliegue, valida la configuración sin imprimir los valores resueltos:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

## Despliegue automático

El workflow `.github/workflows/deploy-vps.yml` se ejecuta al hacer push a `master`. El repositorio debe existir en `/opt/moni` y GitHub debe tener configurados los secretos `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` y `VPS_HOST_FINGERPRINT`. Este último debe ser la huella SHA256 de la clave SSH Ed25519 del servidor, por ejemplo `SHA256:...`, obtenida por un canal confiable; el workflow rechaza una clave diferente.

El workflow actualiza el checkout con avance rápido, valida el Compose, descarga las imágenes fijadas, construye la web, levanta el stack completo y espera sus healthchecks. Finalmente comprueba `https://moni.zehrty.dev/api/health`.

## Checklist antes de publicar

- [ ] Proyecto Supabase de producción creado.
- [ ] Migraciones aplicadas y RLS verificado.
- [ ] Backup y recuperación de la base definidos.
- [ ] URL HTTPS pública del webhook configurada en Evolution.
- [x] El Compose versionado usa imágenes fijadas y volúmenes persistentes para Evolution.
- [ ] Secretos configurados fuera del repositorio.
- [ ] `npm ci`, tests, build y `npm audit --audit-level=high` pasan.
- [ ] Pruebas manuales de registro, confirmación, corrección y consulta completadas.
- [ ] Rate limiting y monitoreo definidos para el webhook.
- [ ] Monitor externo configurado contra `GET /api/health`.
- [ ] Se ejecutó una restauración de prueba en un proyecto o base separada.

## Backups y recuperación

El backup de Supabase debe estar habilitado en el proyecto hosted según el proveedor contratado. Para Moni no basta con confirmar que existe un backup: hay que probar que se puede restaurar.

Procedimiento mínimo mensual:

1. Confirmar que el backup más reciente es posterior al último despliegue.
2. Crear o seleccionar un proyecto/base de recuperación separado.
3. Restaurar allí el backup y aplicar las migraciones faltantes, si las hay.
4. Ejecutar las pruebas SQL de `supabase/tests/database/001_foundation.sql`.
5. Verificar manualmente login, lectura del dashboard y procesamiento de un mensaje de prueba.
6. Registrar fecha, responsable, versión de migraciones y resultado.

No pruebes una restauración sobre la base activa sin una ventana de mantenimiento y una copia adicional verificada.

El VPS también debe respaldar los volúmenes `evolution_instances`, `evolution_postgres` y `evolution_redis`. El backup de Supabase no contiene la sesión de WhatsApp ni los datos internos de Evolution.

## Monitoreo

Configura un monitor HTTPS para:

```text
GET https://<dominio-de-moni>/api/health
```

Se espera `200` y un cuerpo con `status: "ok"`. Una respuesta `503` indica configuración incompleta o que la aplicación no puede consultar Supabase. El endpoint no devuelve nombres de variables, claves ni información de usuarios.

## Estado actual del despliegue

El repositorio ya contiene el Compose de producción, la imagen standalone de Next.js y el workflow de despliegue. Antes de activar el primer despliegue todavía se debe crear `/opt/moni/.env.production`, configurar el proxy HTTPS, verificar los secretos de GitHub, aplicar las migraciones en Supabase hosted y establecer el backup de los volúmenes del VPS.
