#!/usr/bin/env bash
#
# Zieht ein pg_dump-Backup der Produktions-DB auf dem VPS. Laeuft direkt auf
# dem Server (NICHT ueber diesen Repo-Checkout/SSH-Tunnel wie create-admin.ts/
# reset-data.ts) - die Postgres-Instanz liegt in einem eigenen, separaten
# Compose-Projekt (~/frc-elo-db laut UEBERGABE.md), das dieses Repo nicht
# verwaltet.
#
# Format: Plain SQL statt pg_dump -Fc, bewusst. Ein Plain-Dump laesst sich
# mit jedem psql wieder einspielen (keine pg_restore-Versionsabhaengigkeit)
# und im Notfall von Hand lesen/reparieren. --clean --if-exists, damit
# restore-db.sh denselben Dump wiederholt gegen eine nicht-leere DB fahren
# kann, ohne vorher manuell aufzuraeumen.
#
# Aufruf auf dem VPS:
#   ./scripts/backup-db.sh
# Optional Zielverzeichnis ueber Variable steuern:
#   BACKUP_DIR=/mnt/backups ./scripts/backup-db.sh
#
# Vor jedem Rollout ausfuehren UND die entstandene Datei vom Server
# herunterkopieren (scp) - ein Backup, das nur auf demselben Server liegt,
# ist bei Plattenschaden keins. Siehe DATENBANK.md Abschnitt "Backup und
# Restore" fuer den vollstaendigen Ablauf inkl. Restore-Test.

set -euo pipefail

# --- Zu pruefen/anzupassen fuer die konkrete VPS-Umgebung -----------------
# Name des Postgres-Containers im externen Compose-Projekt (docker compose
# -p/--project-name bzw. der Service-Name, je nachdem wie ~/frc-elo-db
# aufgesetzt ist). "postgres" folgt der Bezeichnung aus UEBERGABE.md.
DB_CONTAINER="${DB_CONTAINER:-postgres}"
DB_USER="${DB_USER:-adminfrc}"
DB_NAME="${DB_NAME:-frcspieldaten}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/frc-elo-backups}"
# ---------------------------------------------------------------------------

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y-%m-%d_%H%M)"
outfile="$BACKUP_DIR/${DB_NAME}_${timestamp}.sql.gz"

echo "Sichere ${DB_NAME} aus Container '${DB_CONTAINER}' nach ${outfile} ..."

docker exec "$DB_CONTAINER" pg_dump \
  --clean --if-exists \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  | gzip > "$outfile"

size=$(stat -c%s "$outfile" 2>/dev/null || stat -f%z "$outfile")
if [ "$size" -lt 1024 ]; then
  echo "FEHLER: Dump ist verdaechtig klein (${size} Bytes) - vermutlich ist etwas schiefgelaufen." >&2
  exit 1
fi

echo "Fertig: ${outfile} (${size} Bytes)"
echo "Nicht vergessen: Datei vom Server herunterkopieren, z.B."
echo "  scp <user>@<vps>:${outfile} ./"
