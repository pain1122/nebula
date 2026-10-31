$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ((Get-Location).Path -ne $taskRoot) { throw 'Run from the Checkupino project root.' }
$taskScanner = docker inspect --format '{{.Image}} {{.State.Health.Status}}' checkupino_scan-scanner-1
if ($LASTEXITCODE -ne 0 -or $taskScanner.Trim() -ne 'sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186 healthy') { throw 'Accepted healthy scanner required; no startup attempted.' }
$taskParser = docker inspect --format '{{.Image}} {{.State.Status}}' checkupino_content-content-parser-1
if ($LASTEXITCODE -ne 0 -or $taskParser.Trim() -ne 'sha256:c4809fae4ab094ce353a28995fac698355ada6eab92f10e18ad874da2d2bbf4c running') { throw 'Accepted parser required; no startup attempted.' }
foreach ($taskVolume in @('checkupino_scan_scan_socket','checkupino_content_socket')) {
    docker volume inspect --format '{{.Name}}' $taskVolume | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Existing read-only socket volume required.' }
}
$taskArguments = @(
    'run','--rm','--pull','never','--network','none','--read-only','--init','--user','33:33',
    '--cap-drop','ALL','--security-opt','no-new-privileges:true',
    '--memory','768m','--memory-swap','768m','--cpus','1','--pids-limit','32',
    '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=256m,mode=1777',
    '--tmpfs','/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--tmpfs','/var/www/storage/app/article-media:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--mount',"type=bind,source=$taskRoot,target=/var/www,readonly",'--workdir','/var/www',
    '--mount','type=volume,source=checkupino_scan_scan_socket,target=/run/medical-scan,readonly',
    '--mount','type=volume,source=checkupino_content_socket,target=/run/medical-content,readonly',
    '--env','CHECKUPINO_SEED_RUNTIME=true','--env','APP_ENV=testing','--env','APP_DEBUG=false',
    '--env','DB_CONNECTION=sqlite','--env','DB_DATABASE=:memory:','--env','DB_URL=','--env','DB_SOCKET=',
    '--env','APP_KEY=base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
    '--env','CACHE_STORE=array','--env','SESSION_DRIVER=array','--env','QUEUE_CONNECTION=database',
    '--env','MAIL_MAILER=array','--env','LOG_CHANNEL=null','--env','BCRYPT_ROUNDS=4',
    '--env','MEDICAL_STORAGE_DRIVER=local','--env','ARTICLE_MEDIA_STORAGE_DRIVER=local',
    '--env','LARAVEL_STORAGE_PATH=/tmp/checkupino-seed-runtime',
    '--env','APP_CONFIG_CACHE=/tmp/checkupino-seed-runtime/config.php',
    '--env','APP_ROUTES_CACHE=/tmp/checkupino-seed-runtime/routes.php',
    '--env','VIEW_COMPILED_PATH=/tmp/checkupino-seed-runtime/framework/views',
    'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746','sh','-c',
    'mkdir -p /tmp/checkupino-seed-runtime/framework/cache /tmp/checkupino-seed-runtime/framework/views /tmp/checkupino-seed-runtime/framework/sessions /tmp/checkupino-seed-runtime/logs && touch /tmp/checkupino-seed-runtime/empty.environment && exec php scripts/demo/verify-populated-seeds.php'
)
$taskOutput = & docker @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Isolated populated seed verification failed; no current DB was used.' }
$taskResult = ($taskOutput -join "`n") | ConvertFrom-Json
if ($taskResult.execution -ne 'passed' -or $taskResult.driver -ne 'sqlite' -or -not $taskResult.repeat_exact_rows_preserved) { throw 'Unexpected seed result.' }
$taskResult | Add-Member -NotePropertyName checked_at -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
$taskSources = @{}
foreach ($taskPath in @('scripts/demo/verify-populated-seeds.php','database/seeders/VerifiedDemoMediaSeeder.php','database/seeders/ReservationPaymentDemoSeeder.php')) {
    $taskSources[$taskPath] = (Get-FileHash -Algorithm SHA256 -LiteralPath $taskPath).Hash.ToLowerInvariant()
}
$taskResult | Add-Member -NotePropertyName sources -NotePropertyValue $taskSources
$taskEvidence = Join-Path $taskRoot ('docs\deployment\evidence\fresh-populated-seeds-sqlite-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '.json')
$taskStream = [System.IO.File]::Open($taskEvidence, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
try {
    $taskBytes = [System.Text.UTF8Encoding]::new($false).GetBytes(($taskResult | ConvertTo-Json -Depth 8) + "`n")
    $taskStream.Write($taskBytes, 0, $taskBytes.Length)
} finally { $taskStream.Dispose() }
Write-Output ($taskResult | ConvertTo-Json -Compress -Depth 8)
