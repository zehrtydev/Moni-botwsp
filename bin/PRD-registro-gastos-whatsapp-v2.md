# PRD — Registro de Gastos por WhatsApp (v2)

> Cambios respecto a v1: se define autenticación y vinculación de número, manejo de estado conversacional, catálogo de categorías, stack dimensionado para 1000 usuarios, y un apéndice técnico para desarrollo asistido por agente.

## 1. Resumen

Una aplicación que permite registrar gastos enviando mensajes de texto o fotos de recibos por WhatsApp. El sistema interpreta el contenido, propone un registro estructurado y lo confirma antes de incorporarlo al historial. Una aplicación web permite consultar los gastos y sus totales.

**Propuesta de valor:** registrar un gasto en menos de 10 segundos desde un canal habitual, sin perder control sobre la información guardada.

**Escala objetivo:** la v1 se lanza para un grupo cerrado de hasta 10 usuarios. El modelo de datos, la seguridad (RLS) y la lógica de estado conversacional se diseñan desde ahora para soportar hasta 1000 usuarios sin rediseño; lo único que cambia al escalar es la capa de infraestructura (plan/hosting), no el esquema ni la lógica de negocio. Ver §7.1 para el detalle de qué se mantiene y qué se ajusta.

## 2. Problema

Registrar gastos en una hoja de cálculo o una aplicación requiere abrirla, buscar una categoría y llenar campos. Esa fricción hace que los registros se pospongan o se olviden. WhatsApp reduce el esfuerzo: basta enviar un texto como "gasté 20 mil en una hamburguesa" o una foto del recibo.

## 3. Objetivo del MVP

Permitir que un usuario registre y confirme gastos por WhatsApp, y consulte posteriormente sus gastos confirmados en una aplicación web.

### Métrica de éxito inicial

- Un gasto de texto completo queda confirmado en menos de un minuto.
- No se crean gastos duplicados ante reintentos del webhook.
- Los gastos confirmados se pueden consultar y filtrar desde la web.
- Ningún usuario puede ver o modificar gastos de otro usuario.

## 4. Alcance

### Incluido en el MVP

- Registro (onboarding) de un usuario nuevo vinculando su número de WhatsApp.
- Registro de gastos por mensaje de texto en WhatsApp.
- Extracción de monto, descripción, categoría, fecha y moneda.
- Solicitud de aclaración cuando falte información crítica o exista baja confianza.
- Confirmación explícita antes de consolidar el gasto.
- Prevención de registros duplicados.
- Manejo de un único "gasto pendiente" activo por usuario a la vez.
- Almacenamiento de gastos y consulta web con filtros por fecha y categoría.
- Totales para el período seleccionado.
- Autenticación web por OTP al número de WhatsApp registrado.

### Incluido si no retrasa el MVP

- Registro por foto de factura o recibo.
- Almacenamiento privado del soporte y visualización desde la web.

### Fuera de alcance por ahora

- Presupuestos, alertas y metas de gasto.
- Exportación a PDF o Excel.
- Cuentas compartidas entre varios usuarios.
- Edición compleja desde WhatsApp.
- Separación automática de varios artículos de un mismo recibo.
- Categorías personalizadas por usuario (el catálogo es fijo y global en el MVP).

## 5. Reglas de producto

- La moneda predeterminada es **COP**.
- Los valores se almacenan como enteros en pesos colombianos; no se usan números de punto flotante.
- Si el mensaje no incluye una fecha, se utiliza la fecha local de recepción en la zona horaria `America/Bogota`.
- Las categorías provienen de un catálogo cerrado en base de datos (ver §8), no de texto libre: `Alimentación`, `Transporte`, `Hogar`, `Salud`, `Ocio`, `Educación`, `Servicios`, `Compras`, `Deudas`, `Otros`.
- Un gasto no se considera definitivo hasta que esté en estado `confirmado`.
- Los soportes de recibos son privados y solo se entregan mediante acceso autenticado o URL firmada temporal.
- Un usuario solo puede tener **un gasto en estado `pendiente_confirmacion` a la vez**. Si manda un mensaje nuevo mientras hay uno pendiente, el bot le pide primero resolver el pendiente (confirmar o descartar).
- El número de celular es el identificador principal para toda interacción por WhatsApp; la cédula es únicamente un identificador secundario para procesos de soporte (nunca se usa para identificar al usuario en el flujo conversacional).
- Un usuario nuevo (número no registrado) que escribe al bot recibe una invitación a registrarse en la web antes de poder registrar gastos.

## 6. Flujo funcional

### 6.1 Onboarding y vinculación de número

1. El primer contacto siempre ocurre en la aplicación web: el usuario se registra ahí, no escribiendo primero al bot.
2. En el registro, el usuario ingresa: número de celular (identificador **principal**) y número de cédula (identificador **secundario**, usado únicamente para soporte/recuperación).
3. La web envía un código OTP al número de celular para verificar que le pertenece.
4. Verificado, se crea el registro en `usuarios` con `numero_whatsapp` y `cedula` asociados.
5. Tras completar el registro, la web redirige al usuario al chat de WhatsApp del bot (deep link `wa.me`), listo para empezar a registrar gastos.
6. Si un número no registrado escribe al bot, este responde indicando que debe registrarse primero en la web, con el enlace correspondiente. No se procesan gastos de números no vinculados.

**Reemplazo de número (pérdida o cambio de celular):**

Si el usuario pierde o cambia de número, el número de celular ya no sirve para identificarlo, por lo que el flujo de reemplazo no puede iniciarse desde el chat con el número nuevo (ese número no está vinculado a ninguna cuenta todavía). El proceso es:

1. El usuario contacta a soporte (proceso manual en v1, fuera del bot) e indica su número de cédula y el número de celular nuevo.
2. Soporte verifica la identidad del usuario por cédula y actualiza `numero_whatsapp` en el registro existente de `usuarios`, reemplazando el número anterior.
3. El historial de gastos (`gastos.usuario_id`) no se ve afectado, ya que la relación es por `usuario_id`, no por número de celular — el cambio de número no requiere migrar ni tocar los gastos ya registrados.
4. El número anterior deja de estar vinculado a la cuenta; si alguien vuelve a escribir desde ese número, se trata como no registrado.

*Nota para v1: este reemplazo es un proceso manual (soporte edita el registro directamente). Automatizar la verificación de identidad por cédula desde la web queda fuera de alcance del MVP, pero el campo `cedula` se captura desde ahora precisamente para no tener que rediseñar el esquema cuando se automatice.*

### 6.2 Registro por texto

1. El usuario envía un mensaje, por ejemplo: "Gasté 20 mil en una hamburguesa".
2. WhatsApp entrega el evento al webhook.
3. El sistema identifica al usuario por `numero_whatsapp`. Si no existe, aplica §6.1 paso 4.
4. El sistema valida que el mensaje no haya sido procesado antes (`mensaje_origen_id` único).
5. El sistema valida que no haya un gasto `pendiente_confirmacion` activo para ese usuario. Si lo hay, pide resolverlo primero.
6. Un modelo de IA extrae y normaliza los campos del gasto.
7. El sistema valida los datos críticos: monto, moneda, fecha, categoría (contra el catálogo) y descripción.
8. Se crea un gasto con estado `pendiente_confirmacion`.
9. El bot responde con una propuesta, por ejemplo:

   > Registré: $20.000 COP · Alimentación · Hamburguesa · 11 jul.
   > Responde **sí** para confirmar o **no** para descartar.

10. Si el usuario responde "sí", el gasto pasa a `confirmado`. Si responde "no", pasa a `rechazado`. Cualquier otra respuesta se interpreta como aclaración y no cambia el estado.

### 6.3 Información incompleta o ambigua

Si falta el monto o no puede inferirse con suficiente confianza, el sistema crea el gasto en estado `incompleto` y pide solo el dato necesario, por ejemplo:

> ¿Cuál fue el valor del gasto?

La siguiente respuesta del usuario se interpreta en el contexto de ese gasto `incompleto` (no como un gasto nuevo), hasta que se complete o se descarte.

### 6.4 Registro por imagen

1. El usuario envía una foto de un recibo.
2. El archivo se guarda en almacenamiento privado.
3. Un modelo con visión extrae los campos disponibles.
4. El sistema presenta una propuesta y solicita confirmación igual que en el flujo de texto.
5. Si el recibo contiene varios artículos, inicialmente se registra el total del comprobante; el desglose queda fuera de alcance.

## 7. Arquitectura propuesta

```text
WhatsApp (hasta 1000 usuarios, un solo número de bot)
  ↓
Evolution API — self-hosted en VPS
  ↓ webhook
n8n — self-hosted (Docker)
  ↓
  ¿Usuario vinculado? → no → responder invitación a registro
  ↓ sí
  ¿Gasto pendiente activo? → sí → pedir resolución
  ↓ no
Modelo IA (Claude Haiku, texto o visión)
  ↓
Supabase Postgres (con RLS) + Supabase Storage privado
  ↓
Next.js + Vercel — dashboard autenticado (Supabase Auth, OTP)
```

| Componente | Responsabilidad | v1 — hasta 10 usuarios | Camino a 1000 usuarios |
| --- | --- | --- | --- |
| Evolution API | Recibir y responder mensajes de WhatsApp | Self-hosted en un VPS pequeño o capa gratuita (Railway/Fly.io free tier alcanza para este volumen) | Mismo software; se sube el tamaño del servidor si el volumen de mensajes lo exige |
| n8n | Orquestar webhooks, estado conversacional, IA y persistencia | n8n cloud, plan gratuito (el límite de ejecuciones/mes no se toca con 10 usuarios) | Migrar a self-hosted o plan pago solo cuando el volumen de ejecuciones se acerque al límite del free tier |
| Claude Haiku 4.5 | Extraer datos estructurados (texto y visión) y clasificar contra el catálogo de categorías | Igual desde el día uno | Sin cambios — el costo escala linealmente con uso, no requiere migración |
| Supabase Postgres | Guardar usuarios, gastos, categorías, trazabilidad | Plan free (suficiente en almacenamiento y filas para 10 usuarios) | Subir a plan Pro cuando se acerque a los límites de fila/egress/pausa por inactividad |
| Supabase Storage | Guardar soportes de imagen de forma privada | Plan free, URLs firmadas de corta duración | Mismo diseño; solo cambia el plan si el volumen de imágenes lo exige |
| Supabase Auth | Autenticación web por OTP al número registrado | Igual desde el día uno | Sin cambios |
| Next.js + Vercel | Dashboard de consulta | Plan Hobby | Plan Hobby sigue alcanzando salvo tráfico inusualmente alto |

> La conexión no oficial de WhatsApp (Evolution API) se trata como dependencia frágil desde el día uno: requiere monitoreo de sesión, capacidad de reconexión, y un plan de contingencia. El riesgo de que Meta marque el número como automatizado crece con el volumen de mensajes; si esto ocurre de forma recurrente al escalar, la mitigación es migrar a una API oficial (Twilio, 360dialog), con el costo por conversación que eso implica.

### 7.1 Qué se mantiene y qué se ajusta al escalar

**Se mantiene sin cambios (por diseño desde v1):**
- Esquema de base de datos (`usuarios`, `categorias`, `gastos`) y sus relaciones.
- Políticas de Row Level Security.
- Lógica de estado conversacional (un gasto pendiente a la vez, idempotencia por `mensaje_origen_id`).
- Flujos de n8n (el mismo workflow exportado corre igual en cloud free o self-hosted).
- Modelo de IA y forma de invocarlo.

**Se ajusta solo al acercarse a los límites de cada plan:**
- Plan de Supabase (free → Pro).
- Hosting de n8n (cloud free → self-hosted o cloud de pago).
- Tamaño del servidor de Evolution API.

Esto significa que "escalar" es una conversación de *planes y recursos de infraestructura*, no una de *rediseño de arquitectura o migración de datos*.

## 8. Modelo de datos

### Tabla `usuarios`

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | uuid | Identificador único |
| `numero_whatsapp` | text, unique | Número verificado, en formato E.164 — identificador **principal** (el que el bot usa para reconocer al usuario en cada mensaje) |
| `cedula` | text, unique | Número de cédula — identificador **secundario**, usado solo por soporte para verificar identidad y reemplazar `numero_whatsapp` en caso de pérdida o cambio |
| `nombre` | text, nullable | Nombre del usuario |
| `creado_en` | timestamptz | Fecha de registro |
| `numero_whatsapp_actualizado_en` | timestamptz, nullable | Última vez que se reemplazó el número (auditoría de soporte) |

### Tabla `categorias`

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | uuid | Identificador único |
| `nombre` | text, unique | Ej: `Alimentación`, `Transporte`, etc. |
| `activa` | boolean | Permite desactivar sin borrar histórico |

### Tabla `gastos`

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | uuid | Identificador único |
| `usuario_id` | uuid, FK → usuarios | Propietario del gasto |
| `fecha_gasto` | date | Fecha efectiva del gasto |
| `hora_gasto` | time, nullable | Hora si se conoce |
| `monto` | bigint, nullable | Monto entero en pesos colombianos (nulo si `incompleto`) |
| `moneda` | text | Predeterminado: `COP` |
| `categoria_id` | uuid, FK → categorias, nullable | Categoría asignada |
| `descripcion` | text | Descripción breve del gasto |
| `metodo_pago` | text, nullable | Efectivo, tarjeta, transferencia, etc. |
| `estado` | text | `pendiente_confirmacion`, `confirmado`, `rechazado`, `incompleto`, `error` |
| `origen` | text | `texto` o `imagen` |
| `soporte_path` | text, nullable | Ruta privada del recibo en Storage |
| `texto_original` | text | Mensaje original para auditoría y depuración |
| `mensaje_origen_id` | text, unique | Identificador único del mensaje de WhatsApp |
| `confianza_extraccion` | numeric, nullable | Confianza estimada de la interpretación |
| `creado_en` | timestamptz | Fecha de recepción y creación del registro |
| `confirmado_en` | timestamptz, nullable | Momento de confirmación |

### Seguridad (RLS)

Todas las tablas con datos de usuario tienen Row Level Security activado: un usuario autenticado solo puede leer/escribir filas donde `usuario_id` coincide con su propia identidad de sesión. El flujo de n8n usa una llave de servicio (`service_role`) que sí puede escribir para cualquier usuario, ya que actúa en nombre del sistema tras identificar el número de WhatsApp.

## 9. Criterios de aceptación

- "Gasté 20mil en una hamburguesa" propone un gasto por $20.000 COP en Alimentación.
- "Ayer pagué 45.000 de Uber" asigna la fecha de ayer en la zona horaria Bogotá.
- Un mensaje sin monto crea el gasto en estado `incompleto`, solicita el valor y no se incorpora a los totales.
- Un mismo `mensaje_origen_id` no puede crear más de un gasto.
- Un usuario con un gasto `pendiente_confirmacion` no puede iniciar otro hasta resolver el primero.
- Un número no registrado no puede crear gastos; recibe la invitación a registrarse.
- Soporte puede reemplazar el `numero_whatsapp` de una cuenta existente verificando la cédula, sin perder ni duplicar el historial de gastos asociado.
- Los gastos `pendiente_confirmacion`, `rechazado` e `incompleto` no aparecen en los totales principales.
- La web permite filtrar gastos confirmados por rango de fechas y categoría.
- Un usuario autenticado no puede leer ni modificar gastos de otro usuario (verificado con RLS).
- Los soportes de imagen no son públicos ni accesibles sin URL firmada vigente.

## 10. Fases de implementación

1. **Base de datos y seguridad:** tablas `usuarios`, `categorias`, `gastos`; políticas RLS; catálogo de categorías inicial.
2. **Onboarding web:** registro con número de WhatsApp y verificación OTP.
3. **Integración de WhatsApp:** recepción de webhook, identificación de usuario, respuesta básica.
4. **Procesamiento de texto:** extracción estructurada, normalización, validaciones contra el catálogo.
5. **Estado conversacional y confirmación:** manejo de gasto pendiente único, confirmación/rechazo, idempotencia.
6. **Dashboard web:** listado, filtros y totales de gastos confirmados.
7. **Procesamiento de imágenes:** carga privada, extracción con visión, confirmación.
8. **Pruebas y observabilidad:** casos ambiguos, errores, reintentos, métricas, mejora de prompts.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Mensaje ambiguo o incompleto | Pedir aclaración y no confirmar automáticamente |
| Interpretación incorrecta de IA | Validar estructura, restringir categorías al catálogo, pedir confirmación |
| Fotos borrosas o ilegibles | Marcar como incompleto y pedir una foto nueva o el monto manualmente |
| Webhooks repetidos | Índice único por `mensaje_origen_id` e idempotencia en el flujo |
| Sesión inestable de Evolution API | Monitorear conexión, documentar procedimiento de reconexión, plan de migración a API oficial |
| Exposición de facturas | Storage privado, autenticación, URLs firmadas temporales |
| Un usuario satura el bot con mensajes repetidos | Límite de mensajes procesados por minuto por número (rate limiting en n8n) |
| Fuga de datos entre usuarios | RLS obligatorio en todas las tablas con `usuario_id` |
| Costo de IA crece con la base de usuarios | Modelo económico (Haiku) por defecto; revisar métricas de costo por gasto registrado mensualmente |

## 12. Primer hito implementable

El primer hito termina cuando un usuario registrado puede enviar un gasto por texto, recibir una propuesta, confirmarla con "sí" y verla en el dashboard, respetando la regla de un solo gasto pendiente a la vez. Las fotos se abordan después de estabilizar ese camino.

---

## Apéndice técnico (para desarrollo asistido por agente)

Esta sección existe para que un agente de código pueda implementar sin tener que inferir decisiones no explícitas en el cuerpo del PRD.

### A. Variables de entorno esperadas

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=
ANTHROPIC_API_KEY=
N8N_WEBHOOK_BASE_URL=
TIMEZONE=America/Bogota
DEFAULT_CURRENCY=COP
```

### B. Contrato del webhook de entrada (Evolution API → n8n)

El payload que llega a n8n debe, como mínimo, incluir: `mensaje_origen_id` (id del mensaje en WhatsApp), `numero_whatsapp` (remitente), `tipo` (`texto` o `imagen`), `contenido` (texto del mensaje o URL/base64 de la imagen), y `timestamp` de recepción. El agente debe normalizar el payload real de Evolution API a esta forma antes de continuar el flujo.

### C. Estados válidos de `gastos`

`pendiente_confirmacion` → `confirmado` | `rechazado`
`incompleto` → `pendiente_confirmacion` | `rechazado`
`error` es terminal y requiere revisión manual (no se reintenta automáticamente sin acción explícita).

### D. Reglas de enrutamiento de respuestas del usuario

Cuando llega un mensaje de un usuario con un gasto `pendiente_confirmacion` o `incompleto` activo, el mensaje **siempre** se interpreta primero en el contexto de ese gasto (confirmación, rechazo o dato faltante) antes de considerarse un gasto nuevo. Solo si no hay gasto activo en esos estados, el mensaje se procesa como un gasto nuevo.

### E. Estructura de repositorio sugerida

```
/apps
  /web              → Next.js (dashboard)
/n8n
  /workflows        → exportes JSON de los flujos de n8n
/db
  /migrations       → migraciones SQL de Supabase (schema, RLS, seed de categorías)
/docs
  PRD.md            → este documento
```

### F. Seed inicial de categorías

El agente debe poblar `categorias` con los diez valores fijos listados en §5 como parte de la migración inicial, no dejarlo como paso manual.
