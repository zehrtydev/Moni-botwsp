# Preparación para producción

## Arquitectura recomendada

- Next.js: Vercel, Railway o un servidor Node.
- Supabase: proyecto hosted con migraciones aplicadas.
- Evolution API: VPS o servicio Docker con almacenamiento persistente.
- Ollama: solo en una máquina con recursos suficientes; no se recomienda ponerlo en una función serverless.

Evolution y Next.js no deben depender de `localhost` en producción. Evolution necesita llegar a una URL HTTPS pública del webhook de Next.js.

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
- `AI_BASE_URL` y `AI_MODEL`, si se usa IA local/remota

Genera un secreto fuerte para el webhook, por ejemplo con PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

## Checklist antes de publicar

- [ ] Proyecto Supabase de producción creado.
- [ ] Migraciones aplicadas y RLS verificado.
- [ ] Backup y recuperación de la base definidos.
- [ ] URL HTTPS pública del webhook configurada en Evolution.
- [ ] Evolution usa una versión fijada y volúmenes persistentes.
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

## Monitoreo

Configura un monitor HTTPS para:

```text
GET https://<dominio-de-moni>/api/health
```

Se espera `200` y un cuerpo con `status: "ok"`. Una respuesta `503` indica configuración incompleta o que la aplicación no puede consultar Supabase. El endpoint no devuelve nombres de variables, claves ni información de usuarios.

## Bloqueo actual del despliegue

Todavía no se puede ejecutar un despliegue real sin elegir proveedor, dominio/URL pública y proyecto Supabase de producción. Además, Evolution local no es accesible desde Internet. La aplicación queda preparada, pero no se deben inventar esas credenciales ni publicar el webhook sin ellas.
