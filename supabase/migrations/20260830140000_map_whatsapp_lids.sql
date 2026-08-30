create table public.whatsapp_contactos_lid (
  id uuid primary key default gen_random_uuid(),
  instancia text not null,
  lid text not null,
  numero_whatsapp text not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint whatsapp_lid_numero_e164 check (numero_whatsapp ~ '^\\+[1-9][0-9]{7,14}$'),
  constraint whatsapp_contacto_lid_unique unique (instancia, lid)
);

alter table public.whatsapp_contactos_lid enable row level security;
alter table public.whatsapp_contactos_lid force row level security;
revoke all on table public.whatsapp_contactos_lid from anon, authenticated;
