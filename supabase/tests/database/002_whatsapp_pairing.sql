begin;

select plan(37);

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
  ('00000000-0000-0000-0000-000000000051', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb);

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

select * from finish();
rollback;
