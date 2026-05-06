#!/usr/bin/env bash
set -Eeuo pipefail

# PostgreSQL Backup Script for Google Drive
# Usage: ./backup-postgres.sh
# Schedule: 0 2 * * * (daily at 2 AM UTC)

# Configuration
export PATH="${PATH}:${HOME}/.google-drive-upload/bin/"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"
BACKUP_DIR="${PROJECT_ROOT}/backups/postgres"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="${BACKUP_DIR}/aikc_${DATE}.sql"

# Load environment variables
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
else
    echo "ERROR: Environment file not found: $ENV_FILE"
    exit 1
fi

# Validate required variables
required_vars=("POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "ERROR: Required variable $var is not set"
        exit 1
    fi
done

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[${TIMESTAMP}] Starting PostgreSQL backup..."
echo "[${TIMESTAMP}] Database: $POSTGRES_DB @ localhost:5432"

# Export password for pg_dump
export PGPASSWORD="$POSTGRES_PASSWORD"

# Perform backup
pg_dump \
    -d "$POSTGRES_DB" \
    -U "$POSTGRES_USER" \
    -h localhost \
    --format=plain \
    --no-owner \
    --no-acl \
    --verbose \
    > "$BACKUP_FILE" 2>> "${BACKUP_DIR}/backup.log"

# Unset password
unset PGPASSWORD

# Verify backup
if [[ ! -s "$BACKUP_FILE" ]]; then
    echo "[${TIMESTAMP}] ERROR: Backup file is empty or not created"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[${TIMESTAMP}] Dump completed: ${BACKUP_SIZE}"

# Compress backup
echo "[${TIMESTAMP}] Compressing..."
gzip "$BACKUP_FILE"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
echo "[${TIMESTAMP}] Compressed: ${COMPRESSED_SIZE}"

# Upload to Google Drive
echo "[${TIMESTAMP}] Uploading to Google Drive..."
if gupload "$COMPRESSED_FILE" -d >> "${BACKUP_DIR}/backup.log" 2>&1; then
    echo "[${TIMESTAMP}] Google Drive upload: SUCCESS"
else
    echo "[${TIMESTAMP}] WARNING: Google Drive upload failed, keeping local backup"
fi

# Cleanup old local backups (retain 7 days)
echo "[${TIMESTAMP}] Cleaning up local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "aikc_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "[${TIMESTAMP}] Backup job finished successfully"
