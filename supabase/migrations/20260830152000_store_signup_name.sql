create or replace function public.crear_usuario_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, nombre)
  values (
    new.id,
    nullif(left(trim(new.raw_user_meta_data ->> 'nombre'), 100), '')
  )
  on conflict (id) do update
    set nombre = coalesce(public.usuarios.nombre, excluded.nombre);

  return new;
end;
$$;
