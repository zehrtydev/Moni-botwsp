create table public.presupuestos_mensuales (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  mes date not null,
  monto_limite bigint not null check (monto_limite > 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint presupuestos_mes_inicio check (extract(day from mes) = 1),
  constraint presupuestos_usuario_categoria_mes unique (usuario_id, categoria_id, mes)
);

create index presupuestos_usuario_mes_idx on public.presupuestos_mensuales (usuario_id, mes);
alter table public.presupuestos_mensuales enable row level security;
alter table public.presupuestos_mensuales force row level security;
revoke all on table public.presupuestos_mensuales from anon, authenticated;
grant select on table public.presupuestos_mensuales to authenticated;
create policy presupuestos_lectura_propietario on public.presupuestos_mensuales
  for select to authenticated using ((select auth.uid()) = usuario_id);
