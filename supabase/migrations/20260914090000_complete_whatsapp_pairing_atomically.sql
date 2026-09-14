create or replace function public.completar_vinculacion_whatsapp(
  p_codigo_hash text,
  p_instancia text,
  p_lid text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pairing public.whatsapp_vinculaciones_pendientes%rowtype;
  v_completed_at timestamptz := statement_timestamp();
  v_previous_number text;
begin
  if p_codigo_hash is null
    or p_codigo_hash !~ '^[0-9a-f]{64}$'
    or nullif(btrim(p_instancia), '') is null
    or char_length(p_instancia) > 200
    or nullif(btrim(p_lid), '') is null
    or char_length(p_lid) > 200
    or p_lid !~ '@lid$' then
    raise exception 'Invalid WhatsApp pairing input'
      using errcode = '22023';
  end if;

  select *
    into v_pairing
    from public.whatsapp_vinculaciones_pendientes
    where codigo_hash = p_codigo_hash
      and usado_en is null
      and expira_en > v_completed_at
    for update;

  if not found then
    return null;
  end if;

  select numero_whatsapp
    into v_previous_number
    from public.usuarios
    where id = v_pairing.usuario_id
    for update;

  if not found then
    raise exception 'WhatsApp pairing user not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.usuarios
    where numero_whatsapp = v_pairing.numero_whatsapp
      and id <> v_pairing.usuario_id
  ) then
    raise exception 'WHATSAPP_NUMBER_ALREADY_LINKED'
      using errcode = '23505';
  end if;

  delete from public.whatsapp_contactos_lid as contact
    where (
      v_previous_number is not null
      and v_previous_number is distinct from v_pairing.numero_whatsapp
      and contact.numero_whatsapp = v_previous_number
    ) or (
      contact.numero_whatsapp = v_pairing.numero_whatsapp
      and not exists (
        select 1
        from public.usuarios
        where numero_whatsapp = v_pairing.numero_whatsapp
      )
    );

  update public.usuarios
    set numero_whatsapp = v_pairing.numero_whatsapp,
        numero_whatsapp_actualizado_en = v_completed_at
    where id = v_pairing.usuario_id;

  insert into public.whatsapp_contactos_lid (
    instancia,
    lid,
    numero_whatsapp,
    actualizado_en
  ) values (
    p_instancia,
    p_lid,
    v_pairing.numero_whatsapp,
    v_completed_at
  )
  on conflict (instancia, lid) do update
    set numero_whatsapp = excluded.numero_whatsapp,
        actualizado_en = excluded.actualizado_en;

  update public.whatsapp_vinculaciones_pendientes
    set usado_en = v_completed_at
    where id = v_pairing.id
      and usado_en is null;

  if not found then
    raise exception 'WhatsApp pairing was already completed'
      using errcode = '40001';
  end if;

  return jsonb_build_object(
    'usuario_id', v_pairing.usuario_id,
    'numero_whatsapp', v_pairing.numero_whatsapp
  );
exception
  when unique_violation then
    raise exception 'WHATSAPP_NUMBER_ALREADY_LINKED'
      using errcode = '23505';
end;
$$;

revoke all on function public.completar_vinculacion_whatsapp(text, text, text)
  from public, anon, authenticated;
grant execute on function public.completar_vinculacion_whatsapp(text, text, text)
  to service_role;
