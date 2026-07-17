create function public.registrar_mensaje_entrante(
  p_proveedor text,
  p_instancia text,
  p_mensaje_origen_id text,
  p_numero_whatsapp text,
  p_tipo text,
  p_recibido_en timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insertado boolean;
begin
  if p_proveedor <> 'evolution'
    or p_instancia is null
    or char_length(p_instancia) not between 1 and 128
    or p_instancia !~ '^[\x21-\x7e]+$'
    or p_mensaje_origen_id is null
    or char_length(p_mensaje_origen_id) not between 1 and 255
    or p_mensaje_origen_id !~ '^[\x21-\x7e]+$'
    or p_numero_whatsapp is null
    or p_numero_whatsapp !~ '^\+[1-9][0-9]{7,14}$'
    or p_tipo not in ('texto', 'imagen')
    or p_recibido_en is null then
    raise exception using
      errcode = '22023',
      message = 'Mensaje entrante invalido';
  end if;

  insert into public.mensajes_entrantes (
    proveedor,
    instancia,
    mensaje_origen_id,
    numero_whatsapp,
    tipo,
    recibido_en
  )
  values (
    p_proveedor,
    p_instancia,
    p_mensaje_origen_id,
    p_numero_whatsapp,
    p_tipo,
    p_recibido_en
  )
  on conflict (proveedor, instancia, mensaje_origen_id) do nothing
  returning true into v_insertado;

  return case when v_insertado then 'insertado' else 'duplicado' end;
end;
$$;

revoke execute on function public.registrar_mensaje_entrante(
  text, text, text, text, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.registrar_mensaje_entrante(
  text, text, text, text, text, timestamptz
) to service_role;

comment on function public.registrar_mensaje_entrante(
  text, text, text, text, text, timestamptz
) is
  'Registra solo metadatos normalizados del relay y deduplica por origen.';
