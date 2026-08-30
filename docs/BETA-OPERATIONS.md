# Operación de la beta

Este documento define la revisión mínima semanal de Moni mientras validamos el producto con pocos usuarios.

## Señal automática

Configura un monitor HTTPS contra `GET /api/health`. Debe responder `200` con `status: "ok"`. Si responde `503`, revisar primero las variables de entorno y luego la conectividad con Supabase. La ruta no reemplaza la revisión de errores del webhook: solo confirma disponibilidad básica de la aplicación y la base de datos.

## Indicadores principales

Revisar por los últimos 7 días:

- Mensajes recibidos y procesados correctamente.
- Mensajes en estado `error`.
- Porcentaje de mensajes con error sobre el total.
- Gastos confirmados, rechazados y pendientes.
- Usuarios que registraron al menos un movimiento.
- Mensajes que terminaron sin crear un gasto porque no se entendieron.

La métrica más importante no es el número bruto de mensajes: es que los usuarios puedan registrar y confirmar sus movimientos sin repetir el mensaje ni corregir datos manualmente.

## Consultas para Supabase

```sql
-- Estado del procesamiento de mensajes durante los últimos 7 días
select
  estado_procesamiento,
  count(*) as total
from public.mensajes_entrantes
where creado_en >= now() - interval '7 days'
group by estado_procesamiento
order by total desc;
```

```sql
-- Errores agrupados por código operativo
select
  coalesce(codigo_error, 'SIN_CODIGO') as codigo_error,
  count(*) as total,
  max(creado_en) as ultimo_evento
from public.mensajes_entrantes
where estado_procesamiento = 'error'
  and creado_en >= now() - interval '7 days'
group by codigo_error
order by total desc, ultimo_evento desc;
```

```sql
-- Movimientos por estado durante los últimos 7 días
select
  estado,
  count(*) as total
from public.gastos
where creado_en >= now() - interval '7 days'
group by estado
order by total desc;
```

```sql
-- Usuarios activos y cantidad de movimientos confirmados
select
  u.id,
  coalesce(u.nombre, 'Sin nombre') as usuario,
  count(g.id) as gastos_confirmados
from public.usuarios u
left join public.gastos g
  on g.usuario_id = u.id
 and g.estado = 'confirmado'
 and g.creado_en >= now() - interval '7 days'
group by u.id, u.nombre
order by gastos_confirmados desc;
```

## Acción ante errores

1. Consultar el código `PROCESSING_FAILED` y la hora del mensaje.
2. Revisar los logs del servicio web en esa misma ventana de tiempo.
3. Confirmar si el mensaje fue un reintento duplicado o un fallo real.
4. No editar manualmente un gasto confirmado sin registrar qué dato se corrigió.
5. Si el error se repite, convertir el ejemplo real del usuario en una prueba automatizada antes de cambiar el parser.

## Revisión con usuarios

Una vez por semana preguntar a cada usuario:

- ¿Qué mensaje intentaste enviar y Moni no entendió?
- ¿Tuviste que repetir o corregir algún gasto?
- ¿Confías en el saldo y los resúmenes?
- ¿Qué información esperabas recibir y no apareció?

Las respuestas deben guiar la siguiente funcionalidad. No agregar nuevas áreas del producto hasta resolver los fallos repetidos del flujo principal.
