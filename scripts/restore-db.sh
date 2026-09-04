#!/usr/bin/env bash
#
# Spielt einen mit scripts/backup-db.sh gezogenen Dump wieder ein. Laeuft
# wie backup-db.sh direkt gegen den Postgres-Container (nicht ueber diesen
# Repo-Checkout/SSH-Tunnel wie create-admin.ts/reset-data.ts).
#
# Destruktiv: der Dump enthaelt "--clean --if-exists", ueberschreibt also
# den kompletten aktuellen Inhalt der Ziel-DB. Deshalb wie
# scripts/reset-data.ts hinter einer expliziten Bestaetigungsabfrage
# ("LOESCHEN" tippen).
#
# Aufruf:
#   ./scripts/restore-db.sh <pfad-zum-dump.sql.gz>
#
# Fuer einen Restore-TEST (ungefaehrliche leere DB statt Produktion, siehe
# DATENBANK.md "Backup und Restore") stattdessen lokal gegen den
# docker-compose.local.yml-Container fahren:
#   DB_CONTAINER=frc-elo-db-1 DB_USER=frc DB_NAME=frcspieldaten \
#     ./scripts/restore-db.sh <dump>

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Aufruf: $0 <pfad-zum-dump.sql.gz>" >&2
  exit 1
fi

DUMP_FILE="$1"

if [ ! -f "$DUMP_FILE" ]; then
  echo "FEHLER: Datei nicht gefunden: ${DUMP_FILE}" >&2
  exit 1
fi

# --- Zu pruefen/anzupassen fuer die konkrete VPS-Umgebung -----------------
DB_CONTAINER="${DB_CONTAINER:-postgres}"
DB_USER="${DB_USER:-adminfrc}"
DB_NAME="${DB_NAME:-frcspieldaten}"
# ---------------------------------------------------------------------------

echo "Ziel: Datenbank '${DB_NAME}' in Container '${DB_CONTAINER}'."
echo "Dump: ${DUMP_FILE}"
echo
echo "ACHTUNG: Das ueberschreibt den kompletten aktuellen Inhalt dieser"
echo "Datenbank (Dump enthaelt --clean --if-exists)."
echo
read -r -p "Zum Bestaetigen 'LOESCHEN' eintippen: " confirm

if [ "$confirm" != "LOESCHEN" ]; then
  echo "Abgebrochen."
  exit 1
fi

echo "Spiele ${DUMP_FILE} ein ..."

gunzip -c "$DUMP_FILE" | docker exec -i "$DB_CONTAINER" psql \
  -v ON_ERROR_STOP=1 \
  -U "$DB_USER" \
  -d "$DB_NAME"

echo "Fertig."
