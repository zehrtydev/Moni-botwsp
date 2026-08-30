create table public.whatsapp_vinculaciones_pendientes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  numero_whatsapp text not null,
  codigo_hash text not null unique,
  expira_en timestamptz not null,
  usado_en timestamptz,
  creado_en timestamptz not null default now(),
  constraint whatsapp_pairing_numero_e164 check (numero_whatsapp ~ '^\\+[1-9][0-9]{7,14}$')
);

create index whatsapp_pairing_usuario_activo
  on public.whatsapp_vinculaciones_pendientes (usuario_id, expira_en desc)
  where usado_en is null;

alter table public.whatsapp_vinculaciones_pendientes enable row level security;
alter table public.whatsapp_vinculaciones_pendientes force row level security;
revoke all on table public.whatsapp_vinculaciones_pendientes from anon, authenticated;
