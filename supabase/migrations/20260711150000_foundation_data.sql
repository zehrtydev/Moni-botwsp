create extension if not exists pgcrypto;

create type public.estado_gasto as enum (
  'incompleto',
  'pendiente_confirmacion',
  'confirmado',
  'rechazado',
  'error'
);

create type public.origen_gasto as enum ('texto', 'imagen');
create type public.rol_usuario as enum ('admin');

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  numero_whatsapp text unique,
  nombre text,
  creado_en timestamptz not null default now(),
  numero_whatsapp_actualizado_en timestamptz,
  constraint usuarios_numero_whatsapp_e164
    check (numero_whatsapp is null or numero_whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  constraint usuarios_nombre_longitud check (nombre is null or char_length(nombre) <= 100)
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true
);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  fecha_gasto date,
  hora_gasto time,
  monto bigint,
  moneda text not null default 'COP',
  categoria_id uuid references public.categorias (id) on delete restrict,
  descripcion text,
  metodo_pago text,
  estado public.estado_gasto not null,
  origen public.origen_gasto not null,
  soporte_path text,
  texto_original text not null,
  mensaje_origen_id text not null unique,
  confianza_extraccion numeric,
  creado_en timestamptz not null default now(),
  confirmado_en timestamptz,
  codigo_error text,
  constraint gastos_monto_positivo check (monto is null or monto > 0),
  constraint gastos_moneda_cop check (moneda = 'COP'),
  constraint gastos_descripcion_longitud check (descripcion is null or char_length(descripcion) between 1 and 500),
  constraint gastos_metodo_pago_longitud check (metodo_pago is null or char_length(metodo_pago) <= 100),
  constraint gastos_texto_original_longitud check (char_length(texto_original) <= 4000),
  constraint gastos_confianza_rango check (confianza_extraccion is null or confianza_extraccion between 0 and 1),
  constraint gastos_soporte_path_privado check (soporte_path is null or soporte_path !~* '^https?://'),
  constraint gastos_confirmacion_consistente check (
    (estado = 'confirmado' and confirmado_en is not null)
    or (estado <> 'confirmado' and confirmado_en is null)
  ),
  constraint gastos_pendiente_completo check (
    estado not in ('pendiente_confirmacion', 'confirmado')
    or (monto is not null and fecha_gasto is not null and categoria_id is not null and descripcion is not null)
  )
);

create unique index gastos_un_gasto_activo_por_usuario
  on public.gastos (usuario_id)
  where estado in ('incompleto', 'pendiente_confirmacion');

create index gastos_dashboard_confirmados_por_fecha
  on public.gastos (usuario_id, fecha_gasto desc)
  where estado = 'confirmado';

create index gastos_dashboard_confirmados_por_categoria_y_fecha
  on public.gastos (usuario_id, categoria_id, fecha_gasto desc)
  where estado = 'confirmado';

create table public.mensajes_entrantes (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null,
  instancia text not null,
  mensaje_origen_id text not null,
  numero_whatsapp text not null,
  tipo text not null check (tipo in ('texto', 'imagen')),
  recibido_en timestamptz not null,
  estado_procesamiento text not null default 'recibido'
    check (estado_procesamiento in ('recibido', 'procesando', 'procesado', 'error')),
  gasto_id uuid references public.gastos (id) on delete set null,
  codigo_error text,
  creado_en timestamptz not null default now(),
  procesado_en timestamptz,
  constraint mensajes_entrantes_numero_e164 check (numero_whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  constraint mensajes_entrantes_proveedor_instancia_origen_key unique (proveedor, instancia, mensaje_origen_id)
);

create table public.usuarios_roles (
  usuario_id uuid primary key references public.usuarios (id) on delete cascade,
  rol public.rol_usuario not null,
  creado_en timestamptz not null default now()
);

create or replace function public.crear_usuario_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.crear_usuario_desde_auth() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.crear_usuario_desde_auth();

insert into public.categorias (nombre)
values
  ('Alimentación'),
  ('Transporte'),
  ('Hogar'),
  ('Salud'),
  ('Ocio'),
  ('Educación'),
  ('Servicios'),
  ('Compras'),
  ('Deudas'),
  ('Otros');

alter table public.usuarios enable row level security;
alter table public.usuarios force row level security;
alter table public.categorias enable row level security;
alter table public.categorias force row level security;
alter table public.gastos enable row level security;
alter table public.gastos force row level security;
alter table public.mensajes_entrantes enable row level security;
alter table public.mensajes_entrantes force row level security;
alter table public.usuarios_roles enable row level security;
alter table public.usuarios_roles force row level security;

revoke all on table public.usuarios, public.categorias, public.gastos,
  public.mensajes_entrantes, public.usuarios_roles from anon, authenticated;

grant select on table public.usuarios, public.categorias, public.gastos to authenticated;

create policy usuarios_lectura_propietario
  on public.usuarios
  for select to authenticated
  using ((select auth.uid()) = id);

create policy categorias_lectura_activas
  on public.categorias
  for select to authenticated
  using (activa);

create policy gastos_lectura_confirmados_propietario
  on public.gastos
  for select to authenticated
  using ((select auth.uid()) = usuario_id and estado = 'confirmado');
