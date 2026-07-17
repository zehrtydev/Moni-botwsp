begin;

select plan(9);

select has_function(
  'public',
  'resumen_gastos_confirmados',
  array['date', 'date', 'uuid'],
  'El dashboard resume gastos confirmados mediante una RPC'
);

select ok(
  exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'resumen_gastos_confirmados'
      and not p.prosecdef
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
  ),
  'La RPC usa SECURITY INVOKER y un search_path vacio'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.resumen_gastos_confirmados(date,date,uuid)',
    'EXECUTE'
  ),
  'authenticated puede consultar su resumen'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.resumen_gastos_confirmados(date,date,uuid)',
    'EXECUTE'
  ),
  'anon no puede ejecutar el resumen'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.resumen_gastos_confirmados(date,date,uuid)',
    'EXECUTE'
  ),
  'service_role no necesita la RPC destinada al usuario'
);

insert into auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
values
  (
    '00000000-0000-0000-0000-000000000031',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000032',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.gastos (
  usuario_id,
  fecha_gasto,
  monto,
  categoria_id,
  descripcion,
  estado,
  origen,
  texto_original,
  mensaje_origen_id,
  confirmado_en
)
values
  (
    '00000000-0000-0000-0000-000000000031',
    '2026-07-01',
    10000,
    (select id from public.categorias order by nombre limit 1),
    'primer confirmado',
    'confirmado',
    'texto',
    'primer confirmado',
    'resumen-usuario-31-a',
    statement_timestamp()
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '2026-07-15',
    20000,
    (select id from public.categorias order by nombre offset 1 limit 1),
    'segundo confirmado',
    'confirmado',
    'texto',
    'segundo confirmado',
    'resumen-usuario-31-b',
    statement_timestamp()
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '2026-07-20',
    50000,
    (select id from public.categorias order by nombre limit 1),
    'rechazado',
    'rechazado',
    'texto',
    'rechazado',
    'resumen-usuario-31-rechazado',
    null
  ),
  (
    '00000000-0000-0000-0000-000000000032',
    '2026-07-10',
    90000,
    (select id from public.categorias order by nombre limit 1),
    'otro usuario',
    'confirmado',
    'texto',
    'otro usuario',
    'resumen-usuario-32-a',
    statement_timestamp()
  );

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000031',
  true
);
set local role authenticated;

select results_eq(
  $$select cantidad, monto_total
    from public.resumen_gastos_confirmados()$$,
  $$values (2::bigint, 30000::bigint)$$,
  'El resumen excluye rechazados y gastos de otros usuarios'
);

select results_eq(
  $$select cantidad, monto_total
    from public.resumen_gastos_confirmados('2026-07-10', '2026-07-31', null)$$,
  $$values (1::bigint, 20000::bigint)$$,
  'El resumen aplica el rango de fechas inclusivo'
);

select results_eq(
  $$select cantidad, monto_total
    from public.resumen_gastos_confirmados(
      null,
      null,
      (select id from public.categorias order by nombre limit 1)
    )$$,
  $$values (1::bigint, 10000::bigint)$$,
  'El resumen filtra por una categoria activa'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000032',
  true
);
set local role authenticated;

select results_eq(
  $$select cantidad, monto_total
    from public.resumen_gastos_confirmados()$$,
  $$values (1::bigint, 90000::bigint)$$,
  'auth.uid() aisla el resumen del segundo usuario'
);

select * from finish();
rollback;
