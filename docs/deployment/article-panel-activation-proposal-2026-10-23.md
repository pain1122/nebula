# Article administration activation and rollback package

October23 explicit activation delegation: user authorized guarded checkupino_schedule_acceptance database startup/tests/recreation-if-needed/cleanup, then the existing exact six-table article migration, authoring flag and one ordinary synthetic save/review/publish/recovery check after successful gates. This is a narrow exception to general operator-owned database Compose; no reset, patient-health write, scanner/worker startup or job processing.

Executed and accepted October23 under the explicit delegation above: eleven MySQL cases and cleanup passed, the exact six-table migration and authoring flag were activated, and nine ordinary synthetic browser writes verified bilingual terms, draft/review/publication/edit/version recovery. See the [execution record and limits](article-authoring-layout-2026-10-23.md). Commands below preserve the original preconditions; do not rerun absent-schema checks/migration or synthetic creation against the now-populated schema.

## Read-only preflight

Run from C:\Users\Pain\Desktop\work\checkupino:

```powershell
docker exec --user 33:33 --workdir /var/www checkupino_app php scripts/content/inspect-activation.php --expect-unmigrated
if ($LASTEXITCODE -ne 0) { throw 'Article activation inspection failed; stop here.' }
```

This verifies UID33, MySQL, all six tables/exact migration absent, effective ARTICLE_ADMIN_ENABLED=false, no process override/cache and zero writes. Inspect source hashes against the accepted panel receipt and MySQL receipt before activation. Refuse partial/preexisting schema and changed implementation; diagnose instead of broad migrate/reset. The current development-data policy avoids unnecessary reset/backup loops; no backup or production restore is claimed.

## Exact sequence only after separate authorization

1. Preserve the accepted static image and current read-only business/protected/health/job fingerprints. Confirm the source/MySQL receipts and all six schema preconditions. Keep the current encryption key, credentials, health and other business data.
2. Apply only the approved additive migration:

```powershell
docker exec --user 33:33 --workdir /var/www checkupino_app php scripts/content/inspect-activation.php --expect-unmigrated
if ($LASTEXITCODE -ne 0) { throw 'Article activation inspection failed.' }
docker exec --user 33:33 --workdir /var/www checkupino_app php artisan migrate --path=database/migrations/2026_10_22_000002_create_article_content_foundation_tables.php --force
if ($LASTEXITCODE -ne 0) { throw 'Exact article migration failed; leave disabled.' }
docker exec --user 33:33 --workdir /var/www checkupino_app php scripts/content/inspect-activation.php --expect-migrated-disabled
if ($LASTEXITCODE -ne 0) { throw 'Article schema verification failed; leave disabled.' }
```

3. Change only main .env ARTICLE_ADMIN_ENABLED=true after verifying one unambiguous definition. Preserve every unrelated setting/byte; no cache clear, backend recreation or .env.production edit. Re-run the same inspector with --expect-enabled; stop and disable if the effective value differs. The static panel is already deployed; it needs no backend/worker restart or new dependency.
4. Accept actual ordinary admin/root reads and a small authorized synthetic category/topic/tag and EN/Farsi article: save draft -> submit -> editorial review -> publish, edit while published pointer stays unchanged, copy an older version into a new draft. Those operations are now accepted. A live archive of another disposable example remains separate; no archive write was performed. Use current signed contexts, real recent-password/reason/confirmation and normal APIs/UI only. Re-read revisions/history/audit after each; no replay after ambiguous delivery. Verify patient/doctor administration refusals and no private health reads. These are editorial controls, not a claim of clinical review or patient recommendations.
5. Record exact source/static image/assets, live schema/config, safe synthetic public IDs/version hashes and metadata-only audit evidence. Distinguish native fixture browser coverage from these actual persisted writes. Do not include credentials, bodies or private patient data in general receipts.

## Rollback

Set only ARTICLE_ADMIN_ENABLED=false and verify --expect-migrated-disabled. Retain all six tables, coordination row, content/version/reference/audit history and migration record. Never roll down populated tables, delete later versions or rewind a published pointer. Historical recovery uses the ordinary copy-version-to-new-draft action.

If the new static panel causes a regression, restore the retained health image without altering the backend:

```powershell
if (Test-Path Env:CHECKUPINO_ADMIN_IMAGE) { throw 'Temporary image override already exists.' }
$env:CHECKUPINO_ADMIN_IMAGE = 'checkupino-admin:patient-health-accepted-2026-10-22'
try {
    docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps --no-build --pull never admin
    if ($LASTEXITCODE -ne 0) { throw 'Static rollback failed.' }
} finally {
    Remove-Item Env:CHECKUPINO_ADMIN_IMAGE -ErrorAction SilentlyContinue
}
```

Static-admin Compose remains delegated. Backend/database Compose remains operator-owned; no scanner/parser/worker activation or processing of the two existing medical jobs. Patient library URLs and reviewed recommendation activation remain separate scopes. The attended health and personally deferred profile save remain deferred.
