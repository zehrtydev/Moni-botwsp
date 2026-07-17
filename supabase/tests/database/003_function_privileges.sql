begin;

select plan(7);

select ok(
  not has_function_privilege(
    'anon',
    'public.crear_usuario_desde_auth()',
    'EXECUTE'
  ),
  'anon no puede ejecutar directamente la funcion trigger de Auth'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.crear_usuario_desde_auth()',
    'EXECUTE'
  ),
  'authenticated no puede ejecutar directamente la funcion trigger de Auth'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.crear_usuario_desde_auth()',
    'EXECUTE'
  ),
  'service_role tampoco necesita ejecutar directamente la funcion trigger'
);

select ok(
  not has_function_privilege('anon', 'public.es_admin()', 'EXECUTE'),
  'anon no puede consultar el helper administrativo'
);

select ok(
  not has_function_privilege('service_role', 'public.es_admin()', 'EXECUTE'),
  'service_role no necesita el helper porque evita RLS'
);

select ok(
  has_function_privilege('authenticated', 'public.es_admin()', 'EXECUTE'),
  'authenticated conserva el helper requerido por la politica RLS'
);

insert into auth.users (
  id,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000021',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb
);

select results_eq(
  $$select id
    from public.usuarios
    where id = '00000000-0000-0000-0000-000000000021'::uuid$$,
  $$values ('00000000-0000-0000-0000-000000000021'::uuid)$$,
  'El trigger sigue creando el perfil sin permisos de ejecucion directa'
);

select * from finish();
rollback;
