# Moni — contexto para agentes

Moni es una aplicación Next.js que registra gastos e ingresos por WhatsApp y los consulta en un dashboard web autenticado. El código y la configuración son la fuente principal de verdad; la documentación es secundaria. No inventes contexto: si hay una contradicción, documéntala y señala qué fuente la contiene.

## Antes de cambiar algo

1. Lee [README.md](README.md).
2. Lee [docs/PROJECT.md](docs/PROJECT.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [docs/STATUS.md](docs/STATUS.md).
3. Consulta [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/BETA-OPERATIONS.md](docs/BETA-OPERATIONS.md) y [docs/SUPABASE-AUTH-MONI.md](docs/SUPABASE-AUTH-MONI.md) según la tarea.
4. Para pruebas, lee [docs/testing/](docs/testing/) y revisa los scripts de `apps/web/package.json`.

## Reglas

- No modifiques producción, infraestructura, migraciones, dependencias, secretos ni `.env` sin una petición explícita.
- No hagas commit ni push salvo que se solicite explícitamente.
- Valida entradas en los límites del sistema y conserva el aislamiento por usuario/RLS.
- No cambies contratos de WhatsApp, Supabase o despliegue sin revisar el código y la documentación relacionada.
- Actualiza `docs/STATUS.md` cuando cambie el estado verificable del proyecto y `docs/DECISIONS.md` cuando se incorpore o confirme una decisión arquitectónica.
- Mantén los cambios pequeños y no elimines documentación existente.

## Comandos verificables

Desde `apps/web/`:

```bash
npm ci
npm run test
npm run test:e2e
npx tsc --noEmit
npm run lint
npm run build
npm audit --audit-level=high
```

Para entorno local, sigue [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md). Para producción, sigue [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md); nunca imprimas `.env.production` ni claves.
