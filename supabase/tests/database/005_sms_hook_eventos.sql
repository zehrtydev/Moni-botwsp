begin;

select plan(18);

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
    'creado_en',
    'webhook_id',
    'estado',
    'reclamado_en',
    'finalizado_en',
    'lease_token'
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
  $$select grantee, privilege_type
    from (
      select grantee::text, privilege_type::text
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'sms_hook_eventos'
      union all
      select grantee::text, privilege_type::text
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name = 'sms_hook_eventos'
    ) as privilegios
    where grantee in ('anon', 'authenticated', 'service_role')
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
  array['text', 'uuid', 'text'],
  'La finalizacion atomica existe'
);

select has_function(
  'public',
  'liberar_sms_hook_evento',
  array['text', 'uuid'],
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
    )->>'estado'$$,
  $$values ('reclamado'::text)$$,
  'El primer intento reclama el evento'
);

select results_eq(
  $$select public.reclamar_sms_hook_evento(
      repeat('a', 64),
      'msg_retry'
    )->>'estado'$$,
  $$values ('ocupado'::text)$$,
  'Un reintento concurrente no confirma exito prematuramente'
);

reset role;

update public.sms_hook_eventos
set reclamado_en = statement_timestamp() - interval '1 minute'
where evento_huella = repeat('a', 64);

create temp table sms_hook_event_current_tokens (
  huella text primary key,
  lease_token uuid not null
);
grant select on sms_hook_event_current_tokens to service_role;

set local role service_role;

select results_eq(
  $$select public.reclamar_sms_hook_evento(
      repeat('a', 64),
      'msg_recovered_lease'
    )->>'estado'$$,
  $$values ('reclamado'::text)$$,
  'Un lease abandonado se puede reclamar de nuevo'
);

reset role;

insert into sms_hook_event_current_tokens (huella, lease_token)
select evento_huella, lease_token
from public.sms_hook_eventos
where evento_huella = repeat('a', 64);

set local role service_role;

select results_eq(
  $$select public.finalizar_sms_hook_evento(
      repeat('a', 64),
      (select lease_token
       from sms_hook_event_current_tokens
       where huella = repeat('a', 64)),
      'entregado'
    )$$,
  $$values (true)$$,
  'La entrega exitosa se finaliza'
);

select results_eq(
  $$select public.reclamar_sms_hook_evento(
      repeat('a', 64),
      'msg_new_retry_id'
    )->>'estado'$$,
  $$values ('finalizado'::text)$$,
  'Otro ID del mismo evento no reenvia el OTP finalizado'
);

select results_eq(
  $$select public.reclamar_sms_hook_evento(
      repeat('b', 64),
      'msg_rejected'
    )->>'estado'$$,
  $$values ('reclamado'::text)$$,
  'Un segundo evento se reclama antes del rechazo definitivo'
);

reset role;

insert into sms_hook_event_current_tokens (huella, lease_token)
select evento_huella, lease_token
from public.sms_hook_eventos
where evento_huella = repeat('b', 64);

set local role service_role;

select results_eq(
  $$select public.liberar_sms_hook_evento(
    repeat('b', 64),
    (select lease_token
     from sms_hook_event_current_tokens
     where huella = repeat('b', 64))
  )$$,
  $$values (true)$$,
  'Un rechazo definitivo libera el evento'
);

select results_eq(
  $$select public.reclamar_sms_hook_evento(
      repeat('b', 64),
      'msg_rejected_retry'
    )->>'estado'$$,
  $$values ('reclamado'::text)$$,
  'El evento liberado puede reintentarse'
);

reset role;

select * from finish();
rollback;
