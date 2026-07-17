alter table public.sms_hook_eventos
  add column lease_token uuid not null default extensions.gen_random_uuid();

drop function public.reclamar_sms_hook_evento(text, text);
drop function public.finalizar_sms_hook_evento(text, text);
drop function public.liberar_sms_hook_evento(text);

create function public.reclamar_sms_hook_evento(
  p_evento_huella text,
  p_webhook_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_lease_token uuid;
begin
  if p_evento_huella is null
    or p_evento_huella !~ '^[0-9a-f]{64}$'
    or p_webhook_id is null
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
    finalizado_en,
    lease_token
  )
  values (
    p_evento_huella,
    p_webhook_id,
    'procesando',
    statement_timestamp(),
    null,
    extensions.gen_random_uuid()
  )
  on conflict (evento_huella) do update
  set webhook_id = excluded.webhook_id,
      estado = 'procesando',
      reclamado_en = excluded.reclamado_en,
      finalizado_en = null,
      lease_token = excluded.lease_token
  where (
      evento.estado = 'procesando'
      and evento.reclamado_en < statement_timestamp() - interval '15 seconds'
    ) or (
      evento.estado in ('entregado', 'indeterminado')
      and evento.finalizado_en < statement_timestamp() - interval '2 hours'
    )
  returning estado, lease_token into v_estado, v_lease_token;

  if found then
    return jsonb_build_object(
      'estado', 'reclamado',
      'lease_token', v_lease_token
    );
  end if;

  select estado, lease_token
  into v_estado, v_lease_token
  from public.sms_hook_eventos
  where evento_huella = p_evento_huella
     or webhook_id = p_webhook_id
  order by (evento_huella = p_evento_huella) desc
  limit 1;

  if v_estado in ('entregado', 'indeterminado') then
    return jsonb_build_object(
      'estado', 'finalizado',
      'lease_token', null::uuid
    );
  end if;

  return jsonb_build_object(
    'estado', 'ocupado',
    'lease_token', null::uuid
  );
exception
  when unique_violation then
    select estado
    into v_estado
    from public.sms_hook_eventos
    where webhook_id = p_webhook_id;

    if v_estado in ('entregado', 'indeterminado') then
      return jsonb_build_object(
        'estado', 'finalizado',
        'lease_token', null::uuid
      );
    end if;

    return jsonb_build_object(
      'estado', 'ocupado',
      'lease_token', null::uuid
    );
end;
$$;

create function public.finalizar_sms_hook_evento(
  p_evento_huella text,
  p_lease_token uuid,
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
  if p_evento_huella is null
    or p_evento_huella !~ '^[0-9a-f]{64}$'
    or p_lease_token is null
    or p_resultado not in ('entregado', 'indeterminado') then
    raise exception using
      errcode = '22023',
      message = 'Resultado de entrega invalido';
  end if;

  update public.sms_hook_eventos
  set estado = p_resultado,
      finalizado_en = statement_timestamp()
  where evento_huella = p_evento_huella
    and lease_token = p_lease_token
    and estado = 'procesando'
  returning true into v_actualizado;

  return coalesce(v_actualizado, false);
end;
$$;

create function public.liberar_sms_hook_evento(
  p_evento_huella text,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eliminado boolean;
begin
  if p_evento_huella is null
    or p_evento_huella !~ '^[0-9a-f]{64}$'
    or p_lease_token is null then
    return false;
  end if;

  delete from public.sms_hook_eventos
  where evento_huella = p_evento_huella
    and lease_token = p_lease_token
    and estado = 'procesando'
  returning true into v_eliminado;

  return coalesce(v_eliminado, false);
end;
$$;

revoke execute on function public.reclamar_sms_hook_evento(text, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.finalizar_sms_hook_evento(text, uuid, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.liberar_sms_hook_evento(text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.reclamar_sms_hook_evento(text, text)
  to service_role;
grant execute on function public.finalizar_sms_hook_evento(text, uuid, text)
  to service_role;
grant execute on function public.liberar_sms_hook_evento(text, uuid)
  to service_role;

comment on column public.sms_hook_eventos.lease_token is
  'Token de fencing unico por reclamacion; impide que un worker vencido modifique otro lease.';
