#!/usr/bin/env bash
# Task C5 — nightly MongoDB backup to S3-compatible storage (DigitalOcean Spaces).
#
# Cron (server time, 02:15 daily):
#   15 2 * * * /opt/mahallu/mahallu-api/scripts/backup.sh >> /var/log/mahallu-backup.log 2>&1
#
# Requires: mongodump (mongodb-database-tools), awscli configured for the
# Spaces endpoint, and MONGODB_URI + BACKUP_S3_BUCKET in the environment.
# Restore procedure: docs/OPS_RUNBOOK.md — a backup nobody has restored is not a backup.
set -euo pipefail

: "${MONGODB_URI:?MONGODB_URI is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required, e.g. s3://mahallu-backups}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/mahallu}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
AWS_ARGS=""
if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
  AWS_ARGS="--endpoint-url ${BACKUP_S3_ENDPOINT}"
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${BACKUP_DIR}/mahallu-${STAMP}.archive.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] dumping to ${ARCHIVE}"
mongodump --uri="${MONGODB_URI}" --archive="${ARCHIVE}" --gzip

# A zero-length or missing archive means the dump failed quietly — fail loudly instead.
if [ ! -s "${ARCHIVE}" ]; then
  echo "[backup] FAILED: archive is empty" >&2
  exit 1
fi

echo "[backup] uploading to ${BACKUP_S3_BUCKET}"
# shellcheck disable=SC2086
aws ${AWS_ARGS} s3 cp "${ARCHIVE}" "${BACKUP_S3_BUCKET}/$(basename "${ARCHIVE}")"

echo "[backup] pruning local archives older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -name 'mahallu-*.archive.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "[backup] done: $(basename "${ARCHIVE}") ($(du -h "${ARCHIVE}" | cut -f1))"
