begin;

select plan(66);

create temporary table pairing_test_results (
  case_name text primary key,
  result jsonb
);

create temporary table pairing_test_snapshots (
  case_name text primary key,
  payload jsonb
);

insert into auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000020', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000030', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000040', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000041', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000050', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000051', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000060', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000061', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000062', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000063', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000064', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000065', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000066', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000010'::uuid),
  null::text,
  'El usuario válido empieza sin número de WhatsApp'
);

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000010',
  '+573001110001',
  repeat('a', 64),
  statement_timestamp() + interval '15 minutes'
);

select ok(
  exists (
    select 1
    from public.whatsapp_vinculaciones_pendientes
    where usuario_id = '00000000-0000-0000-0000-000000000010'::uuid
      and usado_en is null
      and expira_en > statement_timestamp()
  ),
  'Existe un pairing pendiente vigente para el caso válido'
);

select lives_ok(
  $$insert into pairing_test_results (case_name, result)
    values (
      'valid',
      public.completar_vinculacion_whatsapp(
        repeat('a', 64),
        'instance-valid',
        '11111@lid'
      )
    )$$,
  'La RPC completa un pairing válido'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000010'::uuid),
  '+573001110001',
  'El pairing válido asigna el número correcto al usuario'
);

select ok(
  exists (
    select 1
    from public.whatsapp_contactos_lid
    where instancia = 'instance-valid'
      and lid = '11111@lid'
      and numero_whatsapp = '+573001110001'
  ),
  'El pairing válido crea el mapping LID'
);

select ok(
  exists (
    select 1
    from public.whatsapp_vinculaciones_pendientes
    where codigo_hash = repeat('a', 64)
      and usado_en is not null
  ),
  'El pairing válido queda marcado como usado'
);

select is(
  (select result ->> 'usuario_id' from pairing_test_results where case_name = 'valid'),
  '00000000-0000-0000-0000-000000000010',
  'La RPC devuelve el usuario vinculado'
);

select is(
  (select result ->> 'numero_whatsapp' from pairing_test_results where case_name = 'valid'),
  '+573001110001',
  'La RPC devuelve el número vinculado'
);

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000020',
  '+573001110002',
  repeat('b', 64),
  statement_timestamp() - interval '1 minute'
);

insert into pairing_test_snapshots (case_name, payload)
select 'expired', to_jsonb(pairing)
from public.whatsapp_vinculaciones_pendientes as pairing
where codigo_hash = repeat('b', 64);

select lives_ok(
  $$insert into pairing_test_results (case_name, result)
    values (
      'expired',
      public.completar_vinculacion_whatsapp(
        repeat('b', 64),
        'instance-expired',
        '22222@lid'
      )
    )$$,
  'La RPC ignora sin error un pairing expirado'
);

select is(
  (select result from pairing_test_results where case_name = 'expired'),
  null::jsonb,
  'Un pairing expirado devuelve NULL'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000020'::uuid),
  null::text,
  'Un pairing expirado no cambia el número del usuario'
);

select ok(
  not exists (
    select 1
    from public.whatsapp_contactos_lid
    where instancia = 'instance-expired'
      and lid = '22222@lid'
  ),
  'Un pairing expirado no crea mapping LID'
);

select is(
  (select to_jsonb(pairing) from public.whatsapp_vinculaciones_pendientes as pairing where codigo_hash = repeat('b', 64)),
  (select payload from pairing_test_snapshots where case_name = 'expired'),
  'Un pairing expirado no se consume ni modifica'
);

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en, usado_en
) values (
  '00000000-0000-0000-0000-000000000030',
  '+573001110003',
  repeat('c', 64),
  statement_timestamp() + interval '15 minutes',
  statement_timestamp() - interval '1 minute'
);

insert into pairing_test_snapshots (case_name, payload)
select 'used', to_jsonb(pairing)
from public.whatsapp_vinculaciones_pendientes as pairing
where codigo_hash = repeat('c', 64);

select lives_ok(
  $$insert into pairing_test_results (case_name, result)
    values (
      'used',
      public.completar_vinculacion_whatsapp(
        repeat('c', 64),
        'instance-used',
        '33333@lid'
      )
    )$$,
  'La RPC ignora sin error un pairing ya usado'
);

select is(
  (select result from pairing_test_results where case_name = 'used'),
  null::jsonb,
  'Un pairing ya usado devuelve NULL'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000030'::uuid),
  null::text,
  'Un pairing ya usado no cambia el número del usuario'
);

select ok(
  not exists (
    select 1
    from public.whatsapp_contactos_lid
    where instancia = 'instance-used'
      and lid = '33333@lid'
  ),
  'Un pairing ya usado no crea mapping LID'
);

select is(
  (select to_jsonb(pairing) from public.whatsapp_vinculaciones_pendientes as pairing where codigo_hash = repeat('c', 64)),
  (select payload from pairing_test_snapshots where case_name = 'used'),
  'Un pairing ya usado no se modifica'
);

update public.usuarios
set numero_whatsapp = '+573001110004'
where id = '00000000-0000-0000-0000-000000000041'::uuid;

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000040',
  '+573001110004',
  repeat('d', 64),
  statement_timestamp() + interval '15 minutes'
);

insert into public.whatsapp_contactos_lid (instancia, lid, numero_whatsapp)
values ('instance-conflict', '44444@lid', '+573001119999');

insert into pairing_test_snapshots (case_name, payload)
select 'conflict-mapping', to_jsonb(contact)
from public.whatsapp_contactos_lid as contact
where instancia = 'instance-conflict' and lid = '44444@lid';

insert into pairing_test_snapshots (case_name, payload)
select 'conflict-pairing', to_jsonb(pairing)
from public.whatsapp_vinculaciones_pendientes as pairing
where codigo_hash = repeat('d', 64);

select throws_ok(
  $$select public.completar_vinculacion_whatsapp(
      repeat('d', 64),
      'instance-conflict',
      '44444@lid'
    )$$,
  '23505',
  'WHATSAPP_NUMBER_ALREADY_LINKED',
  'La RPC falla de forma controlada si otro usuario posee el número'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000040'::uuid),
  null::text,
  'El conflicto no asigna el número al solicitante'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000041'::uuid),
  '+573001110004',
  'El conflicto conserva el propietario original'
);

select is(
  (select to_jsonb(contact) from public.whatsapp_contactos_lid as contact where instancia = 'instance-conflict' and lid = '44444@lid'),
  (select payload from pairing_test_snapshots where case_name = 'conflict-mapping'),
  'El rollback del conflicto no crea ni cambia el mapping'
);

select is(
  (select to_jsonb(pairing) from public.whatsapp_vinculaciones_pendientes as pairing where codigo_hash = repeat('d', 64)),
  (select payload from pairing_test_snapshots where case_name = 'conflict-pairing'),
  'El rollback del conflicto deja el pairing sin consumir'
);

insert into pairing_test_snapshots (case_name, payload)
select 'reuse-user', to_jsonb(app_user)
from public.usuarios as app_user
where id = '00000000-0000-0000-0000-000000000010'::uuid;

insert into pairing_test_snapshots (case_name, payload)
select 'reuse-mapping', to_jsonb(contact)
from public.whatsapp_contactos_lid as contact
where instancia = 'instance-valid' and lid = '11111@lid';

insert into pairing_test_snapshots (case_name, payload)
select 'reuse-pairing', to_jsonb(pairing)
from public.whatsapp_vinculaciones_pendientes as pairing
where codigo_hash = repeat('a', 64);

select lives_ok(
  $$insert into pairing_test_results (case_name, result)
    values (
      'reuse',
      public.completar_vinculacion_whatsapp(
        repeat('a', 64),
        'instance-reuse',
        '99999@lid'
      )
    )$$,
  'Reutilizar el hash consumido no produce error'
);

select is(
  (select result from pairing_test_results where case_name = 'reuse'),
  null::jsonb,
  'Reutilizar el hash consumido devuelve NULL'
);

select is(
  (select to_jsonb(app_user) from public.usuarios as app_user where id = '00000000-0000-0000-0000-000000000010'::uuid),
  (select payload from pairing_test_snapshots where case_name = 'reuse-user'),
  'Reutilizar el hash no cambia el usuario'
);

select is(
  (select to_jsonb(contact) from public.whatsapp_contactos_lid as contact where instancia = 'instance-valid' and lid = '11111@lid'),
  (select payload from pairing_test_snapshots where case_name = 'reuse-mapping'),
  'Reutilizar el hash no cambia el mapping existente'
);

select is(
  (select to_jsonb(pairing) from public.whatsapp_vinculaciones_pendientes as pairing where codigo_hash = repeat('a', 64)),
  (select payload from pairing_test_snapshots where case_name = 'reuse-pairing'),
  'Reutilizar el hash no cambia el pairing consumido'
);

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000050',
  '+573001110005',
  repeat('e', 64),
  statement_timestamp() + interval '15 minutes'
);

select lives_ok(
  $$select public.completar_vinculacion_whatsapp(
      repeat('e', 64),
      'instance-lifecycle-old',
      '55551@lid'
    )$$,
  'El usuario A puede completar la vinculación inicial con N1'
);

insert into public.whatsapp_contactos_lid (instancia, lid, numero_whatsapp)
values ('instance-lifecycle-extra', '55552@lid', '+573001110005');

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000050',
  '+573001110006',
  repeat('f', 64),
  statement_timestamp() + interval '15 minutes'
);

select lives_ok(
  $$select public.completar_vinculacion_whatsapp(
      repeat('f', 64),
      'instance-lifecycle-new',
      '55553@lid'
    )$$,
  'El usuario A puede cambiar de N1 a N2'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000050'::uuid),
  '+573001110006',
  'El cambio deja N2 como número actual de A'
);

select is(
  (select count(*)::integer from public.whatsapp_contactos_lid where numero_whatsapp = '+573001110005'),
  0,
  'El cambio elimina todos los mappings del antiguo N1'
);

select ok(
  exists (
    select 1
    from public.whatsapp_contactos_lid
    where instancia = 'instance-lifecycle-new'
      and lid = '55553@lid'
      and numero_whatsapp = '+573001110006'
  ),
  'El cambio conserva el mapping nuevo hacia N2'
);

insert into public.whatsapp_contactos_lid (instancia, lid, numero_whatsapp)
values ('instance-lifecycle-stale', '55554@lid', '+573001110005');

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000051',
  '+573001110005',
  repeat('1', 64),
  statement_timestamp() + interval '15 minutes'
);

select lives_ok(
  $$select public.completar_vinculacion_whatsapp(
      repeat('1', 64),
      'instance-lifecycle-owner',
      '55555@lid'
    )$$,
  'El usuario B puede verificar N1 después de que A lo libera'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000051'::uuid),
  '+573001110005',
  'N1 queda asignado al nuevo propietario B'
);

select ok(
  exists (
    select 1
    from public.whatsapp_contactos_lid
    where instancia = 'instance-lifecycle-owner'
      and lid = '55555@lid'
      and numero_whatsapp = '+573001110005'
  ),
  'La vinculación de B crea únicamente su mapping actual'
);

select is(
  (
    select count(*)::integer
    from public.whatsapp_contactos_lid
    where numero_whatsapp = '+573001110005'
      and (instancia, lid) <> ('instance-lifecycle-owner', '55555@lid')
  ),
  0,
  'Al reasignar N1 no queda ningún mapping obsoleto del propietario anterior'
);

select throws_ok(
  $$select public.completar_vinculacion_whatsapp_por_numero('invalid', '+573001110007')$$,
  '22023',
  'Invalid WhatsApp pairing input',
  'La RPC por número rechaza hashes que no sean SHA-256 hexadecimal'
);

select throws_ok(
  $$select public.completar_vinculacion_whatsapp_por_numero(repeat('2', 64), '573001110007')$$,
  '22023',
  'Invalid WhatsApp pairing input',
  'La RPC por número rechaza números que no estén en formato E.164'
);

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000060',
  '+573001110007',
  repeat('2', 64),
  statement_timestamp() + interval '15 minutes'
);

select lives_ok(
  $$insert into pairing_test_results (case_name, result)
    values (
      'number-valid',
      public.completar_vinculacion_whatsapp_por_numero(
        repeat('2', 64),
        '+573001110007'
      )
    )$$,
  'La RPC por número completa un pairing válido'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000060'::uuid),
  '+573001110007',
  'El pairing por número asigna el número correcto al usuario'
);

select ok(
  exists (
    select 1
    from public.whatsapp_vinculaciones_pendientes
    where codigo_hash = repeat('2', 64)
      and usado_en is not null
  ),
  'El pairing por número queda marcado como usado'
);

select is(
  (select result from pairing_test_results where case_name = 'number-valid'),
  jsonb_build_object(
    'usuario_id', '00000000-0000-0000-0000-000000000060'::uuid,
    'numero_whatsapp', '+573001110007'
  ),
  'La RPC por número devuelve el usuario y número vinculados'
);

select is(
  (select count(*)::integer from public.whatsapp_contactos_lid where numero_whatsapp = '+573001110007'),
  0,
  'El pairing por número no crea un mapping LID'
);

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000061',
  '+573001110008',
  repeat('3', 64),
  statement_timestamp() - interval '1 minute'
);

insert into pairing_test_snapshots (case_name, payload)
select 'number-expired', to_jsonb(pairing)
from public.whatsapp_vinculaciones_pendientes as pairing
where codigo_hash = repeat('3', 64);

select is(
  public.completar_vinculacion_whatsapp_por_numero(repeat('3', 64), '+573001110008'),
  null::jsonb,
  'La RPC por número devuelve NULL para un pairing expirado'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000061'::uuid),
  null::text,
  'Un pairing por número expirado no cambia el usuario'
);

select is(
  (select to_jsonb(pairing) from public.whatsapp_vinculaciones_pendientes as pairing where codigo_hash = repeat('3', 64)),
  (select payload from pairing_test_snapshots where case_name = 'number-expired'),
  'Un pairing por número expirado no se consume ni modifica'
);

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en, usado_en
) values (
  '00000000-0000-0000-0000-000000000062',
  '+573001110009',
  repeat('4', 64),
  statement_timestamp() + interval '15 minutes',
  statement_timestamp() - interval '1 minute'
);

insert into pairing_test_snapshots (case_name, payload)
select 'number-used', to_jsonb(pairing)
from public.whatsapp_vinculaciones_pendientes as pairing
where codigo_hash = repeat('4', 64);

select is(
  public.completar_vinculacion_whatsapp_por_numero(repeat('4', 64), '+573001110009'),
  null::jsonb,
  'La RPC por número devuelve NULL para un pairing usado'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000062'::uuid),
  null::text,
  'Un pairing por número usado no cambia el usuario'
);

select is(
  (select to_jsonb(pairing) from public.whatsapp_vinculaciones_pendientes as pairing where codigo_hash = repeat('4', 64)),
  (select payload from pairing_test_snapshots where case_name = 'number-used'),
  'Un pairing por número usado no se modifica'
);

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000063',
  '+573001110010',
  repeat('5', 64),
  statement_timestamp() + interval '15 minutes'
);

insert into pairing_test_snapshots (case_name, payload)
select 'number-mismatch', to_jsonb(pairing)
from public.whatsapp_vinculaciones_pendientes as pairing
where codigo_hash = repeat('5', 64);

select is(
  public.completar_vinculacion_whatsapp_por_numero(repeat('5', 64), '+573001110011'),
  null::jsonb,
  'Un hash válido enviado desde otro número devuelve NULL'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000063'::uuid),
  null::text,
  'El intento desde otro número no cambia al dueño del pairing'
);

select is(
  (select numero_whatsapp from public.usuarios where numero_whatsapp = '+573001110011'),
  null::text,
  'El intento desde otro número no asigna el pairing al remitente'
);

select is(
  (select to_jsonb(pairing) from public.whatsapp_vinculaciones_pendientes as pairing where codigo_hash = repeat('5', 64)),
  (select payload from pairing_test_snapshots where case_name = 'number-mismatch'),
  'El intento desde otro número no consume ni modifica el pairing'
);

update public.usuarios
set numero_whatsapp = '+573001110012'
where id = '00000000-0000-0000-0000-000000000065'::uuid;

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000064',
  '+573001110012',
  repeat('6', 64),
  statement_timestamp() + interval '15 minutes'
);

insert into pairing_test_snapshots (case_name, payload)
select 'number-conflict', to_jsonb(pairing)
from public.whatsapp_vinculaciones_pendientes as pairing
where codigo_hash = repeat('6', 64);

select throws_ok(
  $$select public.completar_vinculacion_whatsapp_por_numero(
      repeat('6', 64),
      '+573001110012'
    )$$,
  '23505',
  'WHATSAPP_NUMBER_ALREADY_LINKED',
  'La RPC por número falla de forma controlada si otro usuario posee el número'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000064'::uuid),
  null::text,
  'El conflicto por número no cambia al solicitante'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000065'::uuid),
  '+573001110012',
  'El conflicto por número conserva el propietario original'
);

select is(
  (select to_jsonb(pairing) from public.whatsapp_vinculaciones_pendientes as pairing where codigo_hash = repeat('6', 64)),
  (select payload from pairing_test_snapshots where case_name = 'number-conflict'),
  'El rollback del conflicto por número deja el pairing sin consumir'
);

select is(
  public.completar_vinculacion_whatsapp_por_numero(repeat('2', 64), '+573001110007'),
  null::jsonb,
  'Reutilizar un hash consumido mediante la RPC por número devuelve NULL'
);

update public.usuarios
set numero_whatsapp = '+573001110013'
where id = '00000000-0000-0000-0000-000000000066'::uuid;

insert into public.whatsapp_contactos_lid (instancia, lid, numero_whatsapp)
values
  ('instance-number-lifecycle-one', '66661@lid', '+573001110013'),
  ('instance-number-lifecycle-two', '66662@lid', '+573001110013');

insert into public.whatsapp_vinculaciones_pendientes (
  usuario_id, numero_whatsapp, codigo_hash, expira_en
) values (
  '00000000-0000-0000-0000-000000000066',
  '+573001110014',
  repeat('7', 64),
  statement_timestamp() + interval '15 minutes'
);

select lives_ok(
  $$select public.completar_vinculacion_whatsapp_por_numero(
      repeat('7', 64),
      '+573001110014'
    )$$,
  'La RPC por número permite cambiar de N1 a N2'
);

select is(
  (select numero_whatsapp from public.usuarios where id = '00000000-0000-0000-0000-000000000066'::uuid),
  '+573001110014',
  'El cambio por número deja N2 como número actual'
);

select is(
  (select count(*)::integer from public.whatsapp_contactos_lid where numero_whatsapp = '+573001110013'),
  0,
  'El cambio por número elimina todos los mappings LID del antiguo N1'
);

select is(
  (select count(*)::integer from public.whatsapp_contactos_lid where numero_whatsapp = '+573001110014'),
  0,
  'La RPC por número no crea un mapping LID para N2'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.completar_vinculacion_whatsapp_por_numero(text,text)',
    'execute'
  ),
  'service_role puede ejecutar la RPC por número'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.completar_vinculacion_whatsapp_por_numero(text,text)',
    'execute'
  ),
  'anon no puede ejecutar la RPC por número'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.completar_vinculacion_whatsapp_por_numero(text,text)',
    'execute'
  ),
  'authenticated no puede ejecutar la RPC por número'
);

select * from finish();
rollback;
