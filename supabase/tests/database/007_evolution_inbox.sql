begin;

select plan(9);

select has_function(
  'public',
  'registrar_mensaje_entrante',
  array['text', 'text', 'text', 'text', 'text', 'timestamptz'],
  'El registro del inbox entrante es una RPC'
);

select ok(
  (
    select p.prosecdef
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'registrar_mensaje_entrante'
  ),
  'La RPC del inbox usa SECURITY DEFINER y search_path vacio'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.registrar_mensaje_entrante(text,text,text,text,text,timestamptz)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.registrar_mensaje_entrante(text,text,text,text,text,timestamptz)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.registrar_mensaje_entrante(text,text,text,text,text,timestamptz)',
      'EXECUTE'
    ),
  'Solo service_role registra mensajes del relay'
);

select ok(
  exists (
    select 1
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'mensajes_entrantes'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  'El inbox mantiene RLS forzada'
);

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution',
    'moni',
    'evo-test-1',
    '+573001234567',
    'texto',
    '2026-07-16T12:00:00Z'::timestamptz
  ),
  'insertado',
  'El primer mensaje se registra'
);

select is(
  public.registrar_mensaje_entrante(
    'evolution',
    'moni',
    'evo-test-1',
    '+573001234567',
    'texto',
    '2026-07-16T12:00:00Z'::timestamptz
  ),
  'duplicado',
  'El mismo mensaje se deduplica'
);

select throws_ok(
  $$select public.registrar_mensaje_entrante(
      'otro', 'moni', 'evo-invalid', '+573001234567', 'texto', now()
    )$$,
  '22023',
  'Proveedor no soportado',
  'El relay no puede inventar otro proveedor'
);

select throws_ok(
  $$select public.registrar_mensaje_entrante(
      'evolution', 'moni', 'evo-invalid-phone', '3001234567', 'texto', now()
    )$$,
  '22023',
  'Numero E.164 invalido',
  'El inbox exige E.164'
);

reset role;

select results_eq(
  $$select proveedor, instancia, mensaje_origen_id, numero_whatsapp, tipo
    from public.mensajes_entrantes
    where mensaje_origen_id = 'evo-test-1'$$,
  $$values ('evolution', 'moni', 'evo-test-1', '+573001234567', 'texto')$$,
  'El inbox conserva solo metadatos normalizados'
);

select * from finish();
rollback;
