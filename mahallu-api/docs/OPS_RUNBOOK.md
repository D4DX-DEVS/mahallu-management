# Ops Runbook — Backup, Restore, Encryption

Task C5 (spec §35). Everything here is operator-facing; nothing in it is executed by the app.

## 1. Backup

`scripts/backup.sh` takes a gzipped `mongodump` archive of the whole database and uploads it to
S3-compatible storage (DigitalOcean Spaces), then prunes local copies older than the retention window.

Environment (server, not the app's `.env` — cron reads its own environment):

| Variable | Required | Default | Notes |
|---|---|---|---|
| `MONGODB_URI` | yes | — | Same connection string the API uses |
| `BACKUP_S3_BUCKET` | yes | — | e.g. `s3://mahallu-backups` |
| `BACKUP_S3_ENDPOINT` | no | AWS default | Set for Spaces, e.g. `https://blr1.digitaloceanspaces.com` |
| `BACKUP_DIR` | no | `/var/backups/mahallu` | Local staging directory |
| `BACKUP_RETENTION_DAYS` | no | `14` | Local pruning only — bucket lifecycle rules handle remote retention |

Install:

```bash
chmod +x /opt/mahallu/mahallu-api/scripts/backup.sh
crontab -e
# 15 2 * * * /opt/mahallu/mahallu-api/scripts/backup.sh >> /var/log/mahallu-backup.log 2>&1
```

Set a bucket lifecycle rule to expire objects after 90 days, and enable bucket versioning so a
corrupted upload cannot overwrite the previous good archive.

## 2. Restore drill — **must be run before this is called a backup**

Restore into a **scratch database**, never over production. Quarterly, and after any change to
`backup.sh` or the MongoDB version.

```bash
# 1. Fetch the newest archive
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 ls "$BACKUP_S3_BUCKET/" | tail -3
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$BACKUP_S3_BUCKET/mahallu-<STAMP>.archive.gz" /tmp/

# 2. Restore into a scratch database name
mongorestore --uri="$MONGODB_URI" \
  --archive=/tmp/mahallu-<STAMP>.archive.gz --gzip \
  --nsFrom='mahallu-management.*' --nsTo='mahallu-restore-drill.*'

# 3. Verify — counts must be within a day's churn of production
mongosh "$MONGODB_URI" --eval '
  const db2 = db.getSiblingDB("mahallu-restore-drill");
  ["users","families","members","ledgeritems","welfareapplications"]
    .forEach(c => print(c, db2.getCollection(c).countDocuments()));
'

# 4. Point a staging API at mahallu-restore-drill, log in, open Dashboard and one report.

# 5. Drop the scratch database
mongosh "$MONGODB_URI" --eval 'db.getSiblingDB("mahallu-restore-drill").dropDatabase()'
```

Record each drill below. **An empty table means the backup is unverified.**

| Date | Archive restored | Collections checked | Result | Run by |
|---|---|---|---|---|
| _(pending — first drill not yet run)_ | | | | |

## 3. Encryption

**In transit.** Serve the API only over HTTPS; terminate TLS at the load balancer / Nginx with a
Let's Encrypt certificate and redirect port 80 → 443. `MONGODB_URI` uses `mongodb+srv://`, which
forces TLS to Atlas. The CMS is served over HTTPS and calls the API by its HTTPS origin — no mixed
content, no plain-HTTP fallback.

**At rest.** MongoDB Atlas encrypts all data at rest with AES-256 by default (WiredTiger encrypted
storage engine); nothing to switch on, but confirm it in Atlas → Cluster → Security. Uploaded files in
DigitalOcean Spaces are encrypted at rest by the provider. Server disks holding `BACKUP_DIR` should
use full-disk encryption, and the backup bucket must have default encryption enabled.

**Field-level encryption** (CSFLE) is deliberately not implemented. It would break every aggregate
report and the assistant's tool queries, and no compliance requirement calls for it today. Sensitive
modules (counselling, maslahat, inheritance, health, welfare) are protected by per-user
`sensitiveAccess(module)` grants instead — denial tests in `src/tests/security.test.ts`.

## 4. Access history

Every mutating request is written to `ActivityLog` by `middleware/activityLogger.ts`.
`GET /api/social/activity-logs?userId=<id>` returns one user's history, tenant-scoped;
the CMS surfaces it at **Settings → Access History**.

## 5. Two-factor login

`PUT /api/auth/two-factor { enabled: true }` marks the calling user. Afterwards `POST /api/auth/login`
returns `{ requiresOtp: true }` instead of a token, and the client must complete
`/auth/send-otp` → `/auth/verify-otp`. If an admin locks themselves out (no WhatsApp access), clear
the flag directly:

```bash
mongosh "$MONGODB_URI" --eval 'db.users.updateOne({phone:"<phone>"},{$set:{twoFactorEnabled:false}})'
```
