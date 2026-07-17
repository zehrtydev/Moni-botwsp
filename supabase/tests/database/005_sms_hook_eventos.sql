begin;

select plan(14);

select has_table(
  'public',
  'sms_hook_eventos',
  'La deduplicacion persistente del Send SMS Hook existe'
);

select columns_are(
  'public',
  'sms_hook_eventos',
  array[
    'evento_huella',
    'webhook_id',
    'estado',
    'reclamado_en',
    'finalizado_en',
    'creado_en'
  ],
  'La deduplicacion solo conserva identificadores opacos y estado'
);

select col_is_pk(
  'public',
  'sms_hook_eventos',
  'evento_huella',
  'La huella estable deduplica IDs distintos del mismo evento'
);

select ok(
  exists (
    select 1
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'sms_hook_eventos'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  'La tabla de deduplicacion fuerza RLS'
);

select results_eq(
  $$select grantee::text, privilege_type::text
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'sms_hook_eventos'
      and grantee in ('anon', 'authenticated', 'service_role')
    order by grantee, privilege_type$$,
  $$select null::text, null::text where false$$,
  'Ningun rol de API accede directamente a la tabla'
);

select has_function(
  'public',
  'reclamar_sms_hook_evento',
  array['text', 'text'],
  'La reclamacion atomica existe'
);

select has_function(
  'public',
  'finalizar_sms_hook_evento',
  array['text', 'text'],
  'La finalizacion atomica existe'
);

select has_function(
  'public',
  'liberar_sms_hook_evento',
  array['text'],
  'La liberacion de rechazos definitivos existe'
);

select ok(
  (
    select bool_and(p.prosecdef)
      and bool_and(
        coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
      )
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'reclamar_sms_hook_evento',
        'finalizar_sms_hook_evento',
        'liberar_sms_hook_evento'
      )
  ),
  'Las RPC privilegiadas fijan search_path vacio'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.reclamar_sms_hook_evento(text,text)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.reclamar_sms_hook_evento(text,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.reclamar_sms_hook_evento(text,text)',
      'EXECUTE'
    ),
  'Solo service_role ejecuta las RPC de deduplicacion'
);

set local role service_role;

select results_eq(
  $$select public.reclamar_sms_hook_evento(
      repeat('a', 64),
      'msg_first'
    )$$,
  $$values ('reclamado'::text)$$,
  'El primer intento reclama el evento'
);

select results_eq(
  $$select public.reclamar_sms_hook_evento(
      repeat('a', 64),
      'msg_retry'
    )$$,
  $$values ('ocupado'::text)$$,
  'Un reintento concurrente no confirma exito prematuramente'
);

select results_eq(
  $$select public.finalizar_sms_hook_evento(
      repeat('a', 64),
      'entregado'
    )$$,
  $$values (true)$$,
  'La entrega exitosa se finaliza'
);

select results_eq(
  $$select public.reclamar_sms_hook_evento(
      repeat('a', 64),
      'msg_new_retry_id'
    )$$,
  $$values ('finalizado'::text)$$,
  'Otro ID del mismo evento no reenvia el OTP finalizado'
);

reset role;

select * from finish();
rollback;
