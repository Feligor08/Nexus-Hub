#!/usr/bin/env bash
# ==============================================================================
# NEXUS CODE PLAY — PRODUCTION BACKUP SCRIPT (MariaDB & Media Storage)
# Target Environment: Ubuntu Server 24.04 LTS (HP EliteDesk 800 G3 Mini)
# ==============================================================================
set -euo pipefail

# Load environment if .env exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  # Safely export variables from .env
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Configuration defaults
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_ROOT="${BACKUP_DIR:-/var/nexus/backups}"
DB_BACKUP_DIR="$BACKUP_ROOT/database"
MEDIA_BACKUP_DIR="$BACKUP_ROOT/media"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-nexus_code_play}"
DB_USER="${DB_USER:-nexus_app}"
STORAGE_PATH="${MEDIA_STORAGE_PATH:-/var/nexus/storage}"

# Ensure backup directories exist
mkdir -p "$DB_BACKUP_DIR" "$MEDIA_BACKUP_DIR"

echo "=========================================================="
echo " [$(date -Iseconds)] STARTING NEXUS CODE PLAY BACKUP"
echo "=========================================================="
echo "Host:       $DB_HOST:$DB_PORT"
echo "Database:   $DB_NAME"
echo "User:       $DB_USER"
echo "Backup Dir: $BACKUP_ROOT"
echo "Retention:  $RETENTION_DAYS Tage"
echo "----------------------------------------------------------"

# 1. MariaDB Dump
DUMP_FILENAME="nexus_db_${TIMESTAMP}.sql.gz"
DUMP_FILEPATH="$DB_BACKUP_DIR/$DUMP_FILENAME"

# Select dump tool
DUMP_CMD="mariadb-dump"
if ! command -v mariadb-dump &> /dev/null; then
  if command -v mysqldump &> /dev/null; then
    DUMP_CMD="mysqldump"
  else
    echo "FEHLER: Weder 'mariadb-dump' noch 'mysqldump' wurden auf dem System gefunden!" >&2
    exit 1
  fi
fi

echo "[1/3] Erstelle konsistenten MariaDB-Dump..."
# Use MYSQL_PWD to prevent passwords appearing in ps / process tree
export MYSQL_PWD="${DB_PASSWORD:-}"

$DUMP_CMD \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --default-character-set=utf8mb4 \
  "$DB_NAME" | gzip -9 > "$DUMP_FILEPATH"

unset MYSQL_PWD

# 2. Dump Integrity Verification
echo "[2/3] Verifiziere Integrität des Dumps..."
if [[ ! -s "$DUMP_FILEPATH" ]]; then
  echo "FEHLER: Dump-Datei ist leer (0 Bytes)! Backup abgebrochen." >&2
  rm -f "$DUMP_FILEPATH"
  exit 1
fi

# Test gzip integrity
gzip -t "$DUMP_FILEPATH"
DUMP_SIZE=$(du -h "$DUMP_FILEPATH" | cut -f1)

# Generate SHA-256 Checksum
(cd "$DB_BACKUP_DIR" && sha256sum "$DUMP_FILENAME" > "${DUMP_FILENAME}.sha256")
echo "  -> Dump erfolgreich: $DUMP_FILENAME ($DUMP_SIZE)"
echo "  -> SHA-256 Checksum: $(cat "$DB_BACKUP_DIR/${DUMP_FILENAME}.sha256" | awk '{print $1}')"

# 3. Media Storage Backup
echo "[3/3] Sichere Media Storage ($STORAGE_PATH)..."
if [[ -d "$STORAGE_PATH" ]]; then
  MEDIA_TAR_NAME="nexus_media_${TIMESTAMP}.tar.gz"
  MEDIA_TAR_PATH="$MEDIA_BACKUP_DIR/$MEDIA_TAR_NAME"

  tar -czf "$MEDIA_TAR_PATH" -C "$(dirname "$STORAGE_PATH")" "$(basename "$STORAGE_PATH")"
  (cd "$MEDIA_BACKUP_DIR" && sha256sum "$MEDIA_TAR_NAME" > "${MEDIA_TAR_NAME}.sha256")
  MEDIA_SIZE=$(du -h "$MEDIA_TAR_PATH" | cut -f1)
  echo "  -> Media-Backup erfolgreich: $MEDIA_TAR_NAME ($MEDIA_SIZE)"
else
  echo "  -> Hinweis: Media Storage Verzeichnis $STORAGE_PATH existiert noch nicht. Übersprungen."
fi

# 4. Retention Policy Cleanup
echo "----------------------------------------------------------"
echo "Bereinige Backups älter als $RETENTION_DAYS Tage..."
find "$DB_BACKUP_DIR" -type f \( -name "*.sql.gz" -o -name "*.sha256" \) -mtime "+$RETENTION_DAYS" -exec rm -v {} \;
find "$MEDIA_BACKUP_DIR" -type f \( -name "*.tar.gz" -o -name "*.sha256" \) -mtime "+$RETENTION_DAYS" -exec rm -v {} \;

echo "=========================================================="
echo " [$(date -Iseconds)] BACKUP ERFOLGREICH ABGESCHLOSSEN"
echo "=========================================================="
exit 0
