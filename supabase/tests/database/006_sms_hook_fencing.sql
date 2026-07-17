begin;

select plan(10);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sms_hook_eventos'
      and column_name = 'lease_token'
      and data_type = 'uuid'
  ),
  'Cada reclamacion conserva un token de fencing UUID'
);

select has_function(
  'public',
  'reclamar_sms_hook_evento',
  array['text', 'text'],
  'La reclamacion devuelve el lease vigente'
);

select has_function(
  'public',
  'finalizar_sms_hook_evento',
  array['text', 'uuid', 'text'],
  'Finalizar exige el token de lease'
);

select has_function(
  'public',
  'liberar_sms_hook_evento',
  array['text', 'uuid'],
  'Liberar exige el token de lease'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.finalizar_sms_hook_evento(text,uuid,text)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.finalizar_sms_hook_evento(text,uuid,text)',
      'EXECUTE'
    ),
  'Solo service_role puede finalizar con fencing'
);

set local role service_role;

create temp table sms_hook_fencing_test (
  huella text primary key,
  token_a uuid,
  token_b uuid
);

insert into sms_hook_fencing_test (huella, token_a)
select repeat('c', 64),
  ((public.reclamar_sms_hook_evento(repeat('c', 64), 'fence-a'))->>'lease_token')::uuid;

select ok(
  (select token_a is not null from sms_hook_fencing_test),
  'A recibe un token de lease'
);

reset role;

update public.sms_hook_eventos
set reclamado_en = statement_timestamp() - interval '1 minute'
where evento_huella = repeat('c', 64);

set local role service_role;

update sms_hook_fencing_test
set token_b = (
  (public.reclamar_sms_hook_evento(repeat('c', 64), 'fence-b'))->>'lease_token'
)::uuid
where huella = repeat('c', 64);

select ok(
  (select token_b is not null and token_b <> token_a from sms_hook_fencing_test),
  'B recibe un token distinto al lease vencido de A'
);

select is(
  public.finalizar_sms_hook_evento(
    repeat('c', 64),
    (select token_a from sms_hook_fencing_test),
    'entregado'
  ),
  false,
  'A no puede finalizar el lease tomado por B'
);

select is(
  public.liberar_sms_hook_evento(
    repeat('c', 64),
    (select token_a from sms_hook_fencing_test)
  ),
  false,
  'A no puede liberar el lease tomado por B'
);

select is(
  public.finalizar_sms_hook_evento(
    repeat('c', 64),
    (select token_b from sms_hook_fencing_test),
    'entregado'
  ),
  true,
  'B sí puede finalizar su lease vigente'
);

reset role;

select * from finish();
rollback;
