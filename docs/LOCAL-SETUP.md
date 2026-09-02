# Entorno local de Moni

## Requisitos

- Node.js 20 o superior
- Docker Desktop
- Ollama opcional
- Un número de WhatsApp de pruebas

## Supabase

Desde la raíz del repositorio:

```powershell
supabase start
supabase db reset
```

Completa `apps/web/.env.local` con los valores mostrados por `supabase status`. No compartas la `service_role` key.

## Evolution API

Evolution está definido en `infra/evolution/docker-compose.yml` y usa la imagen fijada `evoapicloud/evolution-api:v2.3.7`.

```powershell
cd infra/evolution
docker compose up -d
```

Configura la instancia `moni-local`, vincula el número de pruebas y apunta el evento `MESSAGES_UPSERT` al webhook:

```text
http://host.docker.internal:3000/api/webhooks/whatsapp
```

El secreto configurado en Evolution debe coincidir con `WHATSAPP_WEBHOOK_SECRET`.

## Ollama (opcional)

```powershell
ollama pull qwen3:1.7b
```

En `apps/web/.env.local`:

```env
AI_PROVIDER=ollama
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=qwen3:1.7b
```

Si Ollama no responde, Moni conserva el parser determinista y no registra gastos automáticamente sin confirmación.

## Aplicación web

```powershell
cd apps/web
npm ci
npm run dev
```

Abre `http://127.0.0.1:3000`.

## Flujo de prueba WhatsApp

1. Registra una cuenta en Moni.
2. Vincula el número de prueba desde el dashboard.
3. Envía `Hola` y verifica el saludo.
4. Envía `Gasté 20 lucas en almuerzo`.
5. Confirma con `sí` o `1`.
6. Prueba `Corrige el último gasto, eran 25 mil`.
7. Prueba una consulta como `¿Cuánto llevo gastado este mes?`.

Las respuestas interactivas pueden llegar como botones solo en versiones/modos compatibles de Evolution; en la versión local fijada se mantiene el fallback `1`/`2`.
