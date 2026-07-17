begin;

select plan(18);

select has_function(
  'public',
  'vincular_numero_autenticado',
  'La vinculacion usa una RPC autenticada sin datos elegidos por el cliente'
);

select ok(
  exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'vincular_numero_autenticado'
      and p.pronargs = 0
      and p.prosecdef
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
  ),
  'La RPC privilegiada fija un search_path vacio'
);

select ok(
  exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'vincular_numero_autenticado'
      and p.pronargs = 0
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated puede ejecutar la RPC'
);

select ok(
  not exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'vincular_numero_autenticado'
      and p.pronargs = 0
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon no puede ejecutar la RPC'
);

select ok(
  not exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'vincular_numero_autenticado'
      and p.pronargs = 0
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'service_role no usa la RPC destinada al usuario'
);

insert into auth.users (
  id,
  aud,
  role,
  phone,
  phone_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000011',
    'authenticated',
    'authenticated',
    '+573001234511',
    statement_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    'authenticated',
    'authenticated',
    '+573001234512',
    statement_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    'authenticated',
    'authenticated',
    '+573001234513',
    null,
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000014',
    'authenticated',
    'authenticated',
    '3001234514',
    statement_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  );

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;

select throws_ok(
  $$select public.vincular_numero_autenticado()$$,
  '28000',
  'Se requiere una sesion autenticada',
  'La RPC exige auth.uid()'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000013',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.vincular_numero_autenticado()$$,
  '28000',
  'El numero de la sesion no esta verificado',
  'No vincula un telefono sin phone_confirmed_at'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000014',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.vincular_numero_autenticado()$$,
  '22023',
  'El numero verificado debe estar en formato E.164',
  'Valida E.164 tambien en el limite de la RPC'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000011',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.vincular_numero_autenticado()$$,
  'Vincula el telefono verificado del usuario autenticado'
);

reset role;

select results_eq(
  $$select numero_whatsapp
    from public.usuarios
    where id = '00000000-0000-0000-0000-000000000011'::uuid$$,
  $$values ('+573001234511'::text)$$,
  'La vinculacion persiste en el perfil propietario'
);

select is(
  (
    select numero_whatsapp_actualizado_en
    from public.usuarios
    where id = '00000000-0000-0000-0000-000000000011'::uuid
  ),
  null::timestamptz,
  'La vinculacion inicial no se registra como reemplazo'
);

set local role authenticated;

select lives_ok(
  $$select public.vincular_numero_autenticado()$$,
  'Repetir la misma vinculacion es idempotente'
);

reset role;

select results_eq(
  $$select
      count(*)::integer,
      (
        select count(*)::integer
        from public.auditoria_cambios_numero
        where usuario_id = '00000000-0000-0000-0000-000000000011'::uuid
      )
    from public.usuarios
    where id = '00000000-0000-0000-0000-000000000011'::uuid
      and numero_whatsapp = '+573001234511'$$,
  $$values (1, 0)$$,
  'La repeticion no duplica perfiles ni crea auditoria'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000012',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.vincular_numero_autenticado()$$,
  'Un segundo usuario vincula unicamente su propio telefono'
);

reset role;

select results_eq(
  $$select id, numero_whatsapp
    from public.usuarios
    where id in (
      '00000000-0000-0000-0000-000000000011'::uuid,
      '00000000-0000-0000-0000-000000000012'::uuid
    )
    order by id$$,
  $$values
    (
      '00000000-0000-0000-0000-000000000011'::uuid,
      '+573001234511'::text
    ),
    (
      '00000000-0000-0000-0000-000000000012'::uuid,
      '+573001234512'::text
    )$$,
  'auth.uid() mantiene la propiedad de cada vinculacion'
);

update auth.users
set phone = '+573001234599',
    phone_confirmed_at = statement_timestamp()
where id = '00000000-0000-0000-0000-000000000011'::uuid;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000011',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.vincular_numero_autenticado()$$,
  '42501',
  'El cambio de numero requiere el flujo auditado',
  'La RPC inicial no permite reemplazar un numero ya vinculado'
);

reset role;

select results_eq(
  $$select numero_whatsapp
    from public.usuarios
    where id = '00000000-0000-0000-0000-000000000011'::uuid$$,
  $$values ('+573001234511'::text)$$,
  'El intento no auditado conserva el numero anterior'
);

select results_eq(
  $$select count(*)::integer
    from public.auditoria_cambios_numero
    where usuario_id = '00000000-0000-0000-0000-000000000011'::uuid$$,
  $$values (0)$$,
  'La RPC inicial tampoco fabrica una auditoria de reemplazo'
);

select * from finish();
rollback;
