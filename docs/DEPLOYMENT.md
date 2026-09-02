# Despliegue de Moni en el VPS

## Arquitectura definitiva

`docker-compose.prod.yml` administra un único proyecto Docker llamado `moni` y adopta la pila que ya existe en `/opt/moni`:

- Caddy publica `80/tcp`, `443/tcp` y `443/udp`, conserva los certificados en volúmenes y dirige `moni.zehrty.dev` a `web:3000`.
- Next.js, Evolution API y Ollama solo son accesibles por la red Docker.
- PostgreSQL y Redis solo pertenecen a la red interna de datos de Evolution.
- Supabase permanece alojado externamente.
- Los volúmenes `caddy_data`, `caddy_config`, `ollama_data`, `evolution_instances`, `evolution_postgres` y `evolution_redis` sobreviven a recreaciones de contenedores.

El Compose conserva los nombres actuales `moni-caddy`, `moni-web`, `moni-ollama`, `moni-evolution`, `moni-evolution-postgres` y `moni-evolution-redis`. Esto evita levantar una segunda pila en paralelo y permite reutilizar los volúmenes `moni_*` existentes.

Evolution debe enviar `MESSAGES_UPSERT` a `https://moni.zehrty.dev/api/webhooks/whatsapp` con un header `x-webhook-secret` igual a `WHATSAPP_WEBHOOK_SECRET`.

## Versiones fijadas

- Caddy `2.11.4-alpine`
- Ollama `0.33.2`
- modelo Ollama `qwen3:1.7b`
- Evolution API `v2.3.7`
- PostgreSQL `15.19-alpine3.24`
- Redis `7.4.11-alpine3.21`
- Node.js `22.23.2-alpine3.23`

No se usa `latest` en producción. Las actualizaciones deben hacerse de forma deliberada, con backup y verificación posterior.

## Variables de entorno

El archivo real es `/opt/moni/.env.production`, debe permanecer fuera de Git y con permisos `600`. `.env.production.example` es únicamente el inventario sin secretos.

Variables requeridas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_WEBHOOK_SECRET`
- `EVOLUTION_API_KEY`
- `EVOLUTION_DB_PASSWORD`, usando caracteres seguros dentro de una URL

Variables con valores operativos configurables:

- `EVOLUTION_API_URL=http://evolution-api:8080`
- `EVOLUTION_INSTANCE_NAME=moni-production`
- `AI_PROVIDER=ollama`
- `AI_BASE_URL=http://ollama:11434/v1`
- `AI_MODEL=qwen3:1.7b`

`EVOLUTION_SERVER_URL` es opcional y por defecto vale `http://127.0.0.1:8080`. No imprimas el contenido del archivo real al diagnosticar; valida solo sus nombres y el Compose resuelto.

```bash
cd /opt/moni
chmod 600 .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

## Despliegue automático

`.github/workflows/deploy-vps.yml` se ejecuta con cada push a `master`. GitHub Actions necesita estos secretos del repositorio:

- `VPS_HOST`: IP o hostname del VPS.
- `VPS_USER`: usuario de despliegue, actualmente `moniadmin`.
- `VPS_SSH_KEY`: clave privada cuya pública está autorizada en el VPS.
- `VPS_HOST_FINGERPRINT`: huella SHA256 Ed25519 del servidor, con formato `SHA256:...`.

Obtén la huella directamente en el VPS:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256 | awk '{print $2}'
```

El workflow verifica esa huella, hace `git pull --ff-only`, valida el Compose, descarga las imágenes fijadas, construye la web, levanta los seis servicios con `--wait` y comprueba `https://moni.zehrty.dev/api/health`.

## Primera adopción del checkout existente

El VPS fue preparado manualmente antes de que estos archivos existieran en Git. Por eso `apps/web/Dockerfile`, `deploy/` y `docker-compose.prod.yml` aparecen como archivos sin seguimiento y bloquearían el primer `git pull`. Justo antes del primer push, crea una copia fuera del repositorio y aparta únicamente esos archivos; no muevas `.env.production` ni elimines volúmenes.

```bash
cd /opt/moni
backup_dir="/opt/moni-predeploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir/apps/web" "$backup_dir/deploy"
cp -a docker-compose.prod.yml "$backup_dir/"
cp -a apps/web/Dockerfile "$backup_dir/apps/web/"
cp -a deploy/. "$backup_dir/deploy/"
mv docker-compose.prod.yml "$backup_dir/docker-compose.prod.yml.active"
mv apps/web/Dockerfile "$backup_dir/apps/web/Dockerfile.active"
mv deploy "$backup_dir/deploy.active"
git status --short --branch
```

Después de comprobar que ya no aparecen esos tres conflictos, se puede hacer el push. La acción traerá sus reemplazos versionados. Si el workflow no arranca inmediatamente, restaura los archivos `.active` desde el backup para que el montaje de Caddy siga disponible.

## Verificación posterior

```bash
cd /opt/moni
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl --fail --silent --show-error https://moni.zehrty.dev/api/health
docker exec moni-ollama ollama list
```

Se espera que los seis servicios estén `running` o `healthy`, que el endpoint devuelva `status: ok` y que Ollama liste `qwen3:1.7b`.

## Backups y recuperación

El backup de Supabase debe probarse en un proyecto separado. El VPS también debe respaldar los seis volúmenes Docker; el backup de Supabase no contiene certificados TLS, el modelo local, la sesión de WhatsApp ni los datos internos de Evolution.

Nunca pruebes una restauración sobre la base activa sin ventana de mantenimiento y una copia adicional verificada.

## Checklist

- [x] DNS de `moni.zehrty.dev` apunta al VPS.
- [x] HTTPS de Let's Encrypt responde con certificado válido.
- [x] `GET /api/health` devuelve `status: ok` desde el VPS.
- [x] `.env.production` existe, contiene el inventario requerido y tiene permisos `600`.
- [x] Los seis contenedores están operativos y Ollama tiene `qwen3:1.7b`.
- [x] El Compose versionado adopta el proyecto, contenedores y volúmenes actuales.
- [ ] Migraciones de Supabase y RLS verificadas.
- [ ] Backups y restauración de prueba verificados.
- [ ] Los cuatro secretos de GitHub Actions están configurados.
- [ ] Se realizó el backup previo y se apartaron los archivos sin seguimiento conflictivos.
- [ ] El primer despliegue automático terminó correctamente.
- [ ] Se completó una prueba funcional real de WhatsApp.
