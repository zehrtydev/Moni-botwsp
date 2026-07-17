begin;

select plan(6);

select has_table(
  'public',
  'sms_hook_eventos',
  'La deduplicacion persistente del Send SMS Hook existe'
);

select columns_are(
  'public',
  'sms_hook_eventos',
  array['webhook_id', 'creado_en'],
  'La deduplicacion no almacena OTP, telefono ni credenciales'
);

select col_is_pk(
  'public',
  'sms_hook_eventos',
  'webhook_id',
  'Cada webhook-id se reclama una sola vez'
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
      and grantee in ('anon', 'authenticated')
    order by grantee, privilege_type$$,
  $$select null::text, null::text where false$$,
  'Los clientes anonimos y autenticados no tienen acceso'
);

select results_eq(
  $$select privilege_type::text
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'sms_hook_eventos'
      and grantee = 'service_role'
    order by privilege_type$$,
  $$values ('DELETE'::text), ('INSERT'::text)$$,
  'Solo service_role puede reclamar y liberar entregas'
);

select * from finish();
rollback;
