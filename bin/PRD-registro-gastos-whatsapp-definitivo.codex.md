# PRD definitivo — Registro de Gastos por WhatsApp

**Estado:** listo para implementación  
**Versión:** 1.0  
**Fecha:** 2026-07-11

## 1. Capacidad

Una persona con una cuenta verificada vincula su número de WhatsApp, registra gastos mediante texto o una foto de recibo, confirma cada propuesta y consulta exclusivamente sus propios gastos confirmados desde una aplicación web.

La promesa de producto es: **registrar un gasto en menos de 10 segundos por WhatsApp, sin que una interpretación automática incorrecta modifique silenciosamente el historial financiero**.

## 2. Objetivo y métrica de éxito

El MVP permite registrar y confirmar gastos por WhatsApp, y consultar el historial y totales desde la web.

Métricas iniciales:

- Un mensaje de texto completo recibe una propuesta en menos de 15 segundos y puede quedar confirmado en menos de un minuto.
- Ningún reintento del proveedor crea más de un gasto.
- Ningún usuario puede leer o modificar datos de otro usuario.
- Al menos el 95% de mensajes de texto completos terminan en una propuesta válida sin intervención manual.

## 3. Alcance

### Incluido en MVP

- Registro web con número telefónico en formato E.164 y verificación OTP por WhatsApp.
- Vinculación de una cuenta autenticada con un único número de WhatsApp.
- Registro de gastos por texto.
- Extracción de monto, fecha, descripción, moneda y categoría desde el mensaje.
- Confirmación, rechazo o corrección de una propuesta por WhatsApp.
- Manejo de información incompleta y un único gasto activo por usuario.
- Prevención de duplicados y procesamiento seguro de reintentos.
- Dashboard web autenticado con listado, filtros por fecha/categoría y totales.
- Registro por foto de recibo, guardada de forma privada, si el flujo de texto ya está estable.

### Fuera de alcance

- Presupuestos, alertas, metas y exportaciones.
- Cuentas compartidas o gastos repartidos.
- Categorías personalizadas por usuario.
- Desglose de varios artículos de un recibo.
- Edición histórica compleja desde WhatsApp.
- Recuperación automatizada cuando el usuario pierde el número. En v1 se resuelve manualmente por soporte autenticado.

## 4. Políticas fijas de producto

- Moneda predeterminada: `COP`.
- Los montos se guardan como enteros en pesos colombianos; no se usan decimales flotantes.
- Si no se indica fecha, se asigna la fecha de recepción en `America/Bogota`.
- Categorías globales y cerradas: `Alimentación`, `Transporte`, `Hogar`, `Salud`, `Ocio`, `Educación`, `Servicios`, `Compras`, `Deudas` y `Otros`.
- Los gastos en `incompleto`, `pendiente_confirmacion`, `rechazado` o `error` no se incluyen en los totales.
- Un usuario solo puede tener **un gasto activo**: estado `incompleto` o `pendiente_confirmacion`.
- La confirmación es obligatoria; la IA nunca puede crear por sí sola un gasto `confirmado`.
- No se almacenan números de cédula ni otros identificadores nacionales en el MVP.
- La cuenta se identifica internamente por `auth.users.id`; el número de WhatsApp es un atributo verificable y único, no la clave de propiedad de los datos.

## 5. Actores y superficies

| Actor | Superficie | Acción |
| --- | --- | --- |
| Usuario | Web | Se registra, autentica y consulta sus gastos. |
| Usuario | WhatsApp | Envía gastos, responde confirmaciones y corrige datos. |
| Sistema | Webhook/n8n | Valida eventos, administra el estado y persiste datos. |
| Soporte | Consola administrativa restringida | Atiende cambios de número y errores terminales. |

## 6. Autenticación y vinculación

1. El usuario abre la web, ingresa su número en formato E.164 y solicita un OTP.
2. Supabase Auth envía el OTP por WhatsApp mediante **Twilio Verify/Twilio con canal WhatsApp**. Este proveedor, remitente, costo y límites se configuran antes del lanzamiento.
3. El usuario verifica el OTP. Supabase crea o autentica `auth.users`.
4. Un trigger seguro crea la fila `usuarios` usando el mismo UUID de `auth.users.id`.
5. La web muestra un enlace `wa.me` hacia el bot; el primer mensaje entrante confirma que el número vinculado puede interactuar con el bot.
6. Un mensaje de un número no vinculado recibe únicamente el enlace de registro; no se extrae ni guarda un gasto.

### Cambio de número

El usuario inicia sesión en la web con su sesión vigente y solicita cambio de número. Soporte valida la solicitud con el canal definido por operación y exige OTP para el nuevo número antes de actualizarlo. El sistema conserva el mismo `usuarios.id`; por lo tanto, el historial no se migra ni se duplica. Toda modificación queda en una bitácora de auditoría.

## 7. Estados y flujo conversacional

### Estados válidos

```text
incompleto ──datos válidos──> pendiente_confirmacion ──sí──> confirmado
     │                                │
     └──────────────no/cancelar───────┴──────────────────> rechazado

error es terminal y requiere revisión de soporte.
```

`confirmado`, `rechazado` y `error` son terminales. No se puede volver desde un estado terminal a uno activo.

### Registro por texto

1. Llega un evento de mensaje entrante autenticado y normalizado.
2. Se verifica firma, se descartan eventos propios/de estado y se comprueba idempotencia por `mensaje_origen_id`.
3. Se identifica al usuario por su número normalizado. Si no está vinculado, se responde con el enlace de registro.
4. Si existe un gasto activo, la respuesta se enruta primero a ese gasto; no se inicia otro.
5. Si no existe gasto activo, el modelo devuelve una propuesta estructurada y validada.
6. Si faltan monto, fecha interpretable, categoría o descripción, se crea `incompleto` y se pregunta únicamente por el dato faltante.
7. Si los datos son válidos, se crea `pendiente_confirmacion` y se presenta el resumen.

Ejemplo de propuesta:

> Registré: $20.000 COP · Alimentación · Hamburguesa · 11 jul.  
> Responde **sí**, **no** o **corregir [dato]**.

### Respuestas a un gasto activo

| Entrada normalizada | Resultado |
| --- | --- |
| `sí`, `si`, `confirmar` | Cambia `pendiente_confirmacion` a `confirmado`. |
| `no`, `cancelar`, `descartar` | Cambia el gasto activo a `rechazado`. |
| `corregir 25000`, `corregir categoría Transporte`, etc. | Valida el cambio, actualiza la propuesta y solicita nueva confirmación. |
| Dato solicitado para un gasto `incompleto` | Actualiza el campo; si ya está completo, pasa a `pendiente_confirmacion`. |
| Cualquier otro texto | Explica los comandos válidos sin cambiar el estado. |

### Fotos de recibo

La foto se valida, descarga y guarda de manera privada antes de invocar el modelo de visión. El resultado sigue exactamente el mismo ciclo de `incompleto` o `pendiente_confirmacion`. Si hay varios artículos, se registra solo el total del comprobante.

## 8. Contrato de IA

El modelo recibe el mensaje original, la fecha/hora local, la moneda por defecto y el catálogo permitido. Debe responder exclusivamente JSON conforme a este contrato:

```json
{
  "monto": 20000,
  "moneda": "COP",
  "fecha_gasto": "2026-07-11",
  "categoria": "Alimentación",
  "descripcion": "hamburguesa",
  "metodo_pago": null,
  "campos_faltantes": [],
  "confianza": 0.98
}
```

El orquestador valida el JSON mediante esquema estricto antes de persistirlo: monto entero positivo, moneda permitida, fecha válida, categoría existente y longitudes máximas. Una salida inválida o un error del proveedor no se muestra con detalles al usuario: se registra de forma segura y el gasto pasa a `error` o se solicita reintento, según corresponda.

## 9. Arquitectura

```text
Usuario ──WhatsApp──> Evolution API (VPS)
                              │ webhook firmado
                              v
                  n8n / servicio de orquestación
                    │ validación, cola, estado, IA
                    v
     Supabase Auth + Postgres (RLS) + Storage privado
                    ^
                    │ sesión autenticada
          Next.js en Vercel (dashboard)
```

La conexión de Evolution API es una dependencia frágil. Se monitorea su sesión y se documenta un procedimiento de reconexión. Si el volumen o bloqueos recurrentes lo exigen, la alternativa es migrar la capa de mensajería a una API oficial sin modificar el contrato interno de mensajes.

No se promete que 1.000 usuarios requieran solo un cambio de plan: el modelo de datos y contratos se diseñan para evitar una migración estructural, pero se revisarán capacidad, colas, límites de proveedor y observabilidad antes de crecer.

## 10. Datos y restricciones

### `usuarios`

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `id` | uuid | PK y FK a `auth.users(id)`. |
| `numero_whatsapp` | text | Único, E.164, verificado. |
| `nombre` | text nullable | Máximo 100 caracteres. |
| `creado_en` | timestamptz | No nulo. |
| `numero_whatsapp_actualizado_en` | timestamptz nullable | Auditoría. |

### `categorias`

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `id` | uuid | PK. |
| `nombre` | text | Único. |
| `activa` | boolean | No nulo, predeterminado `true`. |

### `gastos`

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `id` | uuid | PK. |
| `usuario_id` | uuid | FK a `usuarios(id)`, no nulo. |
| `fecha_gasto` | date | No nulo. |
| `hora_gasto` | time nullable | Opcional. |
| `monto` | bigint nullable | Entero positivo; nulo solo en `incompleto`. |
| `moneda` | text | `COP` en MVP. |
| `categoria_id` | uuid nullable | FK a `categorias`. |
| `descripcion` | text | No nulo, máximo 500 caracteres. |
| `metodo_pago` | text nullable | Lista permitida si se informa. |
| `estado` | text | Enum o `CHECK` con los cinco estados válidos. |
| `origen` | text | `texto` o `imagen`. |
| `soporte_path` | text nullable | Ruta privada, nunca URL pública. |
| `texto_original` | text | Máximo 4.000 caracteres. |
| `mensaje_origen_id` | text | Único, no nulo. |
| `confianza_extraccion` | numeric nullable | Entre 0 y 1. |
| `creado_en` | timestamptz | No nulo. |
| `confirmado_en` | timestamptz nullable | Obligatorio solo si está confirmado. |
| `codigo_error` | text nullable | Sin información sensible. |

Restricciones obligatorias:

- Índice único sobre `mensaje_origen_id`.
- Índice único parcial sobre `usuario_id` cuando `estado IN ('incompleto', 'pendiente_confirmacion')`.
- Transiciones de estado implementadas mediante función/transacción de servidor; el cliente web no puede confirmar ni cambiar gastos directamente.

## 11. Seguridad, privacidad y operación

- RLS activado en todas las tablas expuestas. Las políticas usan `auth.uid() = usuarios.id` y `auth.uid() = gastos.usuario_id`.
- El rol `service_role` se limita al backend/orquestador; jamás se expone al navegador, a n8n exportado ni al repositorio.
- Secretos únicamente en variables de entorno; `.env*` queda fuera de Git.
- Webhooks: validar firma o secreto compartido, limitar tamaño de payload y aplicar rate limit por IP y por número.
- Archivos: aceptar únicamente JPEG, PNG y WebP, máximo 5 MB; verificar MIME y contenido, generar nombre no predecible y guardar en bucket privado.
- URLs de soporte: firmadas, de corta vida y creadas solo para el usuario propietario.
- Logs: nunca incluyen OTP, claves, URLs firmadas completas, imágenes, contenido íntegro de recibos ni números telefónicos sin enmascarar.
- Mensajes y errores de cara al usuario son genéricos; el detalle técnico se conserva solo en observabilidad protegida.
- La cuenta puede solicitar borrado desde la web. El proceso elimina o anonimiza perfil, gastos y soportes según la política de retención definida antes del lanzamiento.
- Dashboard: cookies de sesión seguras, HTTPS, cabeceras de seguridad, protección CSRF en mutaciones y validación de toda entrada con esquema.

## 12. Contrato de webhook

El adaptador de Evolution API normaliza cualquier payload al contrato interno siguiente:

```json
{
  "mensaje_origen_id": "string-unico",
  "numero_whatsapp": "+573001234567",
  "tipo": "texto",
  "contenido": "Gasté 20 mil en una hamburguesa",
  "media": null,
  "timestamp": "2026-07-11T14:00:00Z"
}
```

Reglas:

- Solo se aceptan mensajes entrantes de usuario; se ignoran eventos de entrega, lectura, presencia y mensajes del propio bot.
- Todo evento se autentica antes de deserializar contenido no confiable.
- Los reintentos devuelven éxito sin duplicar una operación ya registrada.
- La descarga de media ocurre con timeout, límite de tamaño y máximo de reintentos; un fallo genera `error` recuperable por soporte.

## 13. Observabilidad y recuperación

Registrar métricas de: mensajes recibidos, duplicados descartados, latencia del flujo, fallos de IA, gastos confirmados/rechazados/incompletos, costo estimado de IA y estado de sesión de Evolution API.

Alertas mínimas: webhook sin tráfico esperado, tasa elevada de errores, sesión desconectada, cola acumulada y fallos de autenticación.

Los errores terminales se revisan en una consola interna protegida. No hay reintentos automáticos indefinidos.

## 14. Criterios de aceptación

- Un usuario autenticado no puede leer ni modificar datos de otro usuario, incluso alterando una solicitud manualmente.
- “Gasté 20mil en una hamburguesa” genera una propuesta de `$20.000 COP`, `Alimentación`, fecha local actual.
- “Ayer pagué 45.000 de Uber” usa la fecha local de ayer y categoría `Transporte`.
- Un mensaje sin monto crea un único gasto `incompleto`, solicita el monto y no afecta totales.
- Dos eventos con el mismo `mensaje_origen_id` crean solo una fila de gasto.
- Dos mensajes simultáneos de un mismo usuario no generan más de un gasto activo.
- “corregir 25000” actualiza una propuesta pendiente y exige una nueva confirmación.
- “no” o “cancelar” rechaza el gasto activo; no borra el registro de auditoría.
- Un número no vinculado recibe el enlace de registro y no genera gasto.
- Las imágenes no son accesibles con una URL pública permanente.
- Un webhook con firma inválida, payload excedido o tipo no permitido es rechazado sin llamar al modelo de IA.

## 15. Plan de ejecución para agentes

1. **Fundación de datos:** migraciones SQL, catálogo seed, trigger `auth.users → usuarios`, restricciones, RLS y pruebas de aislamiento.
2. **Autenticación web:** OTP, sesión, registro, vinculación del número y dashboard vacío protegido.
3. **Adaptador WhatsApp:** VPS/Evolution, validación de webhook, normalización de eventos, idempotencia y respuesta básica.
4. **Flujo de texto:** contrato IA, validación de esquema, creación transaccional y estados conversacionales.
5. **Dashboard:** historial confirmado, filtros y totales calculados correctamente.
6. **Correcciones y soporte:** comandos de corrección, auditoría y cambio seguro de número.
7. **Imágenes:** validación, storage privado, visión y URLs firmadas.
8. **Endurecimiento:** rate limits, alertas, pruebas de concurrencia, pruebas de autorización y checklist de despliegue.

## 16. Definición del primer hito

El primer hito está terminado cuando un usuario puede autenticarse, vincular su número, enviar un gasto por texto, recibir una propuesta, corregirla o confirmarla y verla exclusivamente en su dashboard; todo ello sin duplicados y con RLS verificado mediante pruebas automatizadas.
