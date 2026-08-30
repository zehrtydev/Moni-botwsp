# PRD — Registro de Gastos por WhatsApp

## 1. Resumen

Una aplicación personal que permite registrar gastos enviando mensajes de texto o fotos de recibos por WhatsApp. El sistema interpreta el contenido, propone un registro estructurado y lo confirma antes de incorporarlo al historial. Una aplicación web permite consultar los gastos y sus totales.

**Propuesta de valor:** registrar un gasto en menos de 10 segundos desde un canal habitual, sin perder control sobre la información guardada.

## 2. Problema

Registrar gastos en una hoja de cálculo o una aplicación requiere abrirla, buscar una categoría y llenar campos. Esa fricción hace que los registros se pospongan o se olviden. WhatsApp reduce el esfuerzo: basta enviar un texto como “gasté 20 mil en una hamburguesa” o una foto del recibo.

## 3. Objetivo del MVP

Permitir que un usuario registre y confirme gastos por WhatsApp, y consulte posteriormente sus gastos confirmados en una aplicación web.

### Métrica de éxito inicial

- Un gasto de texto completo queda confirmado en menos de un minuto.
- No se crean gastos duplicados ante reintentos del webhook.
- Los gastos confirmados se pueden consultar y filtrar desde la web.

## 4. Alcance

### Incluido en el MVP

- Registro de gastos por mensaje de texto en WhatsApp.
- Extracción de monto, descripción, categoría, fecha y moneda.
- Solicitud de aclaración cuando falte información crítica o exista baja confianza.
- Confirmación explícita antes de consolidar el gasto.
- Prevención de registros duplicados.
- Almacenamiento de gastos y consulta web con filtros por fecha y categoría.
- Totales para el período seleccionado.

### Incluido si no retrasa el MVP

- Registro por foto de factura o recibo.
- Almacenamiento privado del soporte y visualización desde la web.

### Fuera de alcance por ahora

- Presupuestos, alertas y metas de gasto.
- Exportación a PDF o Excel.
- Varios usuarios y cuentas compartidas.
- Edición compleja desde WhatsApp.
- Separación automática de varios artículos de un mismo recibo.

## 5. Reglas de producto

- La moneda predeterminada es **COP**.
- Los valores se almacenan como enteros en pesos colombianos; no se usan números de punto flotante.
- Si el mensaje no incluye una fecha, se utiliza la fecha local de recepción en la zona horaria `America/Bogota`.
- Las categorías son cerradas: `Alimentación`, `Transporte`, `Hogar`, `Salud`, `Ocio`, `Educación`, `Servicios`, `Compras`, `Deudas` y `Otros`.
- Un gasto no se considera definitivo hasta que esté en estado `confirmado`.
- Los soportes de recibos son privados y solo se entregan mediante acceso autenticado o URL temporal.

## 6. Flujo funcional

### 6.1 Registro por texto

1. El usuario envía un mensaje, por ejemplo: “Gasté 20 mil en una hamburguesa”.
2. WhatsApp entrega el evento al webhook.
3. El sistema valida que el mensaje no haya sido procesado antes.
4. Un modelo de IA extrae y normaliza los campos del gasto.
5. El sistema valida los datos críticos: monto, moneda, fecha, categoría y descripción.
6. Se crea un gasto con estado `pendiente_confirmacion`.
7. El bot responde con una propuesta, por ejemplo:

   > Registré: $20.000 COP · Alimentación · Hamburguesa · 11 jul.  
   > Responde **sí** para confirmar o **no** para descartar.

8. Si el usuario responde “sí”, el gasto pasa a `confirmado`. Si responde “no”, pasa a `rechazado`.

### 6.2 Información incompleta o ambigua

Si falta el monto o no puede inferirse con suficiente confianza, el sistema no crea un gasto confirmado. Debe pedir solo el dato necesario, por ejemplo:

> ¿Cuál fue el valor del gasto?

### 6.3 Registro por imagen

1. El usuario envía una foto de un recibo.
2. El archivo se guarda en almacenamiento privado.
3. Un modelo con visión extrae los campos disponibles.
4. El sistema presenta una propuesta y solicita confirmación igual que en el flujo de texto.
5. Si el recibo contiene varios artículos, inicialmente se registra el total del comprobante; el desglose queda fuera de alcance.

## 7. Arquitectura propuesta

```text
WhatsApp
  ↓
Evolution API (conexión no oficial)
  ↓ webhook
n8n (orquestación, validación e idempotencia)
  ↓
Modelo de IA (texto / visión)
  ↓
Supabase (Postgres + Storage privado)
  ↓
Aplicación web Next.js desplegada en Vercel
```

| Componente | Responsabilidad |
| --- | --- |
| Evolution API | Recibir y responder mensajes de WhatsApp. |
| n8n | Orquestar webhooks, flujos conversacionales, IA y persistencia. |
| Modelo de IA | Extraer datos estructurados y seleccionar una categoría permitida. |
| Supabase Postgres | Guardar gastos, usuarios, categorías y trazabilidad. |
| Supabase Storage | Guardar soportes de imagen de forma privada. |
| Next.js + Vercel | Dashboard autenticado de consulta. |

> La conexión no oficial de WhatsApp debe tratarse como una dependencia frágil: se requiere monitoreo de sesión, capacidad de reconexión y un plan alternativo si deja de funcionar.

## 8. Modelo de datos

### Tabla `gastos`

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | uuid | Identificador único. |
| `usuario_id` | uuid | Propietario del gasto; se incluye desde el inicio aunque el MVP sea personal. |
| `fecha_gasto` | date | Fecha efectiva del gasto. |
| `hora_gasto` | time, nullable | Hora si se conoce. |
| `monto` | bigint | Monto entero en pesos colombianos. |
| `moneda` | text | Predeterminado: `COP`. |
| `categoria` | text o FK | Una categoría permitida. |
| `descripcion` | text | Descripción breve del gasto. |
| `metodo_pago` | text, nullable | Efectivo, tarjeta, transferencia, etc. |
| `estado` | text | `pendiente_confirmacion`, `confirmado`, `rechazado`, `incompleto` o `error`. |
| `origen` | text | `texto` o `imagen`. |
| `soporte_path` | text, nullable | Ruta privada del recibo; no una URL pública permanente. |
| `texto_original` | text | Mensaje original para auditoría y depuración. |
| `mensaje_origen_id` | text, unique | Identificador único del mensaje de WhatsApp. |
| `confianza_extraccion` | numeric, nullable | Confianza estimada de la interpretación. |
| `creado_en` | timestamptz | Fecha de recepción y creación del registro. |
| `confirmado_en` | timestamptz, nullable | Momento de confirmación. |

## 9. Criterios de aceptación

- “Gasté 20mil en una hamburguesa” propone un gasto por `$20.000 COP` en `Alimentación`.
- “Ayer pagué 45.000 de Uber” asigna la fecha de ayer en la zona horaria Bogotá.
- Un mensaje sin monto solicita el valor y no se incorpora a los totales.
- Un mismo `mensaje_origen_id` no puede crear más de un gasto.
- Los gastos pendientes o rechazados no aparecen en los totales principales.
- La web permite filtrar gastos confirmados por rango de fechas y categoría.
- Los soportes de imagen no son públicos.

## 10. Fases de implementación

1. **Base de datos y seguridad:** tablas, categorías, autenticación y políticas de acceso.
2. **Integración de WhatsApp:** recepción de webhook y respuesta básica.
3. **Procesamiento de texto:** extracción estructurada, normalización y validaciones.
4. **Confirmación e idempotencia:** estados conversacionales y prevención de duplicados.
5. **Dashboard web:** listado, filtros y totales de gastos confirmados.
6. **Procesamiento de imágenes:** carga privada, extracción con visión y confirmación.
7. **Pruebas y observabilidad:** casos ambiguos, errores, reintentos, métricas y mejora de prompts.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Mensaje ambiguo o incompleto | Pedir aclaración y no confirmar automáticamente. |
| Interpretación incorrecta de IA | Validar estructura, restringir categorías y pedir confirmación. |
| Fotos borrosas o ilegibles | Marcar como incompleto y pedir una foto nueva o el monto manualmente. |
| Webhooks repetidos | Índice único por mensaje de origen e idempotencia en el flujo. |
| Sesión inestable de Evolution API | Monitorear conexión y documentar procedimiento de reconexión. |
| Exposición de facturas | Storage privado, autenticación y URLs firmadas temporales. |

## 12. Primer hito implementable

El primer hito termina cuando un usuario puede enviar un gasto por texto, recibir una propuesta, confirmarla con “sí” y verla en el dashboard. Las fotos se abordan después de estabilizar ese camino.
