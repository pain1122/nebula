param(
    [switch]$ActualEngine
)

$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskImage = 'sha256:a48b0c0b60fc1e5b59685dd0d6a6fece0aec8119b9b5f854dbd1f3f2497b3094'
$taskGroup = @('--exclude-group', 'medical-engine')
$taskSockets = @()
if ($ActualEngine) {
    # Refuse before creating any test container; never start/retry the scanner here.
    $taskScannerJson = & docker inspect checkupino_scan-scanner-1
    if ($LASTEXITCODE -ne 0) { throw 'Scanner inspection failed.' }
    $taskScanner = ($taskScannerJson | ConvertFrom-Json)[0]
    if (-not $taskScanner.State.Running -or $taskScanner.State.Health.Status -ne 'healthy' -or
        $taskScanner.Config.Image -ne 'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186') {
        throw 'Actual-engine worker acceptance waits for the pinned healthy scanner and prior engine checks.'
    }
    & node (Join-Path $taskRoot 'scripts/media/verify-content-runtime.mjs') --app-connected
    if ($LASTEXITCODE -ne 0) { throw 'Deployed content parser acceptance failed.' }
    $taskImage = 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746'
    $taskGroup = @('--group', 'medical-engine')
    $taskSockets = @(
        '--mount', 'type=volume,source=checkupino_scan_scan_socket,target=/run/medical-scan,readonly',
        '--mount', 'type=volume,source=checkupino_content_socket,target=/run/medical-content,readonly'
    )
}
& docker image inspect $taskImage --format '{{.Id}}'
if ($LASTEXITCODE -ne 0) { throw 'The accepted local image is required; no build/pull was attempted.' }
$taskArguments = @(
    'run', '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--init',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--user', '33:33',
    '--memory', '512m', '--memory-swap', '512m', '--cpus', '1.0', '--pids-limit', '32',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=256m,mode=1777',
    # Mask existing private bytes in the read-only source mount; tests use only /tmp/private roots.
    '--tmpfs', '/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--mount', "type=bind,source=$taskRoot,target=/var/www,readonly", '--workdir', '/var/www',
    '--env', 'CHECKUPINO_WORKER_REHEARSAL=true', '--env', 'APP_ENV=testing', '--env', 'APP_DEBUG=false',
    '--env', 'APP_KEY=base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
    '--env', 'DB_CONNECTION=sqlite', '--env', 'DB_DATABASE=:memory:', '--env', 'DB_URL=',
    '--env', 'CACHE_STORE=array', '--env', 'SESSION_DRIVER=array', '--env', 'MAIL_MAILER=array',
    '--env', 'LOG_CHANNEL=null', '--env', 'MEDICAL_SCAN_ENABLED=false', '--env', 'MEDICAL_STORAGE_DRIVER=local',
    '--env', 'MEDICAL_LOCAL_STORAGE_ROOT=', '--env', 'LARAVEL_STORAGE_PATH=/tmp/checkupino-worker-tests',
    '--env', 'APP_CONFIG_CACHE=/tmp/checkupino-worker-tests/config.php',
    '--env', 'VIEW_COMPILED_PATH=/tmp/checkupino-worker-tests/framework/views',
    '--env', ('MEDICAL_SCANNER_INTEGRATION=' + $ActualEngine.IsPresent.ToString().ToLowerInvariant())
)
$taskArguments += $taskSockets
$taskCommand = 'mkdir -p /tmp/checkupino-worker-tests/framework/cache /tmp/checkupino-worker-tests/framework/sessions /tmp/checkupino-worker-tests/framework/views /tmp/checkupino-worker-tests/logs && exec php vendor/bin/phpunit --do-not-cache-result ' + ($taskGroup -join ' ') + ' tests/Feature/Services/MedicalWorkerRuntimeTest.php'
$taskArguments += @($taskImage, 'sh', '-c', $taskCommand)
Write-Output 'One delivery per child worker; synthetic SQLite/tmpfs only; no live queue or Compose operations.'
& docker @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Isolated medical worker acceptance failed; live processing stays disabled.' }
