-- Datos de referencia del MVP. Es idempotente para permitir `supabase db reset`.
insert into public.categorias (nombre, activa)
values
  ('Alimentación', true), ('Transporte', true), ('Vivienda', true), ('Hogar', true),
  ('Servicios', true), ('Compras', true), ('Salud', true), ('Cuidado personal', true),
  ('Educación', true), ('Ocio', true), ('Viajes', true), ('Deudas', true),
  ('Mascotas', true), ('Familia y regalos', true), ('Otros', true)
on conflict (nombre) do update set activa = excluded.activa;
