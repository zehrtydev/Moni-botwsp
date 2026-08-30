# Configuración de autenticación de Moni

## URLs públicas

En Supabase, en **Authentication → URL Configuration**:

- Site URL: `https://moni-botwsp.vercel.app`
- Redirect URL: `https://moni-botwsp.vercel.app/auth/callback`

Para desarrollo local se puede conservar `http://localhost:3000/auth/callback` como URL adicional.

## Correo de confirmación

En **Authentication → Email Templates → Confirm signup**:

- Asunto: `Confirma tu correo y empieza con Moni 💜`
- Usa `{{ .ConfirmationURL }}` como enlace del botón.

Plantilla sugerida:

```html
<div style="margin:0;background:#f7f5fb;padding:40px 20px;font-family:Arial,sans-serif;color:#292638">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:28px;padding:40px;box-shadow:0 16px 40px rgba(65,50,130,.12)">
    <p style="color:#7564e9;font-size:22px;font-weight:700;margin:0 0 28px">moni</p>
    <h1 style="font-size:30px;margin:0 0 16px">¡Hola! 👋</h1>
    <p style="font-size:16px;line-height:1.6">Confirma tu correo para activar tu espacio financiero en Moni y empezar a organizar tus ingresos y gastos.</p>
    <p style="text-align:center;margin:32px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#7564e9;color:#fff;text-decoration:none;border-radius:14px;padding:15px 26px;font-weight:700">Confirmar mi correo</a></p>
    <p style="font-size:13px;line-height:1.5;color:#77738b">Si no creaste esta cuenta, puedes ignorar este mensaje.</p>
  </div>
</div>
```
