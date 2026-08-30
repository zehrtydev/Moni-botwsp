-- Keep the already-applied signup migration immutable and replace its trigger
-- implementation with SQL that is valid for both new and partial profiles.
create or replace function public.crear_usuario_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_name text := nullif(left(trim(new.raw_user_meta_data ->> 'nombre'), 100), '');
begin
  insert into public.usuarios (id, nombre)
  values (new.id, signup_name)
  on conflict (id) do nothing;

  update public.usuarios
  set nombre = signup_name
  where id = new.id
    and nombre is null
    and signup_name is not null;

  return new;
end;
$$;
