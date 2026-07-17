create table public.sms_hook_eventos (
  webhook_id text primary key,
  creado_en timestamptz not null default now(),
  constraint sms_hook_eventos_webhook_id_longitud
    check (char_length(webhook_id) between 1 and 255)
);

alter table public.sms_hook_eventos enable row level security;
alter table public.sms_hook_eventos force row level security;

revoke all on table public.sms_hook_eventos
  from public, anon, authenticated, service_role;
grant insert, delete on table public.sms_hook_eventos to service_role;

comment on table public.sms_hook_eventos is
  'Identificadores opacos usados para deduplicar entregas del Send SMS Hook.';
