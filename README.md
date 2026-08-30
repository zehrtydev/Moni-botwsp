# Moni

Moni registra gastos por WhatsApp y los muestra en un dashboard financiero mobile-first.

## Stack

- Next.js 16 + React 19
- Supabase local/hosted para autenticación y persistencia
- Evolution API 2.3.7 para WhatsApp local
- Ollama opcional para interpretar mensajes naturales sin API key
- Recharts para visualizaciones

## Inicio rápido local

Consulta [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md) para levantar Supabase, Evolution, Ollama y la aplicación.

```powershell
cd apps/web
npm ci
npm run dev
```

## Validación

```powershell
cd apps/web
npm run test
npm run test:e2e
npx tsc --noEmit
npm run lint
npm run build
npm audit --audit-level=high
```

## Despliegue

La guía de producción está en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). La aplicación web y Evolution API son servicios distintos: el webhook debe ser accesible públicamente y usar HTTPS.

Para operar la beta y revisar errores semanalmente, consulta [docs/BETA-OPERATIONS.md](docs/BETA-OPERATIONS.md).

No subas archivos `.env`, claves de Supabase, claves de Evolution ni tokens al repositorio.
