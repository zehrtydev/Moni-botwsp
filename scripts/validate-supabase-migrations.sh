#!/usr/bin/env bash
set -euo pipefail

migration_dir="${1:-supabase/migrations}"
test -d "$migration_dir"
mapfile -t migrations < <(find "$migration_dir" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)
test "${#migrations[@]}" -gt 0
for migration in "${migrations[@]}"; do
  [[ "$migration" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]] || { echo "Invalid migration filename: $migration" >&2; exit 1; }
done

while read -r file; do
  grep -q 'enable row level security' "$file" || { echo "Missing RLS in $file" >&2; exit 1; }
done < <(grep -Erl 'create table public\.(whatsapp_|presupuestos_|ingresos|gastos|mensajes_)' "$migration_dir")

grep -q 'whatsapp_pairing_unico_activo_por_usuario' "$migration_dir/20260903090000_harden_whatsapp_pairing.sql"
grep -q 'contact_lid_requires_explicit_pairing' apps/web/src/app/api/webhooks/whatsapp/route.ts
echo "Supabase migration and RLS static validation passed. No migration was applied."
