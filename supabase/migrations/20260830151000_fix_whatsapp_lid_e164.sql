alter table public.whatsapp_contactos_lid
  drop constraint if exists whatsapp_lid_numero_e164;

alter table public.whatsapp_contactos_lid
  add constraint whatsapp_lid_numero_e164
  check (numero_whatsapp ~ '^\+[1-9][0-9]{7,14}$');
