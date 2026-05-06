# PostgreSQL Backup Plan - Google Drive

**Created:** 2026-04-01  
**Updated:** 2026-04-01 (Paths adjusted for actual deployment)  
**Priority:** High  
**Effort:** 1-2 hours  

## Summary

Automated daily PostgreSQL backups to Google Drive with:
- Daily backup at 2:00 AM UTC
- 7-day retention (auto-cleanup)
- Google Drive storage (free tier)
- Simple restore procedure

---

## Configuration

### Paths (Adjusted for User Setup)

| Component | Path |
|-----------|------|
| **Application Code** | `/home/thanhkt/code/stukit/` |
| **Environment File** | `/home/thanhkt/code/stukit/.env` |
| **Backup Scripts** | `/home/thanhkt/code/stukit/scripts/` |
| **Backup Storage (temp)** | `/home/thanhkt/code/stukit/backups/postgres/` |

### Environment Variables

From `/home/thanhkt/code/stukit/.env`:

```bash
# Database (local PostgreSQL)
DATABASE_URL="postgresql://aikc:aikc@localhost:5432/aikc?schema=public"
POSTGRES_USER="aikc"
POSTGRES_PASSWORD="aikc"
POSTGRES_DB="aikc"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Daily Backup Flow                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  2:00 AM UTC                                                     │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                             │
│  │  pg_dump        │  (localhost:5432/aikc)                     │
│  └────────┬────────┘                                             │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                             │
│  │  gzip compress  │                                             │
│  └────────┬────────┘                                             │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                             │
│  │  /home/thanhkt/ │  (temporary, until upload)                  │
│  │  code/stukit/   │                                             │
│  │  backups/       │                                             │
│  │  postgres/      │                                             │
│  └────────┬────────┘                                             │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                             │
│  │  gupload        │ ────► Google Drive                          │
│  │  (google-drive) │      - aikc_20260401.sql.gz                │
│  └────────┬────────┘      - aikc_20260402.sql.gz                │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                             │
│  │  Cleanup:       │                                             │
│  │  - Local >7d    │                                             │
│  └─────────────────┘                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### Phase 1: Install Prerequisites

```bash
# Install postgresql-client (for pg_dump)
sudo apt-get update
sudo apt-get install -y postgresql-client

# Install google-drive-upload
curl --compressed -Ls https://github.com/labbots/google-drive-upload/raw/master/install.sh | sh

# Setup Google Drive (interactive - runs once)
gsetup

# Verify installations
pg_dump --version
gupload --version
```

---

### Phase 2: Create Backup Script

**File:** `/home/thanhkt/code/stukit/scripts/backup-postgres.sh`

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

# Configuration
export PATH="${PATH}:${HOME}/.google-drive-upload/bin/"
ENV_FILE="/home/thanhkt/code/stukit/.env"
BACKUP_DIR="/home/thanhkt/code/stukit/backups/postgres"
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
```

---

### Phase 3: Create Restore Script

**File:** `/home/thanhkt/code/stukit/scripts/restore-postgres.sh`

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

# Configuration
export PATH="${PATH}:${HOME}/.google-drive-upload/bin/"
ENV_FILE="/home/thanhkt/code/stukit/.env"
BACKUP_DIR="/home/thanhkt/code/stukit/backups/postgres"

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
```

---

### Phase 4: Setup Cron Job

```bash
# Make scripts executable
chmod +x /home/thanhkt/code/stukit/scripts/backup-postgres.sh
chmod +x /home/thanhkt/code/stukit/scripts/restore-postgres.sh

# Setup cron job (as root user since VPS credentials show root)
# Note: Run this as root, or use 'sudo crontab -e'
crontab -e

# Add this line for daily backup at 2:00 AM UTC:
0 2 * * * /home/thanhkt/code/stukit/scripts/backup-postgres.sh >> /home/thanhkt/code/stukit/backups/postgres/backup-cron.log 2>&1
```

---

## Directory Structure

```
/home/thanhkt/code/stukit/
├── .env                          # Environment variables
├── scripts/
│   ├── backup-postgres.sh        # Daily backup script
│   └── restore-postgres.sh       # Restore utility
└── backups/
    └── postgres/
        ├── aikc_20260401_020015.sql.gz  # Temporary (until upload)
        ├── backup.log            # Backup operation logs
        └── restore.log           # Restore operation logs
```

---

## Testing Checklist

### 1. Setup Verification

```bash
# Verify postgresql-client is installed
pg_dump --version

# Verify google-drive-upload is installed
gupload --version

# Verify credentials are configured
ls ~/.config/google-drive-upload/
```

### 2. Manual Backup Test

```bash
cd /home/thanhkt/code/stukit
bash ./scripts/backup-postgres.sh
```

### 3. Restore Test

```bash
# List available backups
bash ./scripts/restore-postgres.sh --list

# Restore from local backup
bash ./scripts/restore-postgres.sh --restore 20260401_020015
```

---

## Security

```bash
chmod 600 /home/thanhkt/code/stukit/.env
chmod 750 /home/thanhkt/code/stukit/scripts/*.sh
chmod 750 /home/thanhkt/code/stukit/backups
chmod 750 /home/thanhkt/code/stukit/backups/postgres
```

---

## Acceptance Criteria

- [ ] `postgresql-client` installed
- [ ] `google-drive-upload` installed and configured
- [ ] `/home/thanhkt/code/stukit/scripts/backup-postgres.sh` created and executable
- [ ] `/home/thanhkt/code/stukit/scripts/restore-postgres.sh` created and executable
- [ ] `/home/thanhkt/code/stukit/backups/postgres/` directory created
- [ ] Manual backup test successful
- [ ] Google Drive upload verified
- [ ] Cron job configured for daily 2 AM UTC

---

## Cost

| Resource | Monthly Cost |
|----------|--------------|
| Google Drive (15GB free) | $0 |
| **Total** | **$0/month** |
