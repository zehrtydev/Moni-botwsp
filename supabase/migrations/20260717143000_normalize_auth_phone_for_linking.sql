create or replace function public.vincular_numero_autenticado()
returns public.usuarios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_numero_auth text;
  v_numero_whatsapp text;
  v_numero_confirmado_en timestamptz;
  v_usuario public.usuarios%rowtype;
begin
  if v_usuario_id is null then
    raise exception 'Se requiere una sesion autenticada'
      using errcode = '28000';
  end if;

  select usuario_auth.phone, usuario_auth.phone_confirmed_at
    into v_numero_auth, v_numero_confirmado_en
    from auth.users as usuario_auth
    where usuario_auth.id = v_usuario_id
    for share;

  if not found
    or v_numero_auth is null
    or v_numero_confirmado_en is null then
    raise exception 'El numero de la sesion no esta verificado'
      using errcode = '28000';
  end if;

  if v_numero_auth ~ '^\+[1-9][0-9]{7,14}$' then
    v_numero_whatsapp := v_numero_auth;
  elsif v_numero_auth ~ '^[1-9][0-9]{7,14}$' then
    v_numero_whatsapp := '+' || v_numero_auth;
  else
    raise exception 'El numero verificado debe estar en formato E.164'
      using errcode = '22023';
  end if;

  select *
    into v_usuario
    from public.usuarios
    where id = v_usuario_id
    for update;

  if not found then
    raise exception 'Perfil de usuario no encontrado'
      using errcode = 'P0002';
  end if;

  if v_usuario.numero_whatsapp is null then
    update public.usuarios
      set numero_whatsapp = v_numero_whatsapp
      where id = v_usuario_id
      returning * into v_usuario;
  elsif v_usuario.numero_whatsapp <> v_numero_whatsapp then
    raise exception 'El cambio de numero requiere el flujo auditado'
      using errcode = '42501';
  end if;

  return v_usuario;
end;
$$;

revoke all on function public.vincular_numero_autenticado()
  from public, anon, authenticated, service_role;
grant execute on function public.vincular_numero_autenticado()
  to authenticated;
