grant select (webhook_id) on table public.sms_hook_eventos to service_role;

comment on column public.sms_hook_eventos.webhook_id is
  'Identificador opaco; service_role solo puede leerlo para liberar reclamos fallidos.';
