-- Solo puede existir un pairing pendiente por usuario. La aplicación invalida
-- explícitamente el anterior antes de crear uno nuevo.
create unique index if not exists whatsapp_pairing_unico_activo_por_usuario
  on public.whatsapp_vinculaciones_pendientes (usuario_id)
  where usado_en is null;
