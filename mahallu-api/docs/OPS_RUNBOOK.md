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

## 6. Runtime configuration (deployment-readiness hardening)

These variables are read by the API process. Names only: never commit values.

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | — | **Fail-closed.** Only the exact values `development` and `test` enable development behaviour (echoing a locally generated OTP in the API response, open Swagger, permissive CORS, automatic index builds). `production`, `staging`, unset or any typo means production behaviour. Set it explicitly on every deployed instance. The fixed review-account OTP is NOT governed by this variable (see the warning below). |
| `JWT_SECRET` | — (required) | Signs sessions. There is no fallback. Outside development a placeholder value stops the boot; under 32 characters logs a warning. |
| `CORS_ORIGINS` | none | Comma-separated browser origins allowed to call the API (`https://cms.example.com,https://*.netlify.app`). Entries must be exact origins with a scheme (`https://cms.example.com`) or `https://*.example.com` wildcards with at least two labels after `*.`. Outside development an empty list allows **no** browser origin (the CMS will be blocked until it is set) and an invalid entry (a bare `*`, no scheme, `https://*.com`) **stops the boot**. Plain `http://` origins and wildcards over shared hosts such as `netlify.app` log a warning; prefer exact origins. Requests with no `Origin` header (mobile app, curl) are unaffected. |
| `TRUST_PROXY` | none | Number of reverse proxies in front of the API (`1` for one Nginx/load balancer), or an Express keyword/CIDR list. `true` is ignored on purpose. Needed so rate limiting and the audit log see the real client IP; without it every request looks like it comes from the proxy. Values that would trust every address (`true`, `0.0.0.0/0`, hop counts above 20) are refused with a warning. Set it to the exact number of proxies, because a number that is too high lets a client choose its own IP. See `EDGE_RATE_LIMITING.md`. |
| `ENABLE_API_DOCS`, `API_DOCS_USER`, `API_DOCS_PASSWORD` | docs off | Swagger UI is open only in development. Elsewhere it is mounted only when `ENABLE_API_DOCS=true` **and** both credentials are set, behind HTTP Basic auth. |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Upper bound for graceful shutdown on SIGTERM/SIGINT. |
| `BACKGROUND_JOBS_ENABLED` | `true` | Set `false` on every instance except one: the varisangya reminder and committee-term schedulers must run once. |
| `SEED_ON_STARTUP` | `true` | Upsert-only reference categories. Set `false` to skip. |
| `MONGO_TRANSACTIONS` | auto | `off` forces the non-transactional path. By default transactions are used only when the cluster is a replica set or sharded; see section 8. |
| `ANNOUNCEMENT_MAX_RECIPIENTS` | `500` | Recipient cap per WhatsApp announcement send. |
| `ACTIVITY_LOG_RETENTION_DAYS` | `180` | Activity-log entries expire after this many days (TTL index). Older entries without an expiry are never deleted. |
| `REPORT_MAX_ROWS` | `5000` | Row cap on list-style reports; a capped response carries `truncated: true`. |
| `INDEX_BUILD_MODE` | `auto` in development/test, `gated` elsewhere | `gated` opens the connection with `autoIndex` off, runs the read-only duplicate preflight, then builds the indexes it cleared (section 7). `auto` lets Mongoose build indexes on connect. |
| `INDEX_BUILD_WAIT_MS` | `120000` | How long startup waits for the gated index build before the server starts listening anyway (`0` = do not wait). `/api/ready` reports the real state while the build continues. |
| `INDEX_PREFLIGHT`, `INDEX_PREFLIGHT_TIMEOUT_MS`, `INDEX_PREFLIGHT_LIMIT` | on, `20000`, `20` | Preflight switch (`off` builds every unique index unchecked and verifies it afterwards), total time budget (raise it on large databases: a check that times out is reported `unknown` and its unique index is not built), and conflicting groups listed per index. |

**OTP delivery.** Any environment where `NODE_ENV` is not exactly `development` or `test` sends real OTPs
through DXING, and OTP values are never written to logs. In development and test a locally generated OTP is
echoed in the `send-otp` response (and only there).

> **WARNING: the fixed review-account OTP is not development-only.** An earlier version of this runbook said
> it only works when `NODE_ENV` is `development` or `test`. That was wrong. In `otpController.ts` the branch
> for the App Store review phone number is not gated by the environment: only the echo of the code in the
> HTTP response is. In every environment, including production, a request for that phone number creates (or
> reuses) test accounts with the mahall, institute and member roles on the first active tenant it finds
> (it never creates a super admin), stores a fixed one-time code valid for 60 minutes, and accepts it at
> verify. Anyone who knows the review phone number and the fixed code can therefore sign in as those
> accounts. The product owner chose to retain this feature, so it was not changed. **Before a production
> deployment someone must decide** whether it may remain reachable (options: remove it, gate it to a
> dedicated review tenant with no real data, or disable it with an explicit environment switch). Until then
> treat the first active tenant of a production deployment as exposed to it.

### Probes and shutdown

- `GET /api/health` is liveness: the process is up.
- `GET /api/ready` is readiness: 200 only when MongoDB is connected and the process is not shutting
  down. Point the load balancer health check at this one.
- On SIGTERM/SIGINT the API stops accepting connections, stops the schedulers, waits for in-flight
  requests (bounded by `SHUTDOWN_TIMEOUT_MS`), closes MongoDB, then exits.

### Rate limiting: known limits

Login, send-OTP, verify-OTP, select-account, switch-account and the public certificate lookup are rate
limited **in process memory**, each with its own store (a login attempt does not use up the OTP budget of
the same phone number): login 10 per 5 minutes per IP and phone, send-OTP 5 per 10 minutes, verify-OTP 8 per
2 minutes, select-account 10 per 5 minutes, switch-account and impersonate 10 per 5 minutes per user, public
certificate verify 30 per minute per IP. Counts are per instance and reset on restart, so N instances
allow up to N times the limit. The role-selection (pre-auth) token is valid for 5 minutes and is not
single-use. This is a brake on scripted guessing, not a quota. Behind a proxy it only works per client when
`TRUST_PROXY` is correct. Put edge rate limiting (Nginx `limit_req`, Cloudflare, the load balancer) in
front for a hard limit (see `EDGE_RATE_LIMITING.md` for an Nginx example), or move the store to Redis before running many instances.

## 7. Index builds and existing data

Unique indexes are declared in the models. MongoDB cannot build a unique index over data that already
holds duplicates. **The app does not stop and does not pretend**: the unique-index state is tracked per
index (`enforced`, `blocked-by-duplicates`, `build-failed`, `unknown`) and the code-level guards (atomic
counters, existence checks, idempotency lookups) keep working, but a race can still create a duplicate
until the index exists.

### Index build modes and startup order

Outside development and test (`INDEX_BUILD_MODE=gated`, the default there) the server opens the connection
with `autoIndex` **off**, so connecting builds nothing, and then runs, in this order:
connect, log the transaction mode, run the read-only duplicate preflight, build every index the preflight
cleared, then start listening. A unique index whose preflight found duplicates (or could not be checked) is
NOT built; the log lists the conflicting ids, and `/api/ready` shows `indexesEnforced: false`. Each unique
index is built on its own with a create-only call (never `syncIndexes`, never a drop or delete) and is only
counted as enforced after the index is seen in the collection with the expected options. All non-unique
indexes (performance indexes, the OTP and activity-log TTL indexes) are built afterwards and a failure
there does not affect uniqueness. In development and test (`auto`) Mongoose builds indexes as before and
the preflight only reports.

Startup waits for the build for at most `INDEX_BUILD_WAIT_MS`; on a large database the server may start
listening while the build continues, and `/api/ready` then reports the not-yet-verified indexes as
`unknown`. Writes made in that window can still add duplicates that make a later unique build fail.
`INDEX_PREFLIGHT=off` in gated mode builds every unique index unchecked and verifies it afterwards.
A first gated deploy against a database whose indexes were already built is a no-op for those indexes.

The unique indexes covered (the list is derived from the model schemas, so it cannot drift from them):

- `Family` and `Member`: `(tenantId, mahallId)` (string ids only).
- Case models (counselling, maslahat, inheritance): `(tenantId, caseNo)`.
- `Varisangya` and `Zakat`: `(tenantId, receiptNo)` (string receipt numbers only).
- `LedgerItem`: `(source, sourceId)` for auto-posted entries; `Ledger`: auto-created ledgers only.
- Idempotency keys: `(tenantId, clientRequestId)` on `Varisangya`, `Zakat`, `QardRepayment`,
  `ZakatDistribution`; `Wallet (tenantId, key)`; `Transaction (tenantId, entryKey)`.
- Plus the older ones (salary per employee/month, graves, class attendance, categories, tenant code, user
  phone/role, certificates, `ReconciliationIssue` open records).

### Startup preflight (read-only)

After the database connects, the server runs ONE read-only aggregation per unique index and looks for
duplicate keys. It only reads: no index is dropped, no document is changed or deleted, ever. It is bounded
in time and can never stop the server. If it finds duplicates it logs ONE error per conflicting index,
with ids only (no names, phone numbers or other personal data):

```
[indexes] UNIQUE INDEX NOT SAFE: Family (tenantId, mahallId) has 3 duplicate groups; ids: <id>, <id>, ...; resolve manually, then restart. Uniqueness is NOT enforced until then.
```

A failed index build (`[indexes] INDEX BUILD FAILED: <Model> (<index>) - <error class and code>`) is
logged the same way (the driver message, which can quote a stored value, is never logged).

`GET /api/ready` returns 503 when the database is down or the server is shutting down, and otherwise 200
with counts only (no names or ids):

```
{ "status": "ready", "indexesEnforced": true|false,
  "indexes": { "total", "enforced", "blockedByDuplicates", "buildFailed", "unknown", "notEnforced" },
  "indexBuild": { "mode": "auto|gated", "phase": "pending|preflight|building|complete",
                  "otherIndexes": { "built", "failed" } } }
```

`indexesEnforced` is true only when every registered unique index is verified. A false value is a warning
to read the startup log, not a readiness failure; use it in monitoring.

Settings (all optional): `INDEX_PREFLIGHT=off` skips the startup check; `INDEX_PREFLIGHT_TIMEOUT_MS`
(default 20000, total) and `INDEX_PREFLIGHT_LIMIT` (default 20 conflicting groups per index).

Each check is a collection scan, so on a very large collection the startup check may hit the time limit
and report that index as `unknown`.

### Operator check before a deploy

```bash
npm run check:indexes              # human-readable
npm run check:indexes -- --json    # same report as JSON (key values and ids only)
```

It is **read-only**: it connects with `autoIndex` and `autoCreate` off (so merely connecting builds
nothing), runs the same aggregations and prints the conflicting keys and document ids. Exit code 0 = no
duplicates, 1 = duplicates found, 2 = a check could not complete, 3 = could not connect. Point it at a
**restored copy** of production (`CHECK_INDEXES_URI=...`, otherwise `MONGODB_URI`), or run it read-only
against production: it only reads, but it is a scan per index. `.env` is loaded only when the script is
run directly.

Deciding which duplicate row is the real one is a manual job (it may involve merging records and
re-pointing references); neither the script nor the server resolves duplicates. Fix them, restart, and
confirm the log shows no `UNIQUE INDEX NOT SAFE` or `INDEX BUILD FAILED` lines.

Receipt, certificate, family, member and case numbers come from atomic counters (`counters`
collection). A counter row is created on first use, seeded from the highest number already in use.
Numbers are never reused, so a failed save can leave a gap in a sequence.

## 8. Transactions and money flows

The code does not assume a replica set. Money flows (collections, wallets, ledger postings, salary,
petty cash, welfare and qard) are written so they are correct **without** a transaction: atomic
operators, claim-then-act status changes, idempotency keys (`clientRequestId`) and explicit
compensation. When the cluster supports transactions they additionally run inside one.

**True multi-document transactions require a replica set, a sharded cluster (mongos) or Atlas.** A
standalone deployment is supported through atomic updates, idempotency keys and compensation, but it
**cannot recover from a process crash (or power loss) between two steps of one flow**: whatever steps
had finished stay finished and nothing runs the undo. Running a replica set (Atlas always is) removes
that residual risk; confirm the topology of the production cluster. No production configuration is
changed by the code: the app only detects what the deployment offers.

### Which mode is active

The mode is decided per operation from the driver's topology (replica set with a primary, sharded /
mongos, or a direct connection to a primary or mongos: transactions; standalone, load balancer: none).
Nothing is cached, so a topology that has not finished discovery at the first request is simply checked
again at the next one (that one request runs the compensated path). The startup log says which mode
applies, once, without any host or URI:

- `MongoDB transactions: ENABLED (replica set)` (or `(sharded cluster / mongos)`)
- `MongoDB transactions: DISABLED (standalone: financial flows rely on atomic updates, idempotency keys and compensation)`
- `MongoDB transactions: DISABLED (MONGO_TRANSACTIONS=off: ...)`
- `MongoDB transactions: UNDETERMINED (topology not discovered yet; ...)`, followed by the definitive line
  as soon as the topology is known.

`MONGO_TRANSACTIONS=off` forces the compensated path even on a replica set. If a server rejects a
transaction at runtime (error 20, "Transaction numbers are only allowed on a replica set member or
mongos") the operation falls back to the compensated path, and transactions are not tried again for a
minute. The fallback happens only when no step had run in the aborted attempt; otherwise the failure is
reported for review instead of being retried blindly.

### When an undo fails: `[RECONCILIATION REQUIRED]`

If a step fails and the step that should undo it fails too, the data may be half-written. The system:

1. writes one structured line, `[RECONCILIATION REQUIRED] {"flow":...,"entity":...,"entityId":...,"tenantId":...,"step":...,"reason":...}`
   (ids, flow, step and an error class/short message; phone numbers, e-mail addresses, tokens and
   connection strings are stripped);
2. stores a durable `ReconciliationIssue` (best effort; it never delays or changes the error answer):
   one open record per (Mahallu, flow, record, failed step), with a counter if it keeps happening;
3. answers the user with an explicit error that says the record needs administrator review. It is never
   a success, and the user is told not to retry.

Administrators list open issues with `GET /api/reconciliation` (`?status=open|resolved|all`) and close one
with `PUT /api/reconciliation/:id/resolve` and `{ "note": "what was checked and fixed" }`. A Mahallu admin
sees only their own Mahallu; a super admin sees all. Resolving only closes the marker: the correction of
the data (balances, ledger rows) is a person's decision. Search the logs for `[RECONCILIATION REQUIRED]`
as well, and treat any open issue as a stop sign for that record until it is checked.

Known accounting note for the treasurer: a petty cash float is posted to the ledger as an expense when
the fund is created, and each expense is posted again at replenishment, so the same rupees can appear in
both "Petty Cash" and "Petty Cash Expenses". The behaviour was left unchanged; confirm the intended
policy with the accountant.

## 9. Sessions, exports, certificates and uploads (final audit notes)

**Sessions.** Session and View-As tokens are signed and verified with HS256 only (tokens using another
algorithm, including `none`, are rejected). `tokenVersion` is bumped on logout (all devices), password
change, 2FA toggle and an admin changing a user's phone, which ends older sessions; deactivating a user or
suspending a Mahallu blocks the next request. `/auth/me` and sign-in responses omit `tokenVersion`. A
View-As session is checked against the Mahallu status only when it starts and lasts up to 4 hours.
Approving a member's phone-change request updates `Member.phone` only (decision D7 in
`AUTHORIZATION_POLICY.md`).

**Members and certificates.** Members may call `GET /api/certificates` and
`GET /api/certificates/:id/download` (own certificates only; the list omits the storage key and the issue
key). Issue and revoke stay admin-only. This is a deliberate small widening of the member API surface.

**Exports.** `GET /api/export/:entity` neutralises spreadsheet formulas the same way the CMS does (values
starting with `=`, `@`, a tab or carriage return, and `+`/`-` unless numeric or phone-like get a leading
apostrophe; long digit strings and leading-zero numbers are written so Excel keeps them as text). It
returns at most 10,000 rows (the newest); when more exist the response carries `X-Export-Truncated: true`,
which CORS exposes to the CMS. Exports are tenant-scoped and admin-only.

**Certificates.** Numbers come from a global atomic counter per type and year (`NK|DT|NC-<year>-0001`);
a failed request after the number was taken leaves a gap, never a repeat. One claim row per registration
serialises issuing; a claim that cannot be released expires after 120 seconds and a contended request gets
`409 CERTIFICATE_BEING_ISSUED` after waiting up to 10 seconds. Revoking a certificate lets an admin issue a
new one with a new number for the same registration (decision D8).

**Uploads and orphans.** A private object uploaded by a request is deleted again, only if no record
references it, when that request's database save fails. If the delete itself fails the log shows
`[ORPHAN OBJECT] {key, reason}` and a reconciliation issue is stored. Banner and notification images are
public objects uploaded before the banner or notification is created, so a failed create leaves an
unreferenced public object: add a bucket lifecycle rule on the `banners/` and `notifications/` prefixes.
An upload whose response was lost (the storage stored the object but the client saw a timeout) cannot be
tracked.

**Reconciliation.** `GET /api/reconciliation` lists open issues (admins; a Mahallu admin sees only their
own Mahallu) and `PUT /api/reconciliation/:id/resolve` closes one with a note; resolving repairs nothing.
Records contain flow, entity, entity id, step and a short scrubbed reason, plus a `state` map: for
collections and zakat distributions `stepsDone` and `undoFailed`; for salary, petty cash, welfare and qard
the amounts or flags of the steps that completed. Records never contain personal data, tokens or URIs.
Every flow answers a failed undo with HTTP 500, `reconciliationRequired: true` and the administrator-review
message; one exception, petty cash fund creation when the float cannot be posted, answers 201 with
`ledgerPending: 1` (see `ACCOUNTING_DECISIONS.md`).
