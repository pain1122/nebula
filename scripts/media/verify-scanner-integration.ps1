$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskRaw = & docker inspect checkupino_scan-scanner-1 checkupino_content-content-parser-1
if ($LASTEXITCODE -ne 0) { throw 'Scanner/parser inspection failed; no startup attempted.' }
$taskRuntime = $taskRaw | ConvertFrom-Json
$taskScanner = $taskRuntime | Where-Object Name -EQ '/checkupino_scan-scanner-1'
$taskParser = $taskRuntime | Where-Object Name -EQ '/checkupino_content-content-parser-1'
if (-not $taskScanner.State.Running -or $taskScanner.State.Health.Status -ne 'healthy' -or
    $taskScanner.State.OOMKilled -or $taskScanner.RestartCount -ne 0 -or
    $taskScanner.HostConfig.RestartPolicy.Name -ne 'no' -or
    $taskScanner.Config.Image -ne 'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186' -or
    -not $taskParser.State.Running -or $taskParser.State.OOMKilled -or $taskParser.RestartCount -ne 0 -or
    $taskParser.Image -ne 'sha256:c4809fae4ab094ce353a28995fac698355ada6eab92f10e18ad874da2d2bbf4c') {
    throw 'Integration waits for pinned healthy scanner and recovered parser; no recovery attempted.'
}
$taskImage = 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746'
& docker image inspect $taskImage --format '{{.Id}}'
if ($LASTEXITCODE -ne 0) { throw 'Accepted local PHP image is required; no pull/build attempted.' }
$taskArguments = @(
    'run', '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--init',
    '--user', '33:33', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    '--memory', '512m', '--memory-swap', '512m', '--cpus', '1', '--pids-limit', '16',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
    '--tmpfs', '/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--mount', "type=bind,source=$taskRoot,target=/var/www,readonly",
    '--mount', 'type=volume,source=checkupino_scan_scan_socket,target=/run/medical-scan,readonly',
    '--mount', 'type=volume,source=checkupino_content_socket,target=/run/medical-content,readonly',
    '--workdir', '/var/www', '--env', 'CHECKUPINO_SCANNER_INTEGRATION_REHEARSAL=true',
    '--env', 'MEDICAL_SCANNER_INTEGRATION=true', '--env', 'APP_ENV=testing', '--env', 'APP_DEBUG=false',
    '--env', 'APP_KEY=base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
    '--env', 'DB_CONNECTION=sqlite', '--env', 'DB_DATABASE=:memory:', '--env', 'DB_URL=',
    '--env', 'CACHE_STORE=array', '--env', 'SESSION_DRIVER=array', '--env', 'MAIL_MAILER=array',
    '--env', 'LOG_CHANNEL=null', '--env', 'MEDICAL_SCAN_ENABLED=false', '--env', 'MEDICAL_STORAGE_DRIVER=local',
    '--env', 'MEDICAL_LOCAL_STORAGE_ROOT=', '--env', 'LARAVEL_STORAGE_PATH=/tmp/checkupino-scanner-integration',
    '--env', 'APP_CONFIG_CACHE=/tmp/checkupino-scanner-integration/config.php',
    '--env', 'VIEW_COMPILED_PATH=/tmp/checkupino-scanner-integration/framework/views'
)
$taskCommand = @'
umask 077
mkdir -p /tmp/checkupino-scanner-integration/framework/cache /tmp/checkupino-scanner-integration/framework/sessions /tmp/checkupino-scanner-integration/framework/views /tmp/checkupino-scanner-integration/logs &&
timeout 90s php vendor/bin/phpunit --do-not-cache-result --fail-on-skipped --fail-on-warning --fail-on-risky --log-junit /tmp/checkupino-scanner-integration/result.xml tests/Feature/Services/MedicalScannerIntegrationTest.php &&
php scripts/media/scanner-integration-summary.php
'@
$taskArguments += @($taskImage, 'sh', '-c', $taskCommand)
Write-Output 'Three guarded synthetic integration cases; no network/live database/queue/Compose or standing worker.'
$taskOutput = & docker @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Isolated scanner integration failed; no live processing accepted.' }
$taskLines = @($taskOutput | Where-Object { $_.StartsWith('SCANNER_INTEGRATION_EVIDENCE=') })
if ($taskLines.Count -ne 1) { throw 'Missing completed integration evidence; exit code alone is insufficient.' }
$taskEvidence = $taskLines[0].Substring('SCANNER_INTEGRATION_EVIDENCE='.Length) | ConvertFrom-Json
if ($taskEvidence.acceptance -ne 'passed' -or $taskEvidence.tests -ne 3 -or $taskEvidence.assertions -lt 17) {
    throw 'Incomplete integration acceptance.'
}
$taskOutput | Write-Output
