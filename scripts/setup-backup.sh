#!/usr/bin/env bash
set -Eeuo pipefail

# Prerequisites Installer for PostgreSQL Backup
# Usage: ./setup-backup.sh

echo "=== PostgreSQL Backup Setup ==="
echo ""

# Check if running on Linux
if [[ "$(uname)" != "Linux" ]]; then
    echo "WARNING: This script is designed for Linux systems."
    echo "Please install prerequisites manually."
    exit 1
fi

# Step 1: Install PostgreSQL client
echo "Step 1: Installing PostgreSQL client..."
if command -v pg_dump &> /dev/null; then
    echo "  ✓ pg_dump already installed"
else
    echo "  Installing postgresql-client..."
    sudo apt-get update
    sudo apt-get install -y postgresql-client

    if command -v pg_dump &> /dev/null; then
        echo "  ✓ pg_dump installed"
    else
        echo "  ✗ Failed to install pg_dump"
        echo "  Please install manually: sudo apt-get install -y postgresql-client"
        exit 1
    fi
fi

# Step 2: Install google-drive-upload
echo ""
echo "Step 2: Installing google-drive-upload..."
if command -v gupload &> /dev/null; then
    echo "  ✓ google-drive-upload already installed"
else
    echo "  Downloading and installing google-drive-upload..."
    curl --compressed -Ls https://github.com/labbots/google-drive-upload/raw/master/install.sh | bash

    # Add to PATH for current session
    export PATH="${PATH}:${HOME}/.google-drive-upload/bin/"

    if command -v gupload &> /dev/null; then
        echo "  ✓ google-drive-upload installed"
    else
        echo "  ✗ Failed to install google-drive-upload"
        echo "  Please install manually"
        echo "  Run: curl --compressed -Ls https://github.com/labbots/google-drive-upload/raw/master/install.sh | sh"
        exit 1
    fi
fi

# Step 3: Setup Google Drive authentication
echo ""
echo "Step 3: Setting up Google Drive authentication..."
if [[ -d "${HOME}/.config/google-drive-upload" ]]; then
    echo "  ✓ Google Drive already configured"
else
    echo "  Running gsetup (interactive)..."
    echo ""
    gsetup
    echo ""

    if [[ -d "${HOME}/.config/google-drive-upload" ]]; then
        echo "  ✓ Google Drive configured"
    else
        echo "  ✗ Google Drive setup failed"
        echo "  Please run manually: gsetup"
        exit 1
    fi
fi

# Step 4: Create backup directory
echo ""
echo "Step 4: Creating backup directory..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$(dirname "$SCRIPT_DIR")/backups/postgres"

mkdir -p "$BACKUP_DIR"
echo "  ✓ Created: $BACKUP_DIR"

# Step 5: Make scripts executable
echo ""
echo "Step 5: Making scripts executable..."
chmod +x "${SCRIPT_DIR}/backup-postgres.sh" 2>/dev/null && echo "  ✓ backup-postgres.sh" || true
chmod +x "${SCRIPT_DIR}/restore-postgres.sh" 2>/dev/null && echo "  ✓ restore-postgres.sh" || true

# Final summary
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Test backup: bash ./scripts/backup-postgres.sh"
echo "  2. Setup cron:  bash ./scripts/setup-cron.sh"
echo ""
echo "For more information, see: ./scripts/README-BACKUP.md"
