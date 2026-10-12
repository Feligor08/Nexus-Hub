#!/usr/bin/env bash
# ==============================================================================
# NEXUS CODE PLAY — PRODUCTION RESTORE SCRIPT
# Target Environment: Ubuntu Server 24.04 LTS (HP EliteDesk 800 G3 Mini)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-nexus_code_play}"
DB_USER="${DB_USER:-nexus_app}"
STORAGE_PATH="${MEDIA_STORAGE_PATH:-/var/nexus/storage}"

usage() {
  echo "Verwendung: $0 <dump-file.sql.gz> [OPTIONEN]"
  echo ""
  echo "Optionen:"
  echo "  --target-db <name>      Stellt in eine alternative Datenbank wieder her (Standard: $DB_NAME)"
  echo "  --media-tar <file>      Stellt auch das Media Storage Archiv wieder her"
  echo "  --skip-checksum         Überspringt die SHA-256 Validierung"
  echo "  --force                 Bestätigt das Überschreiben ohne interaktive Abfrage"
  echo "  --help                  Zeigt diese Hilfe"
  exit 1
}

if [[ $# -lt 1 ]]; then
  usage
fi

DUMP_FILE="$1"
shift

TARGET_DB="$DB_NAME"
MEDIA_TAR=""
SKIP_CHECKSUM=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-db)
      TARGET_DB="$2"
      shift 2
      ;;
    --media-tar)
      MEDIA_TAR="$2"
      shift 2
      ;;
    --skip-checksum)
      SKIP_CHECKSUM=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo "Unbekannte Option: $1" >&2
      usage
      ;;
  esac
done

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "FEHLER: Dump-Datei '$DUMP_FILE' existiert nicht!" >&2
  exit 1
fi

echo "=========================================================="
echo "    NEXUS CODE PLAY — RESTORE PROZESS"
echo "=========================================================="
echo "Dump-Datei:      $DUMP_FILE"
echo "Ziel-Host:       $DB_HOST:$DB_PORT"
echo "Ziel-Datenbank:  $TARGET_DB"
echo "Benutzer:        $DB_USER"
echo "Media Storage:   ${MEDIA_TAR:-Kein Media-Archiv angegeben}"
echo "----------------------------------------------------------"

# 1. SHA-256 Checksum Verification
if [[ "$SKIP_CHECKSUM" = false ]]; then
  CHECKSUM_FILE="${DUMP_FILE}.sha256"
  if [[ -f "$CHECKSUM_FILE" ]]; then
    echo "[1/4] Prüfe SHA-256 Checksumme..."
    DUMP_DIR="$(dirname "$DUMP_FILE")"
    DUMP_BASE="$(basename "$DUMP_FILE")"
    (cd "$DUMP_DIR" && sha256sum -c "$(basename "$CHECKSUM_FILE")")
    echo "  -> Checksumme ist GÜLTIG."
  else
    echo "[1/4] Hinweis: Keine .sha256 Begleitdatei gefunden. Prüfe Gzip-Integrität..."
    gzip -t "$DUMP_FILE"
    echo "  -> Gzip-Archiv ist intakt."
  fi
else
  echo "[1/4] Checksummen-Prüfung übersprungen."
fi

# 2. Safety confirmation
if [[ "$FORCE" = false ]]; then
  echo ""
  echo "WARNUNG: Die Wiederherstellung wird Tabellen in '$TARGET_DB' auf '$DB_HOST' modifizieren!"
  read -r -p "Möchtest du fortfahren? Tippe 'JA' zur Bestätigung: " CONFIRM
  if [[ "$CONFIRM" != "JA" ]]; then
    echo "Wiederherstellung durch Nutzer abgebrochen."
    exit 0
  fi
fi

# 3. Database Restore
echo "[2/4] Stelle Datenbank in '$TARGET_DB' wieder her..."

MYSQL_CMD="mariadb"
if ! command -v mariadb &> /dev/null; then
  if command -v mysql &> /dev/null; then
    MYSQL_CMD="mysql"
  else
    echo "FEHLER: Weder 'mariadb' noch 'mysql' CLI auf dem System gefunden!" >&2
    exit 1
  fi
fi

export MYSQL_PWD="${DB_PASSWORD:-}"

# Ensure database exists
$MYSQL_CMD --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  -e "CREATE DATABASE IF NOT EXISTS \`$TARGET_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Decompress and feed to MariaDB
gunzip -c "$DUMP_FILE" | $MYSQL_CMD --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$TARGET_DB"

unset MYSQL_PWD
echo "  -> Datenbank-Wiederherstellung erfolgreich."

# 4. Media restore (optional)
if [[ -n "$MEDIA_TAR" && -f "$MEDIA_TAR" ]]; then
  echo "[3/4] Stelle Media Storage wieder her..."
  mkdir -p "$STORAGE_PATH"
  tar -xzf "$MEDIA_TAR" -C "$(dirname "$STORAGE_PATH")"
  echo "  -> Mediendateien erfolgreich entpackt."
else
  echo "[3/4] Kein Media-Archiv zum Wiederherstellen."
fi

# 5. Schema verification check
echo "[4/4] Verifiziere wiederhergestellte Tabellen in '$TARGET_DB'..."
export MYSQL_PWD="${DB_PASSWORD:-}"
TABLE_COUNT=$($MYSQL_CMD --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" -N -e \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='$TARGET_DB';")
unset MYSQL_PWD

echo "  -> Gefundene Tabellen in '$TARGET_DB': $TABLE_COUNT"
echo "=========================================================="
echo " RESTORE ERFOLGREICH ABGESCHLOSSEN"
echo "=========================================================="
exit 0
