alter table public.sms_hook_eventos
  rename column webhook_id to evento_huella;

alter table public.sms_hook_eventos
  drop constraint sms_hook_eventos_webhook_id_longitud,
  add column webhook_id text not null default ('legacy_' || gen_random_uuid()::text),
  add column estado text not null default 'procesando',
  add column reclamado_en timestamptz not null default statement_timestamp(),
  add column finalizado_en timestamptz,
  add constraint sms_hook_eventos_huella_formato
    check (evento_huella ~ '^[0-9a-f]{64}$'),
  add constraint sms_hook_eventos_webhook_id_longitud
    check (char_length(webhook_id) between 1 and 255),
  add constraint sms_hook_eventos_estado_valido
    check (estado in ('procesando', 'entregado', 'indeterminado')),
  add constraint sms_hook_eventos_finalizacion_consistente check (
    (estado = 'procesando' and finalizado_en is null)
    or (estado in ('entregado', 'indeterminado') and finalizado_en is not null)
  );

alter table public.sms_hook_eventos
  alter column webhook_id drop default;

create unique index sms_hook_eventos_webhook_id_key
  on public.sms_hook_eventos (webhook_id);

revoke all on table public.sms_hook_eventos from service_role;
revoke select (evento_huella) on table public.sms_hook_eventos
  from service_role;

create or replace function public.reclamar_sms_hook_evento(
  p_evento_huella text,
  p_webhook_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  if p_evento_huella !~ '^[0-9a-f]{64}$'
    or char_length(p_webhook_id) not between 1 and 255 then
    raise exception using
      errcode = '22023',
      message = 'Identificador de evento invalido';
  end if;

  delete from public.sms_hook_eventos
  where (estado in ('entregado', 'indeterminado')
      and finalizado_en < statement_timestamp() - interval '24 hours')
    or (estado = 'procesando'
      and reclamado_en < statement_timestamp() - interval '24 hours');

  insert into public.sms_hook_eventos as evento (
    evento_huella,
    webhook_id,
    estado,
    reclamado_en,
    finalizado_en
  )
  values (
    p_evento_huella,
    p_webhook_id,
    'procesando',
    statement_timestamp(),
    null
  )
  on conflict (evento_huella) do update
  set webhook_id = excluded.webhook_id,
      estado = 'procesando',
      reclamado_en = excluded.reclamado_en,
      finalizado_en = null
  where (
      evento.estado = 'procesando'
      and evento.reclamado_en < statement_timestamp() - interval '15 seconds'
    ) or (
      evento.estado in ('entregado', 'indeterminado')
      and evento.finalizado_en < statement_timestamp() - interval '2 hours'
    )
  returning estado into v_estado;

  if found then
    return 'reclamado';
  end if;

  select estado
  into v_estado
  from public.sms_hook_eventos
  where evento_huella = p_evento_huella
     or webhook_id = p_webhook_id
  order by (evento_huella = p_evento_huella) desc
  limit 1;

  if v_estado in ('entregado', 'indeterminado') then
    return 'finalizado';
  end if;

  return 'ocupado';
exception
  when unique_violation then
    select estado
    into v_estado
    from public.sms_hook_eventos
    where webhook_id = p_webhook_id;

    if v_estado in ('entregado', 'indeterminado') then
      return 'finalizado';
    end if;

    return 'ocupado';
end;
$$;

create or replace function public.finalizar_sms_hook_evento(
  p_evento_huella text,
  p_resultado text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actualizado boolean;
begin
  if p_resultado not in ('entregado', 'indeterminado') then
    raise exception using
      errcode = '22023',
      message = 'Resultado de entrega invalido';
  end if;

  update public.sms_hook_eventos
  set estado = p_resultado,
      finalizado_en = statement_timestamp()
  where evento_huella = p_evento_huella
    and estado = 'procesando'
  returning true into v_actualizado;

  return coalesce(v_actualizado, false);
end;
$$;

create or replace function public.liberar_sms_hook_evento(
  p_evento_huella text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eliminado boolean;
begin
  delete from public.sms_hook_eventos
  where evento_huella = p_evento_huella
    and estado = 'procesando'
  returning true into v_eliminado;

  return coalesce(v_eliminado, false);
end;
$$;

revoke execute on function public.reclamar_sms_hook_evento(text, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.finalizar_sms_hook_evento(text, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.liberar_sms_hook_evento(text)
  from public, anon, authenticated, service_role;

grant execute on function public.reclamar_sms_hook_evento(text, text)
  to service_role;
grant execute on function public.finalizar_sms_hook_evento(text, text)
  to service_role;
grant execute on function public.liberar_sms_hook_evento(text)
  to service_role;

comment on column public.sms_hook_eventos.evento_huella is
  'HMAC opaco y estable del telefono y OTP; no contiene esos valores en claro.';
comment on function public.reclamar_sms_hook_evento(text, text) is
  'Reclama un evento SMS con lease y deduplicacion durante la vigencia del OTP.';
