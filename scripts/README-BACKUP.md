# PostgreSQL Backup Setup Guide

Automated daily PostgreSQL backups to Google Drive.

---

## Quick Start

```bash
# 1. Install prerequisites
./scripts/setup-backup.sh

# 2. Run backup manually to test
./scripts/backup-postgres.sh

# 3. Setup cron for daily backups
./scripts/setup-cron.sh
```

---

## Step-by-Step Setup

### Step 1: Install Prerequisites

Run the setup script:

```bash
bash ./scripts/setup-backup.sh
```

**Or manually:**

```bash
# Install PostgreSQL client (for pg_dump)
sudo apt-get update
sudo apt-get install -y postgresql-client

# Install google-drive-upload
curl --compressed -Ls https://github.com/labbots/google-drive-upload/raw/master/install.sh | sh

# Setup Google Drive authentication
gsetup
```

Follow the interactive prompt to authenticate with Google Drive.

**Verify installation:**

```bash
pg_dump --version
gupload --version
ls ~/.config/google-drive-upload/
```

---

### Step 2: Make Scripts Executable

```bash
chmod +x ./scripts/backup-postgres.sh
chmod +x ./scripts/restore-postgres.sh
```

---

### Step 3: Test Backup Manually

```bash
bash ./scripts/backup-postgres.sh
```

**Expected output:**

```
[2026-04-01_10-30-15] Starting PostgreSQL backup...
[2026-04-01_10-30-15] Database: aikc @ localhost:5432
[2026-04-01_10-30-18] Dump completed: 15M
[2026-04-01_10-30-18] Compressing...
[2026-04-01_10-30-20] Compressed: 3.2M
[2026-04-01_10-30-25] Google Drive upload: SUCCESS
[2026-04-01_10-30-26] Cleaning up local backups older than 7 days...
[2026-04-01_10-30-26] Backup job finished successfully
```

---

### Step 4: Verify Backup

**Check local backups:**

```bash
bash ./scripts/restore-postgres.sh --list
```

**Check Google Drive backups:**

```bash
bash ./scripts/restore-postgres.sh --list-drive
```

---

### Step 5: Setup Cron Job (Automated Daily Backup)

**Option A: Use the setup script (recommended)**

```bash
bash ./scripts/setup-cron.sh
```

**Option B: Manual cron setup**

```bash
# Edit crontab
crontab -e

# Add this line for daily backup at 2:00 AM UTC:
0 2 * * * /home/thanhkt/code/stukit/scripts/backup-postgres.sh >> /home/thanhkt/code/stukit/backups/postgres/backup-cron.log 2>&1
```

**Verify cron job:**

```bash
crontab -l
```

---

## Usage

### Backup Database

```bash
# Manual backup
bash ./scripts/backup-postgres.sh
```

### List Available Backups

```bash
# Local backups
bash ./scripts/restore-postgres.sh --list

# Google Drive backups
bash ./scripts/restore-postgres.sh --list-drive
```

### Restore Database

**From local backup:**

```bash
bash ./scripts/restore-postgres.sh --restore 20260401_020015
```

**From Google Drive:**

```bash
bash ./scripts/restore-postgres.sh --restore-drive aikc_20260401_020015.sql.gz
```

⚠️ **Warning:** Restore will DROP and RECREATE the database!

---

## Directory Structure

```
/home/thanhkt/code/stukit/
├── .env                          # Database credentials
├── scripts/
│   ├── backup-postgres.sh        # Daily backup script
│   ├── restore-postgres.sh       # Restore utility
│   ├── setup-backup.sh           # Prerequisites installer
│   └── setup-cron.sh             # Cron job setup
└── backups/
    └── postgres/
        ├── aikc_YYYYMMDD_HHMMSS.sql.gz  # Compressed backup
        ├── backup.log            # Backup logs
        └── restore.log           # Restore logs
```

---

## Troubleshooting

### `pg_dump: command not found`

```bash
sudo apt-get install -y postgresql-client
```

### `gupload: command not found`

```bash
export PATH="${PATH}:${HOME}/.google-drive-upload/bin/"
```

### `Authentication failed` or `gsetup not found`

```bash
# Re-run Google Drive setup
gsetup
```

### `Connection refused` (localhost:5432)

```bash
# Check if PostgreSQL is running
docker compose ps | grep postgres
# Or for native installation
systemctl status postgresql
```

### Backup file is empty

1. Check database credentials in `.env`
2. Verify PostgreSQL is accessible:
   ```bash
   psql -U aikc -h localhost -d aikc -c "SELECT 1;"
   ```

---

## Cron Job Management

**View current cron jobs:**

```bash
crontab -l
```

**Edit cron jobs:**

```bash
crontab -e
```

**Remove backup cron job:**

```bash
crontab -l | grep -v "backup-postgres.sh" | crontab -
```

**View cron logs:**

```bash
tail -f ./backups/postgres/backup-cron.log
```

---

## Cleanup

**Remove old Google Drive backups manually:**

1. Go to https://drive.google.com
2. Search for `aikc_`
3. Delete files older than 7 days

**Remove local backups:**

```bash
# Remove all local backups
rm -rf ./backups/postgres/

# Remove only old backups (older than 7 days)
find ./backups/postgres/ -name "aikc_*.sql.gz" -mtime +7 -delete
```

---

## Security Notes

- `.env` file contains database credentials - keep it secure
- Backup scripts should not be committed to git (add to `.gitignore`)
- Google Drive credentials stored in `~/.config/google-drive-upload/`

**Recommended permissions:**

```bash
chmod 600 .env
chmod 750 scripts/*.sh
chmod 750 backups/
```

---

## Cost

| Resource | Monthly Cost |
|----------|--------------|
| Google Drive (15GB free) | $0 |
| Local storage | ~5-10MB per backup |
| **Total** | **$0/month** |

---

## Support

For issues with google-drive-upload:
- Documentation: https://labbots.github.io/google-drive-upload/
- GitHub: https://github.com/labbots/google-drive-upload

For PostgreSQL backup issues:
- pg_dump docs: https://www.postgresql.org/docs/current/app-pgdump.html
