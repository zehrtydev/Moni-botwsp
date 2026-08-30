-- Catálogo oficial de categorías de Moni. Las categorías existentes se conservan.
insert into public.categorias (nombre, activa)
values
  ('Vivienda', true),
  ('Cuidado personal', true),
  ('Viajes', true),
  ('Mascotas', true),
  ('Familia y regalos', true)
on conflict (nombre) do update set activa = excluded.activa;
