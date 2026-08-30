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

## Bloqueo actual del despliegue

Todavía no se puede ejecutar un despliegue real sin elegir proveedor, dominio/URL pública y proyecto Supabase de producción. Además, Evolution local no es accesible desde Internet. La aplicación queda preparada, pero no se deben inventar esas credenciales ni publicar el webhook sin ellas.
