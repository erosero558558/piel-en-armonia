# Aurora Derm: Production Deployment Manifesto

This document provides the standard operating procedures for deploying the Aurora Derm system to a fresh production server. The goal is a predictable, zero-downtime cutover.

## 1. Environment Requirements
The application requires the following environment variables to be present in the server's `.env` configuration or Apache/Nginx VHost block before booting the web server:
```ini
# Core Configuration
AURORA_ENV=production
AURORA_SECRET_KEY=your_secure_generated_key_here
AURORA_BASE_URL=https://aurora-derm.com

# Database (SQLite paths or MySQL credentials if migrated)
AURORA_DB_PATH=/var/www/aurora-derm/data/clinical_store.json

# APIs
WHATSAPP_API_TOKEN=your_meta_whatsapp_token
WHATSAPP_PHONE_ID=your_meta_phone_id

# Analytics
CLARITY_ID=mx123
```

`CLARITY_ID` must be configured before launch if Microsoft Clarity should load after cookie consent. Legacy aliases `PIELARMONIA_CLARITY_PROJECT_ID` and `MICROSOFT_CLARITY_PROJECT_ID` are still supported, but `CLARITY_ID` is the deploy-time value this repo now documents and expects.

## 2. Directory Permissions & Security
Certain directories require tight permissions to prevent unauthorized execution or read access to PHI (Protected Health Information).

Ensure the web user (e.g., `www-data` or `apache`) owns the `data/` directory:
```bash
# Secure the uploads directory
mkdir -p data/uploads
chown -R www-data:www-data data/
chmod 0750 data/uploads

# Prevent arbitrary code execution in uploads
echo "php_flag engine off" > data/uploads/.htaccess
```

## 3. Background Services (Cronjobs)
The clinical backend relies on asynchronous tasks (OPS-01) for vital lab alerts and chronic follow-ups. Ensure these are installed on the production server.

Use the provided script to install the crontab:
```bash
npm run ops:install-crons
```

Or manually add `ops/crontab.txt` to the `www-data` user's crontab:
```cron
# Check pending labs daily at 08:00 AM
0 8 * * * php /var/www/aurora-derm/bin/check-pending-labs.php >> /var/log/aurora-cron-labs.log 2>&1

# Check chronic follow-ups every Monday at 09:00 AM
0 9 * * 1 php /var/www/aurora-derm/bin/check-chronic-followup.php >> /var/log/aurora-cron-chronic.log 2>&1

# Check pending interconsults every Tuesday at 09:00 AM
0 9 * * 2 php /var/www/aurora-derm/bin/check-pending-interconsults.php >> /var/log/aurora-cron-interconsults.log 2>&1

# Rotate access logs daily at midnight
0 0 * * * tail -n 10000 /var/www/aurora-derm/data/hce-access-log.jsonl > /tmp/hce_rot.jsonl && mv /tmp/hce_rot.jsonl /var/www/aurora-derm/data/hce-access-log.jsonl
```

## 4. First Run & Backup Verification
Once deployed, perform the first administrative boot sequence:
1. Navigate to `/admin/` and authenticate to initialize the UI hydration keys.
2. Verify the `data/hce-access-log.jsonl` file is appending successfully (OPS-02 requirement).
3. Execute the backup script `npm run backup:now` and verify an artifact is dropped into `data/backups/`.
