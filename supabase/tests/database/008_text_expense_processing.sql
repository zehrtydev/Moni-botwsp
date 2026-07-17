begin;

select plan(65);

select has_function(
  'public',
  'procesar_mensaje_texto',
  array[
    'text', 'text', 'text', 'text', 'text', 'timestamp with time zone',
    'bigint', 'date', 'text', 'text', 'text', 'numeric'
  ],
  'El procesamiento de texto es una RPC tipada'
);

select has_function(
  'public',
  'reclamar_respuesta_mensaje',
  array['uuid'],
  'La respuesta se reclama atomicamente por RPC'
);

select has_function(
  'public',
  'finalizar_respuesta_mensaje',
  array['uuid', 'uuid', 'text'],
  'Finalizar la respuesta exige un token de fencing'
);

select has_function(
  'public',
  'liberar_respuesta_mensaje',
  array['uuid', 'uuid'],
  'Una entrega rechazada puede liberar su reclamacion'
);

select has_function(
  'public',
  'cerrar_respuestas_huerfanas',
  array[]::text[],
  'Existe una limpieza durable de claims huerfanos'
);

select ok(
  (
    select bool_and(p.prosecdef)
      and bool_and(coalesce(p.proconfig, array[]::text[]) @> array['search_path=""'])
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'procesar_mensaje_texto',
        'reclamar_respuesta_mensaje',
        'finalizar_respuesta_mensaje',
        'liberar_respuesta_mensaje',
        'cerrar_respuestas_huerfanas'
      )
  ),
  'Las RPC privilegiadas fijan search_path vacio'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.procesar_mensaje_texto(text,text,text,text,text,timestamptz,bigint,date,text,text,text,numeric)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'authenticated',
      'public.procesar_mensaje_texto(text,text,text,text,text,timestamptz,bigint,date,text,text,text,numeric)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.procesar_mensaje_texto(text,text,text,text,text,timestamptz,bigint,date,text,text,text,numeric)',
      'EXECUTE'
    ),
  'Solo service_role procesa mensajes'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.reclamar_respuesta_mensaje(uuid)',
    'EXECUTE'
  )
    and has_function_privilege(
      'service_role',
      'public.finalizar_respuesta_mensaje(uuid,uuid,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.liberar_respuesta_mensaje(uuid,uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.reclamar_respuesta_mensaje(uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.finalizar_respuesta_mensaje(uuid,uuid,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.liberar_respuesta_mensaje(uuid,uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.reclamar_respuesta_mensaje(uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.finalizar_respuesta_mensaje(uuid,uuid,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.liberar_respuesta_mensaje(uuid,uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.cerrar_respuestas_huerfanas()',
      'EXECUTE'
    ),
  'Solo service_role controla la entrega saliente'
);

select results_eq(
  $$select schedule, command
    from cron.job
    where jobname = 'moni-cerrar-respuestas-huerfanas'$$,
  $$values ('* * * * *'::text, 'select public.cerrar_respuestas_huerfanas();'::text)$$,
  'Cron ejecuta la limpieza de claims cada minuto'
);

insert into auth.users (
  id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000081',
  'authenticated',
  'authenticated',
  '573108880281',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb
);

update public.usuarios
set numero_whatsapp = '+573108880281'
where id = '00000000-0000-0000-0000-000000000081'::uuid;

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-text-1', '+573108880281', 'texto',
    '2026-07-17T15:14:09Z'::timestamptz
  ),
  'insertado',
  'El inbox recibe el mensaje antes de procesarlo'
);

select throws_ok(
  $$select public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-text-1', '+573108880281',
    'Almuerzo 35000', null,
    35000, '2026-07-17'::date, 'Alimentación', 'Almuerzo', null, 0.90
  )$$,
  '22023',
  'Los metadatos del mensaje no coinciden',
  'Los metadatos obligatorios no aceptan null'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-text-1', '+573108880281',
    'Almuerzo 35000', '2026-07-17T15:14:09Z'::timestamptz,
    35000, '2026-07-17'::date, 'Alimentación', 'Almuerzo', null, 0.90
  ) ->> 'resultado',
  'propuesta',
  'Un mensaje completo genera una propuesta'
);

reset role;

select results_eq(
  $$select g.usuario_id, g.monto, g.fecha_gasto, c.nombre, g.descripcion,
      g.estado::text, g.origen::text, g.texto_original, g.confirmado_en
    from public.gastos as g
    join public.categorias as c on c.id = g.categoria_id
    where g.mensaje_origen_id = 'expense-text-1'$$,
  $$values (
    '00000000-0000-0000-0000-000000000081'::uuid,
    35000::bigint,
    '2026-07-17'::date,
    'Alimentación'::text,
    'Almuerzo'::text,
    'pendiente_confirmacion'::text,
    'texto'::text,
    'Almuerzo 35000'::text,
    null::timestamptz
  )$$,
  'La propuesta pertenece al usuario y aun no esta confirmada'
);

select results_eq(
  $$select estado_procesamiento, gasto_id is not null, procesado_en is not null,
      respuesta_texto is not null, respuesta_reclamada_en, respuesta_lease_token,
      respuesta_enviada_en, respuesta_resultado
    from public.mensajes_entrantes
    where mensaje_origen_id = 'expense-text-1'$$,
  $$values (
    'procesado'::text, true, true, true, null::timestamptz, null::uuid,
    null::timestamptz, null::text
  )$$,
  'El inbox conserva la respuesta pendiente de entrega'
);

select is(
  (
    select respuesta_texto
    from public.mensajes_entrantes
    where mensaje_origen_id = 'expense-text-1'
  ),
  E'Registré: $35.000 COP · Alimentación · Almuerzo · 17 jul.\nResponde sí, no o corregir [dato].',
  'La propuesta usa el formato conversacional del PRD'
);

set local role service_role;

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-text-1', '+573108880281',
    'Almuerzo 35000', '2026-07-17T15:14:09Z'::timestamptz,
    35000, '2026-07-17'::date, 'Alimentación', 'Almuerzo', null, 0.90
  ) ->> 'resultado',
  'propuesta',
  'Un reintento conserva el resultado ya procesado'
);

create temp table respuesta_fencing_test (
  inbox_id uuid primary key,
  token_a uuid,
  token_b uuid,
  respuesta text
);

insert into respuesta_fencing_test (inbox_id, respuesta)
select (resultado ->> 'mensaje_entrante_id')::uuid,
  resultado ->> 'respuesta'
from (
  select public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-text-1', '+573108880281',
    'Almuerzo 35000', '2026-07-17T15:14:09Z'::timestamptz,
    35000, '2026-07-17'::date, 'Alimentación', 'Almuerzo', null, 0.90
  ) as resultado
) as procesado;

update respuesta_fencing_test
set token_a = (
  public.reclamar_respuesta_mensaje(inbox_id) ->> 'lease_token'
)::uuid;

select ok(
  (
    select token_a is not null
      and respuesta = E'Registré: $35.000 COP · Alimentación · Almuerzo · 17 jul.\nResponde sí, no o corregir [dato].'
    from respuesta_fencing_test
  ),
  'La primera reclamacion obtiene token y respuesta'
);

select is(
  public.reclamar_respuesta_mensaje(
    (select inbox_id from respuesta_fencing_test)
  ) ->> 'estado',
  'ocupado',
  'Una segunda reclamacion no puede enviar en paralelo'
);

select is(
  public.liberar_respuesta_mensaje(
    (select inbox_id from respuesta_fencing_test),
    extensions.gen_random_uuid()
  ),
  false,
  'Un token ajeno no puede liberar la reclamacion'
);

select is(
  public.liberar_respuesta_mensaje(
    (select inbox_id from respuesta_fencing_test),
    (select token_a from respuesta_fencing_test)
  ),
  true,
  'El worker vigente libera un envio rechazado'
);

update respuesta_fencing_test
set token_b = (
  public.reclamar_respuesta_mensaje(inbox_id) ->> 'lease_token'
)::uuid;

select ok(
  (select token_b is not null and token_b <> token_a from respuesta_fencing_test),
  'Una nueva reclamacion recibe un token diferente'
);

select is(
  public.finalizar_respuesta_mensaje(
    (select inbox_id from respuesta_fencing_test),
    (select token_a from respuesta_fencing_test),
    'entregada'
  ),
  false,
  'Un token vencido no puede finalizar el envio actual'
);

select is(
  public.finalizar_respuesta_mensaje(
    (select inbox_id from respuesta_fencing_test),
    (select token_b from respuesta_fencing_test),
    'entregada'
  ),
  true,
  'El worker vigente finaliza la entrega'
);

select is(
  public.reclamar_respuesta_mensaje(
    (select inbox_id from respuesta_fencing_test)
  ) ->> 'estado',
  'finalizado',
  'Una respuesta finalizada nunca se vuelve a enviar'
);

reset role;

select results_eq(
  $$select count(*)::integer from public.gastos where mensaje_origen_id = 'expense-text-1'$$,
  $$values (1)$$,
  'Los reintentos no duplican el gasto'
);

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-unlinked', '+573108880299', 'texto', now()
  ),
  'insertado',
  'Registra un mensaje de numero no vinculado'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-unlinked', '+573108880299',
    'Cena 20000', now(), 20000, current_date, 'Alimentación', 'Cena', null, 0.80
  ) ->> 'resultado',
  'no_vinculado',
  'Un numero no vinculado no crea gasto'
);

reset role;

select results_eq(
  $$select count(*)::integer from public.gastos where mensaje_origen_id = 'expense-unlinked'$$,
  $$values (0)$$,
  'El numero no vinculado solo recibe orientacion'
);

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-active-2', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra un segundo mensaje del mismo usuario'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-active-2', '+573108880281',
    'Taxi 12000', now(), 12000, current_date, 'Transporte', 'Taxi', null, 0.85
  ) ->> 'resultado',
  'gasto_activo',
  'No inicia otro gasto mientras existe uno activo'
);

reset role;

select results_eq(
  $$select count(*)::integer
    from public.gastos
    where usuario_id = '00000000-0000-0000-0000-000000000081'::uuid
      and estado in ('incompleto', 'pendiente_confirmacion')$$,
  $$values (1)$$,
  'La concurrencia conversacional mantiene un unico gasto activo'
);

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-confirm-1', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra la confirmacion del usuario'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-confirm-1', '+573108880281',
    'sí', now(), null, current_date, 'Otros', 'sí', null, 0.60
  ) ->> 'resultado',
  'confirmado',
  'Si confirma el gasto pendiente'
);

reset role;

select results_eq(
  $$select estado::text, confirmado_en is not null
    from public.gastos
    where mensaje_origen_id = 'expense-text-1'$$,
  $$values ('confirmado'::text, true)$$,
  'La confirmacion deja el gasto terminal y visible para el dashboard'
);

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-confirm-repeat', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra una confirmacion repetida'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-confirm-repeat', '+573108880281',
    'sí', now(), null, current_date, 'Otros', 'sí', null, 0.60
  ) ->> 'resultado',
  'sin_gasto_activo',
  'Una confirmacion sin gasto activo no crea un borrador'
);

create temp table respuesta_huerfana_test (
  inbox_id uuid primary key,
  lease_token uuid
);

insert into respuesta_huerfana_test (inbox_id)
select (
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-confirm-repeat', '+573108880281',
    'sí', now(), null, current_date, 'Otros', 'sí', null, 0.60
  ) ->> 'mensaje_entrante_id'
)::uuid;

update respuesta_huerfana_test
set lease_token = (
  public.reclamar_respuesta_mensaje(inbox_id) ->> 'lease_token'
)::uuid;

select ok(
  (select lease_token is not null from respuesta_huerfana_test),
  'Una respuesta puede quedar reclamada por un worker'
);

reset role;

update public.mensajes_entrantes
set respuesta_reclamada_en = statement_timestamp() - interval '3 minutes'
where id = (select inbox_id from respuesta_huerfana_test);

select is(
  public.cerrar_respuestas_huerfanas(),
  1,
  'La limpieza durable terminaliza el claim vencido'
);

set local role service_role;

select is(
  public.reclamar_respuesta_mensaje(
    (select inbox_id from respuesta_huerfana_test)
  ) ->> 'estado',
  'finalizado',
  'Un claim huerfano se cierra como indeterminado sin reenviar'
);

reset role;

select results_eq(
  $$select respuesta_resultado, respuesta_enviada_en is not null
    from public.mensajes_entrantes
    where mensaje_origen_id = 'expense-confirm-repeat'$$,
  $$values ('indeterminada'::text, true)$$,
  'La recuperacion del claim queda observable y terminal'
);

select results_eq(
  $$select count(*)::integer
    from public.gastos
    where usuario_id = '00000000-0000-0000-0000-000000000081'::uuid
      and estado in ('incompleto', 'pendiente_confirmacion')$$,
  $$values (0)$$,
  'Un doble si no bloquea la siguiente conversacion'
);

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-reject-base', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra otro gasto para probar rechazo'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-reject-base', '+573108880281',
    'Taxi 12000', now(), 12000, current_date, 'Transporte', 'Taxi', null, 0.85
  ) ->> 'resultado',
  'propuesta',
  'El usuario puede iniciar otro gasto tras confirmar'
);

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-reject-1', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra el rechazo del usuario'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-reject-1', '+573108880281',
    'no', now(), null, current_date, 'Otros', 'no', null, 0.60
  ) ->> 'resultado',
  'rechazado',
  'No rechaza el gasto pendiente'
);

reset role;

select results_eq(
  $$select estado::text, confirmado_en
    from public.gastos
    where mensaje_origen_id = 'expense-reject-base'$$,
  $$values ('rechazado'::text, null::timestamptz)$$,
  'El rechazo deja el gasto terminal sin confirmacion'
);

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-incomplete-base', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra un gasto sin monto'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-incomplete-base', '+573108880281',
    'Almuerzo', now(), null, current_date, 'Alimentación', 'Almuerzo', null, 0.60
  ) ->> 'resultado',
  'incompleto',
  'Un gasto sin monto solicita el dato faltante'
);

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-incomplete-value', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra la respuesta con el monto faltante'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-incomplete-value', '+573108880281',
    '48000', now(), 48000, current_date, 'Otros', null, null, 0.75
  ) ->> 'resultado',
  'propuesta',
  'El dato faltante completa el mismo gasto'
);

reset role;

select results_eq(
  $$select monto, estado::text
    from public.gastos
    where mensaje_origen_id = 'expense-incomplete-base'$$,
  $$values (48000::bigint, 'pendiente_confirmacion'::text)$$,
  'El gasto incompleto se actualiza sin crear otro gasto'
);

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-incomplete-confirm', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra la confirmacion del gasto completado'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-incomplete-confirm', '+573108880281',
    'confirmar', now(), null, current_date, 'Otros', 'confirmar', null, 0.60
  ) ->> 'resultado',
  'confirmado',
  'El gasto completado puede confirmarse'
);

reset role;

select results_eq(
  $$select estado::text, confirmado_en is not null
    from public.gastos
    where mensaje_origen_id = 'expense-incomplete-base'$$,
  $$values ('confirmado'::text, true)$$,
  'El gasto completado queda visible en el dashboard'
);

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-correct-base', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra un gasto para corregir'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-correct-base', '+573108880281',
    'Taxi 12000', now(), 12000, current_date, 'Transporte', 'Taxi', null, 0.85
  ) ->> 'resultado',
  'propuesta',
  'El gasto a corregir queda pendiente'
);

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-correct-amount', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra la correccion de monto'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-correct-amount', '+573108880281',
    'corregir 25000', now(), 25000, current_date, 'Otros', 'corregir', null, 0.80
  ) ->> 'resultado',
  'propuesta',
  'Corregir monto actualiza y vuelve a pedir confirmacion'
);

reset role;

select results_eq(
  $$select monto, estado::text
    from public.gastos
    where mensaje_origen_id = 'expense-correct-base'$$,
  $$values (25000::bigint, 'pendiente_confirmacion'::text)$$,
  'La correccion actualiza el borrador existente'
);

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-correct-confirm', '+573108880281', 'texto', now()
  ),
  'insertado',
  'Registra la confirmacion posterior a corregir'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-correct-confirm', '+573108880281',
    'sí', now(), null, current_date, 'Otros', 'sí', null, 0.60
  ) ->> 'resultado',
  'confirmado',
  'La propuesta corregida exige y acepta nueva confirmacion'
);

reset role;

select results_eq(
  $$select monto, estado::text, confirmado_en is not null
    from public.gastos
    where mensaje_origen_id = 'expense-correct-base'$$,
  $$values (25000::bigint, 'confirmado'::text, true)$$,
  'La correccion confirmada conserva el monto nuevo'
);

insert into public.mensajes_entrantes (
  proveedor, instancia, mensaje_origen_id, numero_whatsapp, tipo, recibido_en
)
select 'evolution', 'moni', 'expense-rate-' || serie::text,
  '+573108880298', 'texto', statement_timestamp()
from generate_series(1, 30) as serie;

set local role service_role;

select is(
  public.registrar_mensaje_entrante(
    'evolution', 'moni', 'expense-rate-limited', '+573108880298', 'texto', now()
  ),
  'insertado',
  'El inbox conserva el mensaje que supera la cuota'
);

select is(
  public.procesar_mensaje_texto(
    'evolution', 'moni', 'expense-rate-limited', '+573108880298',
    'Cena 20000', now(), 20000, current_date, 'Alimentación', 'Cena', null, 0.80
  ) ->> 'resultado',
  'limitado',
  'La cuota por numero detiene el procesamiento abusivo'
);

reset role;

select results_eq(
  $$select count(*)::integer,
      count(*) filter (where respuesta_texto is not null)::integer
    from public.mensajes_entrantes
    where mensaje_origen_id = 'expense-rate-limited'$$,
  $$values (1, 0)$$,
  'Un mensaje limitado no crea respuesta saliente'
);

select * from finish();
rollback;
