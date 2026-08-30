-- Permite consultar el historial propio completo.
-- El dashboard principal sigue filtrando estado = confirmado en la aplicación.
drop policy if exists gastos_lectura_confirmados_propietario on public.gastos;

create policy gastos_lectura_propietario
  on public.gastos
  for select to authenticated
  using ((select auth.uid()) = usuario_id);
