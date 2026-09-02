# Evidencia TDD: Compose de producción del VPS

## Objetivo

Ejecutar la web, Evolution API, PostgreSQL y Redis como un stack persistente y verificable en el VPS, sin publicar bases de datos ni secretos.

## RED

Comando:

```powershell
cd apps/web
npx vitest run src/lib/production-infra-config.test.ts --reporter=verbose
```

Resultado inicial: 5 pruebas fallaron porque no existían `docker-compose.prod.yml` ni `apps/web/Dockerfile`, Next.js no generaba una imagen standalone y el workflow levantaba solamente `web`.

## GREEN

El mismo comando pasó 6 de 6 pruebas después de implementar el stack.

| Garantía | Evidencia automatizada |
| --- | --- |
| El stack contiene web, Evolution, PostgreSQL y Redis con imágenes fijadas | `defines the complete production stack with pinned images` |
| Los puertos públicos se enlazan a loopback y la red de datos es interna | `keeps public ports on loopback and data services internal` |
| Los secretos son obligatorios y sus valores no se versionan | `requires production secrets without committing their values` |
| Evolution activa Postgres persistente, Redis conservador y no expone el listado de instancias | `enables Evolution production persistence and conservative defaults` |
| Next.js se construye como imagen standalone y no-root | `builds Next.js as a standalone production image` |
| El workflow valida la huella SSH, levanta y espera el stack completo | `deploys and waits for the complete stack` |

## Verificaciones adicionales

- `docker compose ... config --quiet` valida la estructura usando `.env.production.example`.
- `docker compose ... build web` construyó la imagen standalone con Node `22.23.2` y reportó 0 vulnerabilidades durante `npm ci`.
- La imagen temporal respondió HTTP 200 en `127.0.0.1:3100` y el contenedor de prueba fue eliminado al finalizar.
- La suite completa pasó 108 de 108 pruebas; ESLint y `tsc --noEmit` pasaron sin errores.
- `npm audit --audit-level=high` reportó 0 vulnerabilidades después de actualizar dependencias transitivas del lockfile.
- La primera ejecución real en el VPS sigue requiriendo proxy HTTPS, secretos, migraciones y backups.

La cobertura global no se midió porque el proyecto no define actualmente un script o proveedor de cobertura. Las cinco garantías nuevas sí están cubiertas directamente por la prueba de infraestructura.
