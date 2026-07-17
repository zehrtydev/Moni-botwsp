revoke execute on function public.crear_usuario_desde_auth()
  from public, anon, authenticated, service_role;

revoke execute on function public.es_admin()
  from public, anon, authenticated, service_role;
grant execute on function public.es_admin()
  to authenticated;
