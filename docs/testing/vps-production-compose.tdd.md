# Evidencia TDD: Compose de producción del VPS

## Objetivo

Versionar la pila que ya funciona en el VPS sin crear un proyecto Docker paralelo, publicar servicios internos ni perder los volúmenes existentes.

## RED

```powershell
cd apps/web
npx vitest run src/lib/production-infra-config.test.ts --reporter=verbose
```

La prueba de adopción falló 4 de 7 casos: faltaban Caddy y Ollama, web y Evolution publicaban puertos directamente, la contraseña se llamaba `EVOLUTION_POSTGRES_PASSWORD` en lugar del nombre ya configurado `EVOLUTION_DB_PASSWORD`, y no existía el Caddyfile versionado.

## GREEN

El mismo comando pasó 7 de 7 pruebas después de alinear el repositorio con el VPS.

| Garantía | Evidencia automatizada |
| --- | --- |
| El proyecto `moni` contiene los seis servicios y no usa imágenes `latest` | `defines the complete production stack with pinned images` |
| Solo Caddy publica puertos; web, Evolution y datos permanecen internos | `publishes only Caddy and keeps application and data ports internal` |
| Los secretos requeridos usan los mismos nombres del entorno real | `requires production secrets without committing their values` |
| Se conservan nombres de contenedor, seis volúmenes y el proxy existente | `persists Caddy, Ollama and the existing production service names` |
| Evolution activa persistencia y valores conservadores | `enables Evolution production persistence and conservative defaults` |
| Next.js se construye standalone y se ejecuta sin root | `builds Next.js as a standalone production image` |
| El workflow valida SSH, despliega toda la pila y espera healthchecks | `deploys and waits for the complete stack` |

## Verificaciones adicionales

- `docker compose ... config --quiet` valida el archivo con `.env.production.example`.
- La lista resuelta contiene `caddy`, `web`, `ollama`, `evolution-api`, `evolution-postgres` y `evolution-redis`.
- Las versiones fijadas de Caddy, Ollama y Evolution coinciden con las observadas en el VPS.
- La suite completa pasó 109 de 109 pruebas; ESLint y `tsc --noEmit` pasaron sin errores.
- `npm audit --audit-level=high` reportó 0 vulnerabilidades.
- `git diff --check` no encontró errores de espacios ni conflictos.
