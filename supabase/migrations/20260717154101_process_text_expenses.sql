create extension if not exists pg_cron;

alter table public.mensajes_entrantes
  add column resultado_procesamiento text,
  add column respuesta_texto text,
  add column respuesta_reclamada_en timestamptz,
  add column respuesta_lease_token uuid,
  add column respuesta_enviada_en timestamptz,
  add column respuesta_resultado text,
  add constraint mensajes_entrantes_resultado_procesamiento_valido check (
    resultado_procesamiento is null
    or resultado_procesamiento in (
      'propuesta',
      'incompleto',
      'no_vinculado',
      'gasto_activo',
      'confirmado',
      'rechazado',
      'sin_gasto_activo',
      'limitado'
    )
  ),
  add constraint mensajes_entrantes_respuesta_longitud check (
    respuesta_texto is null or char_length(respuesta_texto) between 1 and 1000
  ),
  add constraint mensajes_entrantes_respuesta_entrega_consistente check (
    (
      respuesta_enviada_en is null
      and respuesta_resultado is null
      and (
        (respuesta_reclamada_en is null and respuesta_lease_token is null)
        or (respuesta_reclamada_en is not null and respuesta_lease_token is not null)
      )
    )
    or (
      respuesta_enviada_en is not null
      and respuesta_texto is not null
      and respuesta_resultado in ('entregada', 'indeterminada', 'rechazada')
      and respuesta_reclamada_en is not null
      and respuesta_lease_token is not null
    )
  );

create index mensajes_entrantes_gasto_id_idx
  on public.mensajes_entrantes (gasto_id)
  where gasto_id is not null;

create index mensajes_entrantes_numero_creado_idx
  on public.mensajes_entrantes (numero_whatsapp, creado_en desc);

create function public.procesar_mensaje_texto(
  p_proveedor text,
  p_instancia text,
  p_mensaje_origen_id text,
  p_numero_whatsapp text,
  p_texto_original text,
  p_recibido_en timestamptz,
  p_monto bigint,
  p_fecha_gasto date,
  p_categoria_nombre text,
  p_descripcion text,
  p_metodo_pago text,
  p_confianza numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mensaje public.mensajes_entrantes%rowtype;
  v_usuario public.usuarios%rowtype;
  v_gasto public.gastos%rowtype;
  v_categoria_id uuid;
  v_categoria_nombre text;
  v_estado public.estado_gasto;
  v_resultado text;
  v_respuesta text;
  v_comando text;
  v_descripcion_corregida text;
  v_actualizacion jsonb := '{}'::jsonb;
begin
  if p_texto_original is null
    or char_length(p_texto_original) not between 1 and 4000
    or (p_monto is not null and p_monto <= 0)
    or (p_categoria_nombre is not null and char_length(p_categoria_nombre) not between 1 and 100)
    or (p_descripcion is not null and char_length(p_descripcion) not between 1 and 500)
    or (p_metodo_pago is not null and char_length(p_metodo_pago) > 100)
    or (p_confianza is not null and p_confianza not between 0 and 1) then
    raise exception using
      errcode = '22023',
      message = 'Extraccion de gasto invalida';
  end if;

  if p_proveedor is null
    or p_instancia is null
    or p_mensaje_origen_id is null
    or p_numero_whatsapp is null
    or p_recibido_en is null then
    raise exception using
      errcode = '22023',
      message = 'Los metadatos del mensaje no coinciden';
  end if;

  select *
    into v_mensaje
    from public.mensajes_entrantes
    where proveedor = p_proveedor
      and instancia = p_instancia
      and mensaje_origen_id = p_mensaje_origen_id
    for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Mensaje entrante no encontrado';
  end if;

  if v_mensaje.numero_whatsapp is distinct from p_numero_whatsapp
    or v_mensaje.tipo is distinct from 'texto'
    or v_mensaje.recibido_en is distinct from p_recibido_en then
    raise exception using
      errcode = '22023',
      message = 'Los metadatos del mensaje no coinciden';
  end if;

  if v_mensaje.estado_procesamiento = 'procesado' then
    return jsonb_build_object(
      'resultado', v_mensaje.resultado_procesamiento,
      'mensaje_entrante_id', v_mensaje.id,
      'gasto_id', v_mensaje.gasto_id,
      'respuesta', v_mensaje.respuesta_texto
    );
  end if;

  if (
    select count(*) > 30
    from public.mensajes_entrantes
    where numero_whatsapp = p_numero_whatsapp
      and creado_en >= statement_timestamp() - interval '1 minute'
  ) then
    update public.mensajes_entrantes
      set estado_procesamiento = 'procesado',
          resultado_procesamiento = 'limitado',
          respuesta_texto = null,
          procesado_en = statement_timestamp(),
          codigo_error = null
      where id = v_mensaje.id
      returning * into v_mensaje;

    return jsonb_build_object(
      'resultado', 'limitado',
      'mensaje_entrante_id', v_mensaje.id,
      'gasto_id', null::uuid,
      'respuesta', null::text
    );
  end if;

  v_comando := regexp_replace(
    lower(translate(
      btrim(p_texto_original),
      'ÁÉÍÓÚÜÑáéíóúüñ',
      'AEIOUUNaeiouun'
    )),
    '[[:space:][:punct:]]+',
    '',
    'g'
  );

  select *
    into v_usuario
    from public.usuarios
    where numero_whatsapp = p_numero_whatsapp
    for update;

  if not found then
    v_resultado := 'no_vinculado';
    v_respuesta := 'Primero vincula este número en Moni para registrar gastos.';

    update public.mensajes_entrantes
      set estado_procesamiento = 'procesado',
          resultado_procesamiento = v_resultado,
          respuesta_texto = v_respuesta,
          procesado_en = statement_timestamp(),
          codigo_error = null
      where id = v_mensaje.id
      returning * into v_mensaje;

    return jsonb_build_object(
      'resultado', v_resultado,
      'mensaje_entrante_id', v_mensaje.id,
      'gasto_id', null::uuid,
      'respuesta', v_respuesta
    );
  end if;

  if p_categoria_nombre is not null then
    select id, nombre
      into v_categoria_id, v_categoria_nombre
      from public.categorias
      where nombre = p_categoria_nombre
        and activa;

    if not found then
      raise exception using
        errcode = '22023',
        message = 'La categoria debe existir y estar activa';
    end if;
  end if;

  select *
    into v_gasto
    from public.gastos
    where usuario_id = v_usuario.id
      and estado in ('incompleto', 'pendiente_confirmacion')
    for update;

  if found then
    if v_gasto.estado = 'pendiente_confirmacion'
      and v_comando in ('si', 'confirmar') then
      select *
        into v_gasto
        from public.transicionar_gasto(
          v_gasto.id,
          v_usuario.id,
          'confirmado'::public.estado_gasto,
          '{}'::jsonb
        );
      v_resultado := 'confirmado';
      v_respuesta := 'Listo, confirmé el gasto. Ya aparece en tu dashboard.';
    elsif v_comando in ('no', 'cancelar', 'descartar') then
      select *
        into v_gasto
        from public.transicionar_gasto(
          v_gasto.id,
          v_usuario.id,
          'rechazado'::public.estado_gasto,
          '{}'::jsonb
        );
      v_resultado := 'rechazado';
      v_respuesta := 'Listo, descarté el gasto.';
    elsif v_gasto.estado = 'incompleto' then
      if v_gasto.monto is null and p_monto is not null then
        v_actualizacion := v_actualizacion || jsonb_build_object('monto', p_monto);
      end if;
      if v_gasto.fecha_gasto is null and p_fecha_gasto is not null then
        v_actualizacion := v_actualizacion || jsonb_build_object('fecha_gasto', p_fecha_gasto);
      end if;
      if v_gasto.categoria_id is null and v_categoria_id is not null then
        v_actualizacion := v_actualizacion || jsonb_build_object('categoria_id', v_categoria_id);
      end if;
      if v_gasto.descripcion is null and p_descripcion is not null then
        v_actualizacion := v_actualizacion || jsonb_build_object('descripcion', p_descripcion);
      end if;
      if v_gasto.metodo_pago is null and p_metodo_pago is not null then
        v_actualizacion := v_actualizacion || jsonb_build_object('metodo_pago', p_metodo_pago);
      end if;
      if p_confianza is not null then
        v_actualizacion := v_actualizacion
          || jsonb_build_object('confianza_extraccion', p_confianza);
      end if;

      v_estado := case
        when coalesce(v_gasto.monto, p_monto) is not null
          and coalesce(v_gasto.fecha_gasto, p_fecha_gasto) is not null
          and coalesce(v_gasto.categoria_id, v_categoria_id) is not null
          and coalesce(v_gasto.descripcion, p_descripcion) is not null
          then 'pendiente_confirmacion'::public.estado_gasto
        else 'incompleto'::public.estado_gasto
      end;

      select *
        into v_gasto
        from public.transicionar_gasto(
          v_gasto.id,
          v_usuario.id,
          v_estado,
          v_actualizacion
        );

      if v_gasto.estado = 'pendiente_confirmacion' then
        v_resultado := 'propuesta';
      else
        v_resultado := 'incompleto';
        v_respuesta := case
          when v_gasto.monto is null then '¿Cuál fue el monto del gasto?'
          when v_gasto.fecha_gasto is null then '¿Cuál fue la fecha del gasto?'
          when v_gasto.categoria_id is null then '¿Cuál es la categoría del gasto?'
          else '¿Cómo describirías el gasto?'
        end;
      end if;
    elsif v_comando like 'corregir%' then
      if p_monto is not null then
        v_actualizacion := v_actualizacion || jsonb_build_object('monto', p_monto);
      end if;
      if v_categoria_id is not null
        and (
          p_categoria_nombre <> 'Otros'
          or lower(p_texto_original) ~ '\motros\M'
        ) then
        v_actualizacion := v_actualizacion
          || jsonb_build_object('categoria_id', v_categoria_id);
      end if;
      if lower(p_texto_original) ~ '\m(ayer|hoy)\M'
        and p_fecha_gasto is not null then
        v_actualizacion := v_actualizacion
          || jsonb_build_object('fecha_gasto', p_fecha_gasto);
      end if;
      if lower(p_texto_original) ~ '^\s*corregir\s+descripci[oó]n\s+' then
        v_descripcion_corregida := btrim(regexp_replace(
          p_texto_original,
          '^\s*corregir\s+descripci[oó]n\s*[:=-]?\s*',
          '',
          'i'
        ));
        if char_length(v_descripcion_corregida) between 1 and 500 then
          v_actualizacion := v_actualizacion
            || jsonb_build_object('descripcion', v_descripcion_corregida);
        end if;
      end if;
      if p_confianza is not null and v_actualizacion <> '{}'::jsonb then
        v_actualizacion := v_actualizacion
          || jsonb_build_object('confianza_extraccion', p_confianza);
      end if;

      if v_actualizacion = '{}'::jsonb then
        v_resultado := 'gasto_activo';
        v_respuesta := 'No entendí la corrección. Escribe, por ejemplo: corregir 25000.';
      else
        select *
          into v_gasto
          from public.transicionar_gasto(
            v_gasto.id,
            v_usuario.id,
            'pendiente_confirmacion'::public.estado_gasto,
            v_actualizacion
          );
        v_resultado := 'propuesta';
      end if;
    else
      v_resultado := 'gasto_activo';
      v_respuesta := 'Ya tienes un gasto pendiente. Responde sí, no o corregir [dato].';
    end if;

    if v_resultado = 'propuesta' then
      select nombre
        into v_categoria_nombre
        from public.categorias
        where id = v_gasto.categoria_id;

      v_respuesta := 'Registré: $'
        || replace(to_char(v_gasto.monto, 'FM999G999G999G999'), ',', '.')
        || ' COP · '
        || v_categoria_nombre || ' · ' || v_gasto.descripcion || ' · '
        || extract(day from v_gasto.fecha_gasto)::integer::text || ' '
        || case extract(month from v_gasto.fecha_gasto)::integer
          when 1 then 'ene'
          when 2 then 'feb'
          when 3 then 'mar'
          when 4 then 'abr'
          when 5 then 'may'
          when 6 then 'jun'
          when 7 then 'jul'
          when 8 then 'ago'
          when 9 then 'sep'
          when 10 then 'oct'
          when 11 then 'nov'
          when 12 then 'dic'
        end
        || E'.\nResponde sí, no o corregir [dato].';
    end if;

    update public.mensajes_entrantes
      set estado_procesamiento = 'procesado',
          gasto_id = v_gasto.id,
          resultado_procesamiento = v_resultado,
          respuesta_texto = v_respuesta,
          procesado_en = statement_timestamp(),
          codigo_error = null
      where id = v_mensaje.id
      returning * into v_mensaje;

    return jsonb_build_object(
      'resultado', v_resultado,
      'mensaje_entrante_id', v_mensaje.id,
      'gasto_id', v_gasto.id,
      'respuesta', v_respuesta
    );
  end if;

  if v_comando in ('si', 'confirmar', 'no', 'cancelar', 'descartar')
    or v_comando like 'corregir%' then
    v_resultado := 'sin_gasto_activo';
    v_respuesta := 'No tienes un gasto pendiente. Envíame uno, por ejemplo: Almuerzo 35000.';

    update public.mensajes_entrantes
      set estado_procesamiento = 'procesado',
          resultado_procesamiento = v_resultado,
          respuesta_texto = v_respuesta,
          procesado_en = statement_timestamp(),
          codigo_error = null
      where id = v_mensaje.id
      returning * into v_mensaje;

    return jsonb_build_object(
      'resultado', v_resultado,
      'mensaje_entrante_id', v_mensaje.id,
      'gasto_id', null::uuid,
      'respuesta', v_respuesta
    );
  end if;

  v_estado := case
    when p_monto is not null
      and p_fecha_gasto is not null
      and v_categoria_id is not null
      and p_descripcion is not null
      then 'pendiente_confirmacion'::public.estado_gasto
    else 'incompleto'::public.estado_gasto
  end;

  insert into public.gastos (
    usuario_id,
    fecha_gasto,
    monto,
    categoria_id,
    descripcion,
    metodo_pago,
    estado,
    origen,
    texto_original,
    mensaje_origen_id,
    confianza_extraccion
  )
  values (
    v_usuario.id,
    p_fecha_gasto,
    p_monto,
    v_categoria_id,
    p_descripcion,
    p_metodo_pago,
    v_estado,
    'texto',
    p_texto_original,
    p_mensaje_origen_id,
    p_confianza
  )
  returning * into v_gasto;

  if v_estado = 'pendiente_confirmacion' then
    v_resultado := 'propuesta';
    v_respuesta := 'Registré: $'
      || replace(to_char(p_monto, 'FM999G999G999G999'), ',', '.')
      || ' COP · '
      || p_categoria_nombre || ' · ' || p_descripcion || ' · '
      || extract(day from p_fecha_gasto)::integer::text || ' '
      || case extract(month from p_fecha_gasto)::integer
        when 1 then 'ene'
        when 2 then 'feb'
        when 3 then 'mar'
        when 4 then 'abr'
        when 5 then 'may'
        when 6 then 'jun'
        when 7 then 'jul'
        when 8 then 'ago'
        when 9 then 'sep'
        when 10 then 'oct'
        when 11 then 'nov'
        when 12 then 'dic'
      end
      || E'.\nResponde sí, no o corregir [dato].';
  else
    v_resultado := 'incompleto';
    v_respuesta := case
      when p_monto is null then '¿Cuál fue el monto del gasto?'
      when p_fecha_gasto is null then '¿Cuál fue la fecha del gasto?'
      when v_categoria_id is null then '¿Cuál es la categoría del gasto?'
      else '¿Cómo describirías el gasto?'
    end;
  end if;

  update public.mensajes_entrantes
    set estado_procesamiento = 'procesado',
        gasto_id = v_gasto.id,
        resultado_procesamiento = v_resultado,
        respuesta_texto = v_respuesta,
        procesado_en = statement_timestamp(),
        codigo_error = null
    where id = v_mensaje.id
    returning * into v_mensaje;

  return jsonb_build_object(
    'resultado', v_resultado,
    'mensaje_entrante_id', v_mensaje.id,
    'gasto_id', v_gasto.id,
    'respuesta', v_respuesta
  );
end;
$$;

create function public.reclamar_respuesta_mensaje(
  p_mensaje_entrante_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lease_token uuid;
  v_respuesta text;
  v_enviada_en timestamptz;
begin
  if p_mensaje_entrante_id is null then
    raise exception using
      errcode = '22023',
      message = 'Identificador de mensaje invalido';
  end if;

  update public.mensajes_entrantes
    set respuesta_reclamada_en = statement_timestamp(),
        respuesta_lease_token = extensions.gen_random_uuid()
    where id = p_mensaje_entrante_id
      and estado_procesamiento = 'procesado'
      and respuesta_texto is not null
      and respuesta_enviada_en is null
      and respuesta_reclamada_en is null
    returning respuesta_lease_token, respuesta_texto
      into v_lease_token, v_respuesta;

  if found then
    return jsonb_build_object(
      'estado', 'reclamado',
      'lease_token', v_lease_token,
      'respuesta', v_respuesta
    );
  end if;

  update public.mensajes_entrantes
    set respuesta_enviada_en = statement_timestamp(),
        respuesta_resultado = 'indeterminada'
    where id = p_mensaje_entrante_id
      and respuesta_texto is not null
      and respuesta_enviada_en is null
      and respuesta_reclamada_en
        < statement_timestamp() - interval '2 minutes';

  if found then
    return jsonb_build_object(
      'estado', 'finalizado',
      'lease_token', null::uuid,
      'respuesta', null::text
    );
  end if;

  select respuesta_texto, respuesta_enviada_en
    into v_respuesta, v_enviada_en
    from public.mensajes_entrantes
    where id = p_mensaje_entrante_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Mensaje entrante no encontrado';
  end if;

  if v_enviada_en is not null then
    return jsonb_build_object(
      'estado', 'finalizado',
      'lease_token', null::uuid,
      'respuesta', null::text
    );
  end if;

  if v_respuesta is null then
    return jsonb_build_object(
      'estado', 'sin_respuesta',
      'lease_token', null::uuid,
      'respuesta', null::text
    );
  end if;

  return jsonb_build_object(
    'estado', 'ocupado',
    'lease_token', null::uuid,
    'respuesta', null::text
  );
end;
$$;

create function public.finalizar_respuesta_mensaje(
  p_mensaje_entrante_id uuid,
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
  if p_mensaje_entrante_id is null
    or p_lease_token is null
    or p_resultado is null
    or p_resultado not in ('entregada', 'indeterminada', 'rechazada') then
    return false;
  end if;

  update public.mensajes_entrantes
    set respuesta_enviada_en = statement_timestamp(),
        respuesta_resultado = p_resultado
    where id = p_mensaje_entrante_id
      and estado_procesamiento = 'procesado'
      and respuesta_texto is not null
      and respuesta_reclamada_en is not null
      and respuesta_lease_token = p_lease_token
      and respuesta_enviada_en is null
    returning true into v_actualizado;

  return coalesce(v_actualizado, false);
end;
$$;

create function public.liberar_respuesta_mensaje(
  p_mensaje_entrante_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actualizado boolean;
begin
  if p_mensaje_entrante_id is null or p_lease_token is null then
    return false;
  end if;

  update public.mensajes_entrantes
    set respuesta_reclamada_en = null,
        respuesta_lease_token = null
    where id = p_mensaje_entrante_id
      and respuesta_lease_token = p_lease_token
      and respuesta_enviada_en is null
    returning true into v_actualizado;

  return coalesce(v_actualizado, false);
end;
$$;

create function public.cerrar_respuestas_huerfanas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actualizadas integer;
begin
  update public.mensajes_entrantes
    set respuesta_enviada_en = statement_timestamp(),
        respuesta_resultado = 'indeterminada'
    where respuesta_texto is not null
      and respuesta_enviada_en is null
      and respuesta_reclamada_en
        < statement_timestamp() - interval '2 minutes';

  get diagnostics v_actualizadas = row_count;
  return v_actualizadas;
end;
$$;

revoke execute on function public.procesar_mensaje_texto(
  text, text, text, text, text, timestamptz,
  bigint, date, text, text, text, numeric
) from public, anon, authenticated, service_role;
grant execute on function public.procesar_mensaje_texto(
  text, text, text, text, text, timestamptz,
  bigint, date, text, text, text, numeric
) to service_role;

revoke execute on function public.reclamar_respuesta_mensaje(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.finalizar_respuesta_mensaje(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.liberar_respuesta_mensaje(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.cerrar_respuestas_huerfanas()
  from public, anon, authenticated, service_role;

grant execute on function public.reclamar_respuesta_mensaje(uuid)
  to service_role;
grant execute on function public.finalizar_respuesta_mensaje(uuid, uuid, text)
  to service_role;
grant execute on function public.liberar_respuesta_mensaje(uuid, uuid)
  to service_role;

select cron.schedule(
  'moni-cerrar-respuestas-huerfanas',
  '* * * * *',
  'select public.cerrar_respuestas_huerfanas();'
);

comment on column public.mensajes_entrantes.respuesta_lease_token is
  'Token de fencing de un solo uso para impedir respuestas salientes duplicadas.';
