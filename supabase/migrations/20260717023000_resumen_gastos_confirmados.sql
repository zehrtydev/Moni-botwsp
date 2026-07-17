create or replace function public.resumen_gastos_confirmados(
  p_desde date default null,
  p_hasta date default null,
  p_categoria_id uuid default null
)
returns table (
  cantidad bigint,
  monto_total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::bigint as cantidad,
    coalesce(sum(g.monto), 0)::bigint as monto_total
  from public.gastos as g
  where g.usuario_id = (select auth.uid())
    and g.estado = 'confirmado'::public.estado_gasto
    and (p_desde is null or g.fecha_gasto >= p_desde)
    and (p_hasta is null or g.fecha_gasto <= p_hasta)
    and (p_categoria_id is null or g.categoria_id = p_categoria_id);
$$;

revoke all on function public.resumen_gastos_confirmados(date, date, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.resumen_gastos_confirmados(date, date, uuid)
  to authenticated;
