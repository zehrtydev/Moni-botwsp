#!/usr/bin/env bash
set -euo pipefail

# Manual, never invoked by CI. Requires SUPABASE_DB_URL and BACKUP_AGE_RECIPIENT
# in the invoking environment; values are never printed.
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL in the invoking environment}"
: "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT in the invoking environment}"
backup_root="${1:?usage: $0 /secure/backup/path}"
command -v pg_dump >/dev/null
command -v age >/dev/null
umask 077
destination="$backup_root/supabase-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$destination"
pg_dump --format=custom --no-owner --no-privileges --dbname="$SUPABASE_DB_URL" \
  | age --encrypt --recipient="$BACKUP_AGE_RECIPIENT" -o "$destination/database.dump.age"
sha256sum "$destination/database.dump.age" > "$destination/SHA256SUMS"
echo "Encrypted Supabase backup prepared at $destination."
