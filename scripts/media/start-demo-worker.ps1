param()

$ErrorActionPreference = 'Stop'
if ($args.Count -ne 0) { throw 'This project-scoped startup accepts no arguments.' }
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location -LiteralPath $taskRoot
try {
    & node scripts/media/verify-demo-worker-preflight.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Medical worker preflight failed; stop here.' }
    & docker compose --project-name checkupino_scan --file docker-compose.scan.yml --file docker-compose.scan-demo.yml --profile worker config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Worker Compose configuration failed.' }
    & docker compose --project-name checkupino_scan --file docker-compose.scan.yml --file docker-compose.scan-demo.yml --profile worker up -d --no-deps --no-build --pull never scan-worker
    if ($LASTEXITCODE -ne 0) { throw 'Idle medical worker startup failed.' }
    Write-Host 'PASS: idle medical worker started; no jobs requested.'
} finally {
    Pop-Location
}
