param()

$ErrorActionPreference = 'Stop'
if ($args.Count -ne 0) { throw 'This project-scoped activation accepts no arguments.' }
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location -LiteralPath $taskRoot
try {
    & node scripts/media/verify-demo-worker-preflight.mjs --worker-connected
    if ($LASTEXITCODE -ne 0) { throw 'Connected idle-worker preflight failed; stop here.' }
    & docker compose --project-name checkupino --file docker-compose.yml --file docker-compose.content-client.yml --file docker-compose.scan-producer.yml config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Producer Compose configuration failed.' }
    & docker compose --project-name checkupino --file docker-compose.yml --file docker-compose.content-client.yml --file docker-compose.scan-producer.yml up -d --no-deps --no-build --pull never app
    if ($LASTEXITCODE -ne 0) { throw 'Producer app recreation failed.' }
    & docker compose --project-name checkupino --file docker-compose.yml restart nginx
    if ($LASTEXITCODE -ne 0) { throw 'Nginx restart failed.' }
    Write-Host 'PASS: producer app activation requested; no upload or queue processing.'
} finally {
    Pop-Location
}
