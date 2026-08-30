alter table public.whatsapp_vinculaciones_pendientes
  drop constraint if exists whatsapp_pairing_numero_e164;

alter table public.whatsapp_vinculaciones_pendientes
  add constraint whatsapp_pairing_numero_e164
  check (numero_whatsapp ~ '^\+[1-9][0-9]{7,14}$');
