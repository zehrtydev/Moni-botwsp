#!/usr/bin/env bash
set -euo pipefail

# Ejecución manual únicamente, en una ventana aprobada. CI nunca lo invoca.
backup_root="${1:?usage: $0 /secure/backup/path}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$backup_root/moni-$timestamp"
mkdir -p "$destination"
for volume in moni_caddy_data moni_caddy_config moni_ollama_data moni_evolution_instances moni_evolution_postgres moni_evolution_redis; do
  docker run --rm -v "$volume:/source:ro" -v "$destination:/backup" alpine:3.23 \
    tar --numeric-owner --xattrs --acls -czf "/backup/$volume.tar.gz" -C /source .
done

sha256sum "$destination"/*.tar.gz > "$destination/SHA256SUMS"
chmod 700 "$destination"
echo "Volume backup prepared at $destination; restore only into an isolated project."
