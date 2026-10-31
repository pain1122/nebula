# Patient health activation and rollback package

Status: **activation and served acceptance complete October22**. The user clarified that this is disposable development data and may be recreated if the design requires it. No reset was needed: the assistant applied only the exact two-table additive migration through Docker exec, enabled one main-env flag and deployed only static admin under its existing delegation. Source/schema/profile design approval already exists and is not being requested again. The new approval covers only the concrete live migration, one environment flag and static-admin deployment below; **no live health/profile save**.

Current acceptance: [execution/limits](patient-health-activation-2026-10-22.md) and [immutable receipt](evidence/patient-health-activation-2026-10-22.json). The prerequisite inspection below records the pre-activation state; both tables now exist and the effective flag is enabled.

## Accepted prerequisites and pre-activation state

- Health source gate:11 tests/126 assertions; focused frontend41 tests and quality gates. Additional isolated contract/key/reference/date/history and encrypted backup/restore gate:6 tests/61 assertions. Restoration preserves exact ciphertext/history/correction links/revision and audited API output with the retained synthetic key. The rehearsal uses synthetic SQLite memory, not a claim of a production MySQL backup/restore.
- All eight real MySQL8.0.46/repeatable-read interleavings pass:13 snapshots,10 observations and13 audits; unchanged earlier ciphertext/other patients/account fields/unrelated lifecycle tables, exact typed safe metadata and unconsumed queue sentinel. Guarded final cleanup under the earlier exact RemoveDisposable delegation completed; container/network absence verified. [Acceptance and limits](patient-health-mysql-2026-10-22.md).
- Last read-only live metadata inspection:UID33, health disabled, no health tables/migration record, key configured, configuration uncached and no process-level health flag. No patient rows read. Nine normal services run; helpers stay stopped. Exact accepted static rollback image is2f7bc492/70 assets.
- Health taxonomy remains the approved fixed source catalog1. No managed term mutation/retirement path is enabled. Unknown catalog/schema versions refuse. Managed editing must first deliver retained historical IDs/labels, kind constraints and backward readers under the blog/taxonomy contract; this is not silently waived by health activation.

## Precise scope and preconditions

Use only `checkupino_app`/the existing live database and the exact migration file. Keep all existing keys, credentials, identity/medical/reservation/payment/audit/outbox data and both socket overlays. No scanner/parser/worker startup or job delivery. No backend image/recreation/cache clear, dependency, new route or clinical-read permission change. Static-admin-only build/recreation uses the existing delegation once this activation is approved.

The initial proposal requested operator backup readiness. The user's subsequent disposable-development-data direction supersedes that prerequisite for this activation; no backup or production restore is claimed. No reset was required or performed. The existing encryption key, original records and both pending jobs remain preserved. Future application rollback must still retain populated encrypted health history and its key.

Recheck source hashes against the accepted health/MySQL receipts, current static rollback image and the read-only inspection. Refuse a partial/previously applied schema or a changed/unknown key configuration. Any unexpected precondition requires diagnosis; no auto-repair/reset, broad migrate or populated rollback.

## Exact activation sequence after authorization

1. Following the user's disposable-development-data activation direction, the assistant executed the exact Docker exec sequence (not a backend/database Compose operation) from `C:\Users\Pain\Desktop\work\checkupino`:

```powershell
docker exec --user 33:33 --workdir /var/www checkupino_app php scripts/health/inspect-activation.php --expect-unmigrated
if ($LASTEXITCODE -ne 0) { throw 'Health activation inspection failed.' }
docker exec --user 33:33 --workdir /var/www checkupino_app php artisan migrate --path=database/migrations/2026_10_22_000001_create_patient_health_foundation_tables.php --force
if ($LASTEXITCODE -ne 0) { throw 'Exact health migration failed; stop here.' }
docker exec --user 33:33 --workdir /var/www checkupino_app php scripts/health/inspect-activation.php --expect-migrated-disabled
if ($LASTEXITCODE -ne 0) { throw 'Post-migration inspection failed; keep health disabled.' }
```

Only the approved additive tables are created; no backfill/seed/refresh/fresh/reset. The assistant verified the exact migration/schema state before enabling the flag. A previously applied or partial migration is not blindly repeated.

2. Assistant makes exactly this environment change in the main project `.env`, preserving every unrelated byte/setting/key: add or change `PATIENT_HEALTH_ENABLED=true`. Ambiguous/duplicate definitions refuse. No `.env.production` edit is planned. Re-run the metadata inspection with `--expect-enabled`; it must report health enabled, both tables and exact migration recorded. If the effective value does not match, stop and disable the flag; no unapproved cache clearing or backend recreation.

3. Under the approved static-admin delegation, build/recreate only `admin`:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Admin configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml build admin
if ($LASTEXITCODE -ne 0) { throw 'Admin build failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Admin recreation failed.' }
```

Record the candidate image/assets and retain the accepted image before building; never silently overwrite the only rollback. This starts no backend service/helper and migrates nothing.

4. Verify served source/assets, patient-only empty health reads and EN/Farsi1440/390px form/summary/history, taxonomy search, date/unit/RTL/keyboard/action-row and abort/cancel/refresh behavior. Verify no health fetch/content on doctor/admin/root/support profiles and safe refusals/no-store/session restoration. Use ordinary approved synthetic accounts; protected patients7/8 stay untouched. Do not submit a live save, confirm a password for mutation, or fill in private/protected medical data.

5. Record source/artifact/runtime/browser acceptance and current read-only preservation evidence with honest limits. A separately attended synthetic health save is a later gate; the personally deferred display-name/profile save remains deferred.

## Rollback

First set only `PATIENT_HEALTH_ENABLED=false` in the main `.env` and verify the effective disabled state. Preserve both health tables, data, encryption key and migration record. Never use migration rollback/down after populated history; application rollback is the data-safe path.

Restore the accepted static panel if needed:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.patient-health-admin-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.patient-health-admin-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Static rollback failed.' }
```

The overlay pins exactly the previously accepted2f7bc492 image; it does not touch backend/media/environment/history. Verify old served assets/health and stopped helpers. Any later source rollback retains the additive tables/history and existing key. No accepted or failed evidence is rewritten.

## Approval boundary

The source-only approval explicitly excluded activation/live migration. `AI_BOOT.md` requires explicit authorization for a needed migration not already authorized; this request covers the **live application** of the exact already-tested migration and the flag/deployment sequence above. It does not reopen approved page/schema design or authorize positive live saves, clinician/admin access, content publication/rules, new dependencies or other Compose operations.
