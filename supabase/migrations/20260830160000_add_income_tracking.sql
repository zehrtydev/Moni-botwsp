create type public.estado_ingreso as enum (
  'pendiente_confirmacion',
  'confirmado',
  'rechazado'
);

create type public.origen_ingreso as enum ('texto');

create table public.categorias_ingreso (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true
);

insert into public.categorias_ingreso (nombre)
values ('Ayuda familiar'), ('Trabajo'), ('Transferencias'), ('Casino'), ('Otros')
on conflict (nombre) do update set activa = excluded.activa;

create table public.ingresos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  fecha_ingreso date not null,
  monto bigint not null,
  moneda text not null default 'COP',
  categoria_id uuid not null references public.categorias_ingreso (id) on delete restrict,
  descripcion text not null,
  estado public.estado_ingreso not null,
  origen public.origen_ingreso not null,
  texto_original text not null,
  mensaje_origen_id text not null unique,
  creado_en timestamptz not null default now(),
  confirmado_en timestamptz,
  constraint ingresos_monto_positivo check (monto > 0),
  constraint ingresos_moneda_cop check (moneda = 'COP'),
  constraint ingresos_descripcion_longitud check (char_length(descripcion) between 1 and 500),
  constraint ingresos_confirmacion_consistente check (
    (estado = 'confirmado' and confirmado_en is not null)
    or (estado <> 'confirmado' and confirmado_en is null)
  )
);

create unique index ingresos_un_ingreso_activo_por_usuario
  on public.ingresos (usuario_id)
  where estado = 'pendiente_confirmacion';

create index ingresos_confirmados_por_fecha
  on public.ingresos (usuario_id, fecha_ingreso desc)
  where estado = 'confirmado';

alter table public.categorias_ingreso enable row level security;
alter table public.categorias_ingreso force row level security;
alter table public.ingresos enable row level security;
alter table public.ingresos force row level security;

revoke all on table public.categorias_ingreso, public.ingresos from anon, authenticated;
grant select on table public.categorias_ingreso, public.ingresos to authenticated;

create policy categorias_ingreso_lectura_activas
  on public.categorias_ingreso for select to authenticated using (activa);

create policy ingresos_lectura_propietario
  on public.ingresos for select to authenticated using ((select auth.uid()) = usuario_id);
