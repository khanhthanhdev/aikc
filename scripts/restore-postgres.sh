#!/usr/bin/env bash
set -Eeuo pipefail

# PostgreSQL Restore Script
# Usage: ./restore-postgres.sh --list | --restore <date> | --restore-drive <filename>

# Configuration
export PATH="${PATH}:${HOME}/.google-drive-upload/bin/"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"
BACKUP_DIR="${PROJECT_ROOT}/backups/postgres"

# Load environment
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

export PGPASSWORD="$POSTGRES_PASSWORD"

# Show usage
usage() {
    echo "Usage: $0 [--list | --list-drive | --restore <date> | --restore-drive <filename>]"
    echo ""
    echo "Options:"
    echo "  --list                      List available local backups"
    echo "  --list-drive                List backups on Google Drive"
    echo "  --restore <YYYYMMDD_HHMMSS> Restore from local backup"
    echo "  --restore-drive <filename>  Download and restore from Google Drive"
    echo "  --help                      Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 --list"
    echo "  $0 --restore 20260401_020015"
    echo "  $0 --restore-drive aikc_20260401_020015.sql.gz"
    exit 1
}

# List local backups
list_local() {
    echo "=== Available Local Backups ==="
    if ls -lh "$BACKUP_DIR"/aikc_*.sql.gz 2>/dev/null; then
        echo ""
        echo "Last 3 backups:"
        ls -t "$BACKUP_DIR"/aikc_*.sql.gz 2>/dev/null | head -3 | while read -r f; do
            stat --format="  %n (%y, %s)" "$f"
        done
    else
        echo "  No local backups found"
    fi
}

# List Google Drive backups
list_drive() {
    echo "=== Backups on Google Drive ==="
    gsearch "aikc_" -t file 2>/dev/null | grep "\.sql\.gz" || echo "  No backups found on Google Drive"
}

# Restore from local backup
restore_local() {
    local date=$1
    local backup_file="${BACKUP_DIR}/aikc-${date}.sql.gz"
    local timestamp=$(date +%Y-%m-%d_%H-%M-%S)

    if [[ ! -f "$backup_file" ]]; then
        backup_file="${BACKUP_DIR}/aikc_${date}.sql.gz"
    fi

    if [[ ! -f "$backup_file" ]]; then
        echo "ERROR: Backup file not found: $backup_file"
        echo "Use --list to see available backups"
        exit 1
    fi

    echo "[${timestamp}] === RESTORE WARNING ==="
    echo "This will DROP and RECREATE the database!"
    echo "Target backup: $backup_file"
    echo ""
    read -p "Type 'CONFIRM' to proceed: " confirm

    if [[ "$confirm" != "CONFIRM" ]]; then
        echo "Restore cancelled"
        exit 0
    fi

    # Create temporary file
    TEMP_FILE=$(mktemp)
    trap 'rm -f "$TEMP_FILE"' EXIT

    # Decompress
    echo "[${timestamp}] Decompressing backup..."
    gunzip -c "$backup_file" > "$TEMP_FILE"

    # Verify SQL file
    if [[ ! -s "$TEMP_FILE" ]]; then
        echo "ERROR: Decompressed file is empty"
        exit 1
    fi

    # Drop and recreate database
    echo "[${timestamp}] Dropping existing database..."
    psql -U "$POSTGRES_USER" -h localhost -d postgres \
        -c "DROP DATABASE IF EXISTS $POSTGRES_DB;" >> "${BACKUP_DIR}/restore.log"

    echo "[${timestamp}] Creating new database..."
    psql -U "$POSTGRES_USER" -h localhost -d postgres \
        -c "CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;" >> "${BACKUP_DIR}/restore.log"

    # Restore
    echo "[${timestamp}] Restoring database..."
    psql -U "$POSTGRES_USER" -h localhost -d "$POSTGRES_DB" \
        < "$TEMP_FILE" >> "${BACKUP_DIR}/restore.log"

    echo "[${timestamp}] Restore completed successfully!"
    echo "Verify with: psql -U $POSTGRES_USER -h localhost -d $POSTGRES_DB -c 'SELECT COUNT(*) FROM tools;'"
}

# Restore from Google Drive
restore_drive() {
    local filename=$1
    local timestamp=$(date +%Y-%m-%d_%H-%M-%S)
    local temp_file=$(mktemp)
    trap 'rm -f "$temp_file"' EXIT

    echo "[${timestamp}] Downloading from Google Drive: $filename"

    if ! gdownload "$filename" -o "$temp_file" >> "${BACKUP_DIR}/restore.log" 2>&1; then
        echo "ERROR: Failed to download from Google Drive"
        exit 1
    fi

    # Check if downloaded file is compressed
    if file "$temp_file" | grep -q "gzip"; then
        echo "[${timestamp}] Decompressing..."
        gunzip -c "$temp_file" > "${temp_file}.sql"
        mv "${temp_file}.sql" "$temp_file"
    fi

    # Restore
    echo "[${timestamp}] Restoring database..."
    psql -U "$POSTGRES_USER" -h localhost -d "$POSTGRES_DB" \
        < "$temp_file" >> "${BACKUP_DIR}/restore.log"

    echo "[${timestamp}] Restore from Google Drive completed!"
}

# Main
if [[ $# -lt 1 ]]; then
    usage
fi

case "$1" in
    --list)
        list_local
        ;;
    --list-drive)
        list_drive
        ;;
    --restore)
        [[ -z "${2:-}" ]] && usage
        restore_local "$2"
        ;;
    --restore-drive)
        [[ -z "${2:-}" ]] && usage
        restore_drive "$2"
        ;;
    --help)
        usage
        ;;
    *)
        usage
        ;;
esac
