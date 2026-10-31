param([switch]$ApplyExactMigration)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ((Get-Location).Path -ne $taskRoot) { throw 'Run from the Checkupino project root.' }
$taskMigration = 'database/migrations/2026_10_23_000001_create_article_scheduling_media_tables.php'
if ((Get-FileHash -LiteralPath (Join-Path $taskRoot $taskMigration) -Algorithm SHA256).Hash.ToLowerInvariant() -ne '5fb1a8ff1866e15c89d1f008f5fd225c7258442b5b08ac2f39d4dae3ca88fc49') { throw 'Approved migration source changed; inspect before proceeding.' }
$taskImage = docker inspect --format '{{.Image}} {{.State.Status}}' checkupino_app
if ($LASTEXITCODE -ne 0 -or $taskImage.Trim() -ne 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746 running') { throw 'Existing application pin or state changed.' }
docker exec --user 33:33 --workdir /var/www checkupino_app php scripts/content/inspect-media-activation.php --expect-unmigrated
if ($LASTEXITCODE -ne 0) { throw 'Exact extension preflight refused; no migration requested.' }
if (-not $ApplyExactMigration) {
    Write-Host 'PASS: read-only preflight; live migration and feature activation require separate explicit authorization.'
    exit 0
}
# Run only after the separately reviewed live activation authorization. Never migrate all paths.
docker exec --user 33:33 --workdir /var/www checkupino_app php artisan migrate --path=database/migrations/2026_10_23_000001_create_article_scheduling_media_tables.php --force --no-interaction
if ($LASTEXITCODE -ne 0) { throw 'Exact migration failed; stop and inspect partial schema. Do not reset or retry blindly.' }
docker exec --user 33:33 --workdir /var/www checkupino_app php scripts/content/inspect-media-activation.php --expect-migrated-disabled
if ($LASTEXITCODE -ne 0) { throw 'Post-migration disabled-stage verification failed; stop here.' }
Write-Host 'PASS: exact extension installed with media and scheduled publication still disabled; populated history must be retained on rollback.'
