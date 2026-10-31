param([switch]$Sustained)

$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskRuntimeJson = & docker inspect checkupino_scan-scanner-1 checkupino_content-content-parser-1
if ($LASTEXITCODE -ne 0) { throw 'Scanner/parser inspection failed; no startup attempted.' }
$taskRuntime = $taskRuntimeJson | ConvertFrom-Json
$taskScanner = $taskRuntime | Where-Object Name -EQ '/checkupino_scan-scanner-1'
$taskParser = $taskRuntime | Where-Object Name -EQ '/checkupino_content-content-parser-1'
if (-not $taskScanner.State.Running -or $taskScanner.State.Health.Status -ne 'healthy' -or
    $taskScanner.RestartCount -ne 0 -or $taskScanner.HostConfig.RestartPolicy.Name -ne 'no' -or
    $taskScanner.Config.Image -ne 'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186' -or
    -not $taskParser.State.Running -or $taskParser.RestartCount -ne 0 -or
    $taskParser.Image -ne 'sha256:c4809fae4ab094ce353a28995fac698355ada6eab92f10e18ad874da2d2bbf4c') {
    throw 'Capacity probe requires the preserved healthy scanner and pinned parser; no recovery/retry attempted.'
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
    '--workdir', '/var/www', '--env', 'CHECKUPINO_SCANNER_CAPACITY_REHEARSAL=true',
    '--env', 'APP_ENV=testing', '--env', 'APP_DEBUG=false',
    '--env', 'APP_KEY=base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
    '--env', 'DB_CONNECTION=sqlite', '--env', 'DB_DATABASE=:memory:', '--env', 'DB_URL=',
    '--env', 'CACHE_STORE=array', '--env', 'SESSION_DRIVER=array', '--env', 'MAIL_MAILER=array',
    '--env', 'LOG_CHANNEL=null', '--env', 'MEDICAL_SCAN_ENABLED=false',
    '--env', 'MEDICAL_STORAGE_DRIVER=local', '--env', 'MEDICAL_LOCAL_STORAGE_ROOT=/tmp/scanner-capacity/private',
    '--env', 'LARAVEL_STORAGE_PATH=/tmp/scanner-capacity',
    '--env', 'APP_CONFIG_CACHE=/tmp/scanner-capacity/config.php',
    '--env', 'VIEW_COMPILED_PATH=/tmp/scanner-capacity/framework/views',
    $taskImage, 'php', 'scripts/media/probe-scanner-capacity.php'
)
if ($Sustained) { $taskArguments += '--sustained' }
Write-Output 'Bounded 1 MiB synthetic concurrent reads/scans/remote parsing; no network, live database, queues or Compose changes.'
$taskOutput = & docker @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Scanner capacity rehearsal failed; standing worker/live scanning remain unaccepted.' }
try {
    $taskEvidence = ($taskOutput -join "`n") | ConvertFrom-Json -ErrorAction Stop
    $taskExpectedCases = if ($Sustained) { 1 } else { 3 }
    if ($taskEvidence.acceptance -ne 'passed' -or $taskEvidence.cases.Count -ne $taskExpectedCases -or
        $taskEvidence.fixture_bytes -ne 1048576 -or
        -not $taskEvidence.verified_snapshot_immutable_and_new_tampered_read_rejected) {
        throw 'Missing completed capacity checks.'
    }
    if ($Sustained -and ($taskEvidence.workload -ne 'paced_30_second_repetition' -or
        $taskEvidence.cases[0].rounds -lt 5 -or $taskEvidence.cases[0].rounds -gt 64 -or
        $taskEvidence.cases[0].wall_seconds -lt 30 -or $taskEvidence.cases[0].blocked -ne 0 -or
        $taskEvidence.cases[0].accepted -ne (4 * $taskEvidence.cases[0].rounds))) {
        throw 'Missing completed repeated-workload evidence.'
    }
} catch {
    throw 'Capacity probe did not produce completed acceptance evidence; live scanning remains disabled.'
}
$taskOutput | Write-Output
