create type public.estado_cambio_numero as enum (
  'solicitado',
  'otp_enviado',
  'verificado',
  'aplicado',
  'rechazado',
  'expirado'
);

create table public.auditoria_cambios_numero (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  solicitado_por uuid not null references public.usuarios (id) on delete restrict,
  numero_anterior text not null,
  numero_nuevo text not null,
  estado public.estado_cambio_numero not null default 'solicitado',
  proveedor_verificacion text,
  codigo_resultado text,
  creado_en timestamptz not null default now(),
  verificado_en timestamptz,
  resuelto_en timestamptz,
  constraint auditoria_cambios_numero_anterior_e164
    check (numero_anterior ~ '^\+[1-9][0-9]{7,14}$'),
  constraint auditoria_cambios_numero_nuevo_e164
    check (numero_nuevo ~ '^\+[1-9][0-9]{7,14}$'),
  constraint auditoria_cambios_numero_distinto check (numero_anterior <> numero_nuevo),
  constraint auditoria_cambios_numero_verificado_consistente check (
    (estado in ('verificado', 'aplicado') and verificado_en is not null)
    or (estado not in ('verificado', 'aplicado') and verificado_en is null)
  ),
  constraint auditoria_cambios_numero_resuelto_consistente check (
    (estado in ('aplicado', 'rechazado', 'expirado') and resuelto_en is not null)
    or (estado not in ('aplicado', 'rechazado', 'expirado') and resuelto_en is null)
  )
);

create unique index auditoria_un_cambio_activo_por_usuario
  on public.auditoria_cambios_numero (usuario_id)
  where estado in ('solicitado', 'otp_enviado', 'verificado');

create index auditoria_cambios_numero_usuario_fecha
  on public.auditoria_cambios_numero (usuario_id, creado_en desc);

alter table public.auditoria_cambios_numero enable row level security;
alter table public.auditoria_cambios_numero force row level security;

revoke all on table public.auditoria_cambios_numero from anon, authenticated;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios_roles
    where usuario_id = auth.uid()
      and rol = 'admin'::public.rol_usuario
  );
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;

grant select on table public.auditoria_cambios_numero to authenticated;

create policy auditoria_cambios_numero_lectura_admin
  on public.auditoria_cambios_numero
  for select to authenticated
  using ((select public.es_admin()));

create or replace function public.transicionar_gasto(
  p_gasto_id uuid,
  p_actor_usuario_id uuid,
  p_estado_destino public.estado_gasto,
  p_actualizacion jsonb default '{}'::jsonb
)
returns public.gastos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gasto public.gastos%rowtype;
  v_monto bigint;
  v_fecha_gasto date;
  v_categoria_id uuid;
  v_descripcion text;
  v_metodo_pago text;
  v_confianza numeric;
begin
  if jsonb_typeof(p_actualizacion) <> 'object' then
    raise exception 'La actualización debe ser un objeto JSON'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_actualizacion) as clave
    where clave not in (
      'monto',
      'fecha_gasto',
      'categoria_id',
      'descripcion',
      'metodo_pago',
      'confianza_extraccion'
    )
  ) then
    raise exception 'La actualización contiene campos no permitidos'
      using errcode = '22023';
  end if;

  select *
    into v_gasto
    from public.gastos
    where id = p_gasto_id
    for update;

  if not found then
    raise exception 'Gasto no encontrado'
      using errcode = 'P0002';
  end if;

  if v_gasto.usuario_id <> p_actor_usuario_id then
    raise exception 'El actor no es propietario del gasto'
      using errcode = '42501';
  end if;

  if v_gasto.estado in ('confirmado', 'rechazado', 'error') then
    raise exception 'No se puede transicionar un gasto terminal'
      using errcode = '22023';
  end if;

  if v_gasto.estado = 'incompleto'
    and p_estado_destino not in ('incompleto', 'pendiente_confirmacion', 'rechazado', 'error') then
    raise exception 'Transición de gasto inválida'
      using errcode = '22023';
  end if;

  if v_gasto.estado = 'pendiente_confirmacion'
    and p_estado_destino not in ('pendiente_confirmacion', 'confirmado', 'rechazado', 'error') then
    raise exception 'Transición de gasto inválida'
      using errcode = '22023';
  end if;

  v_monto := case
    when p_actualizacion ? 'monto' then (p_actualizacion ->> 'monto')::bigint
    else v_gasto.monto
  end;
  v_fecha_gasto := case
    when p_actualizacion ? 'fecha_gasto' then (p_actualizacion ->> 'fecha_gasto')::date
    else v_gasto.fecha_gasto
  end;
  v_categoria_id := case
    when p_actualizacion ? 'categoria_id' then (p_actualizacion ->> 'categoria_id')::uuid
    else v_gasto.categoria_id
  end;
  v_descripcion := case
    when p_actualizacion ? 'descripcion' then p_actualizacion ->> 'descripcion'
    else v_gasto.descripcion
  end;
  v_metodo_pago := case
    when p_actualizacion ? 'metodo_pago' then p_actualizacion ->> 'metodo_pago'
    else v_gasto.metodo_pago
  end;
  v_confianza := case
    when p_actualizacion ? 'confianza_extraccion' then (p_actualizacion ->> 'confianza_extraccion')::numeric
    else v_gasto.confianza_extraccion
  end;

  if v_categoria_id is not null and not exists (
    select 1
    from public.categorias
    where id = v_categoria_id
      and activa
  ) then
    raise exception 'La categoría debe existir y estar activa'
      using errcode = '22023';
  end if;

  update public.gastos
    set monto = v_monto,
        fecha_gasto = v_fecha_gasto,
        categoria_id = v_categoria_id,
        descripcion = v_descripcion,
        metodo_pago = v_metodo_pago,
        confianza_extraccion = v_confianza,
        estado = p_estado_destino,
        confirmado_en = case
          when p_estado_destino = 'confirmado' then statement_timestamp()
          else null
        end
    where id = v_gasto.id
    returning * into v_gasto;

  return v_gasto;
end;
$$;

revoke all on function public.transicionar_gasto(uuid, uuid, public.estado_gasto, jsonb)
  from public, anon, authenticated;
grant execute on function public.transicionar_gasto(uuid, uuid, public.estado_gasto, jsonb)
  to service_role;
