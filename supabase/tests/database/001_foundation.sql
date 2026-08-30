begin;

select plan(21);

select has_table('public', 'usuarios', 'La tabla usuarios existe');
select has_table('public', 'categorias', 'La tabla categorias existe');
select has_table('public', 'gastos', 'La tabla gastos existe');
select has_table('public', 'mensajes_entrantes', 'La bandeja de entrada idempotente existe');

select has_index('public', 'gastos', 'gastos_un_gasto_activo_por_usuario', 'Impide más de un gasto activo por usuario');
select has_index('public', 'mensajes_entrantes', 'mensajes_entrantes_proveedor_instancia_origen_key', 'Deduplica mensajes por proveedor, instancia e identificador');

select row_eq(
  $$select count(*)::integer as total from public.categorias where activa$$,
  row(10::integer),
  'El catálogo inicial contiene las diez categorías activas del PRD'
);

insert into auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{"nombre":"Diana Caan"}'::jsonb
);

select results_eq(
  $$select id, nombre from public.usuarios where id = '00000000-0000-0000-0000-000000000001'::uuid$$,
  $$values ('00000000-0000-0000-0000-000000000001'::uuid, 'Diana Caan')$$,
  'El trigger crea el perfil y conserva el nombre de auth.users'
);

select lives_ok(
  $$update public.usuarios
    set numero_whatsapp = '+573001234567'
    where id = '00000000-0000-0000-0000-000000000001'::uuid$$,
  'Un número E.164 válido se acepta'
);

select lives_ok(
  $$insert into public.gastos (
      usuario_id, fecha_gasto, monto, categoria_id, descripcion, estado, origen, texto_original, mensaje_origen_id
    ) values (
      '00000000-0000-0000-0000-000000000001'::uuid,
      current_date,
      20000,
      (select id from public.categorias where nombre = 'Alimentación'),
      'hamburguesa',
      'pendiente_confirmacion',
      'texto',
      'Gasté 20 mil en una hamburguesa',
      'mensaje-para-probar-activo'
    )$$,
  'Se permite crear el primer gasto activo completo'
);

select throws_ok(
  $$insert into public.gastos (
      usuario_id, estado, origen, texto_original, mensaje_origen_id
    ) values (
      '00000000-0000-0000-0000-000000000001'::uuid,
      'incompleto',
      'texto',
      'Falta el monto',
      'mensaje-para-probar-segundo-activo'
    )$$,
  '23505',
  null,
  'El índice parcial rechaza un segundo gasto activo'
);

select has_table(
  'public',
  'auditoria_cambios_numero',
  'La bitácora de cambios de número existe'
);

select has_function(
  'public',
  'transicionar_gasto',
  'Las transiciones pasan por una función de servidor'
);

select throws_ok(
  $$select public.transicionar_gasto(
      (select id from public.gastos where mensaje_origen_id = 'mensaje-para-probar-activo'),
      '00000000-0000-0000-0000-000000000099'::uuid,
      'confirmado'::public.estado_gasto,
      '{}'::jsonb
    )$$,
  '42501',
  'El actor no es propietario del gasto',
  'El worker no puede transicionar un gasto para otro usuario'
);

select lives_ok(
  $$select public.transicionar_gasto(
      (select id from public.gastos where mensaje_origen_id = 'mensaje-para-probar-activo'),
      '00000000-0000-0000-0000-000000000001'::uuid,
      'confirmado'::public.estado_gasto,
      '{}'::jsonb
    )$$,
  'Un gasto pendiente completo puede confirmarse'
);

select results_eq(
  $$select estado::text from public.gastos where mensaje_origen_id = 'mensaje-para-probar-activo'$$,
  $$values ('confirmado'::text)$$,
  'La confirmación persiste el estado terminal'
);

select throws_ok(
  $$select public.transicionar_gasto(
      (select id from public.gastos where mensaje_origen_id = 'mensaje-para-probar-activo'),
      '00000000-0000-0000-0000-000000000001'::uuid,
      'incompleto'::public.estado_gasto,
      '{}'::jsonb
    )$$,
  '22023',
  'No se puede transicionar un gasto terminal',
  'Un gasto confirmado no puede volver a estar activo'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'gastos'
      and cmd = 'SELECT'
      and qual like '%auth.uid()%'
  ),
  'La lectura de gastos está acotada por auth.uid()'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'gastos'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ),
  'El cliente autenticado no puede mutar gastos directamente'
);

select has_function('public', 'crear_usuario_desde_auth', 'El trigger de Auth usa una función dedicada');
select has_trigger('auth', 'users', 'on_auth_user_created', 'auth.users crea el perfil público');

select * from finish();
rollback;
