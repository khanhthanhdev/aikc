#!/usr/bin/env bash
set -Eeuo pipefail

# Cron Job Setup Script
# Usage: ./setup-cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-postgres.sh"
BACKUP_DIR="$(dirname "$SCRIPT_DIR")/backups/postgres"

echo "=== Cron Job Setup ==="
echo ""

# Verify backup script exists
if [[ ! -f "$BACKUP_SCRIPT" ]]; then
    echo "ERROR: Backup script not found: $BACKUP_SCRIPT"
    echo "Please run ./setup-backup.sh first"
    exit 1
fi

# Get absolute path
BACKUP_SCRIPT_ABS=$(realpath "$BACKUP_SCRIPT")
BACKUP_DIR_ABS=$(realpath "$BACKUP_DIR")

echo "Backup script: $BACKUP_SCRIPT_ABS"
echo "Backup directory: $BACKUP_DIR_ABS"
echo ""

# Create cron entry
CRON_ENTRY="0 2 * * * ${BACKUP_SCRIPT_ABS} >> ${BACKUP_DIR_ABS}/backup-cron.log 2>&1"

echo "Cron entry (daily at 2:00 AM UTC):"
echo "  $CRON_ENTRY"
echo ""

# Check if cron is already configured
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")
if echo "$CURRENT_CRON" | grep -q "backup-postgres.sh"; then
    echo "✓ Cron job already configured"
else
    # Add cron entry
    echo "Adding cron job..."
    (echo "$CURRENT_CRON"; echo "$CRON_ENTRY") | crontab -
    echo "✓ Cron job added"
fi

# Verify cron service
echo ""
if systemctl is-active --quiet cron 2>/dev/null; then
    echo "✓ Cron service is running"
else
    echo "WARNING: Cron service may not be running"
    echo "To start: sudo systemctl start cron"
    echo "To enable: sudo systemctl enable cron"
fi

# Show current cron jobs
echo ""
echo "Current cron jobs:"
crontab -l 2>/dev/null || echo "  (none)"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To verify backup runs:"
echo "  tail -f ${BACKUP_DIR_ABS}/backup-cron.log"
echo ""
echo "To remove cron job:"
echo "  crontab -e  # Delete the line with backup-postgres.sh"
