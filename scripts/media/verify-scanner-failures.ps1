$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskScannerJson = & docker inspect checkupino_scan-scanner-1
if ($LASTEXITCODE -ne 0) { throw 'Scanner inspection failed; no startup attempted.' }
$taskScanner = ($taskScannerJson | ConvertFrom-Json)[0]
if (-not $taskScanner.State.Running -or $taskScanner.State.Health.Status -ne 'healthy' -or
    $taskScanner.RestartCount -ne 0 -or $taskScanner.HostConfig.RestartPolicy.Name -ne 'no' -or
    $taskScanner.Config.Image -ne 'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186') {
    throw 'Runtime failure probes require the preserved pinned healthy scanner; no retry attempted.'
}
$taskImage = 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746'
& docker image inspect $taskImage --format '{{.Id}}'
if ($LASTEXITCODE -ne 0) { throw 'Accepted local PHP image is required; no pull/build attempted.' }
$taskArguments = @(
    'run', '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--init',
    '--user', '33:33', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    '--memory', '256m', '--memory-swap', '256m', '--cpus', '0.5', '--pids-limit', '8',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777',
    '--tmpfs', '/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--mount', "type=bind,source=$taskRoot,target=/var/www,readonly",
    '--mount', 'type=volume,source=checkupino_scan_scan_socket,target=/run/medical-scan,readonly',
    '--workdir', '/var/www', '--env', 'CHECKUPINO_SCANNER_FAILURE_REHEARSAL=true',
    '--env', 'APP_ENV=testing', '--env', 'APP_DEBUG=false',
    '--env', 'APP_KEY=base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
    '--env', 'DB_CONNECTION=sqlite', '--env', 'DB_DATABASE=:memory:', '--env', 'DB_URL=',
    '--env', 'CACHE_STORE=array', '--env', 'SESSION_DRIVER=array', '--env', 'MAIL_MAILER=array',
    '--env', 'LOG_CHANNEL=null', '--env', 'MEDICAL_SCAN_ENABLED=false',
    '--env', 'MEDICAL_STORAGE_DRIVER=local', '--env', 'MEDICAL_LOCAL_STORAGE_ROOT=/tmp/scanner-failures/private',
    '--env', 'LARAVEL_STORAGE_PATH=/tmp/scanner-failures',
    '--env', 'APP_CONFIG_CACHE=/tmp/scanner-failures/config.php',
    '--env', 'VIEW_COMPILED_PATH=/tmp/scanner-failures/framework/views',
    '--env', 'CHECKUPINO_SCANNER_TEST_CLOCK_OFFSET=0',
    $taskImage, 'php', 'scripts/media/probe-scanner-failures.php'
)
Write-Output 'Synthetic memory-only scanner failure probes; no network, database/queue, definitions or Compose changes.'
$taskProbeOutput = & docker @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Scanner failure rehearsal failed; live scanning remains disabled.' }
try {
    $taskProbeEvidence = ($taskProbeOutput -join "`n") | ConvertFrom-Json -ErrorAction Stop
    if ($taskProbeEvidence.acceptance -ne 'passed' -or $taskProbeEvidence.engine_version -ne '1.5.4' -or
        -not $taskProbeEvidence.checks.initial_clean_eicar -or -not $taskProbeEvidence.checks.final_recovery_clean_eicar -or
        -not $taskProbeEvidence.checks.error_gateway.real_engine_error_observed -or
        -not $taskProbeEvidence.checks.timeout_gateway.real_clean_reply_before_injected_delay -or
        -not $taskProbeEvidence.checks.real_version_rejected_by_injected_stale_clock.rejected -or
        -not $taskProbeEvidence.checks.real_version_rejected_by_injected_future_clock.rejected -or
        -not $taskProbeEvidence.checks.unavailable_socket.rejected) {
        throw 'Missing completed failure checks.'
    }
} catch {
    throw 'Failure probe did not produce completed acceptance evidence; an exit code alone is insufficient.'
}
$taskProbeOutput | Write-Output

# A separate daemon uses only the pinned image's bundled old definitions. No live volumes.
$taskStaleArguments = @(
    'run', '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--init',
    '--user', '100:100', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    '--memory', '4g', '--memory-swap', '4g', '--cpus', '1', '--pids-limit', '16',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777',
    '--tmpfs', '/run/medical-scan:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=100,gid=100',
    '--mount', "type=bind,source=$taskRoot/docker/medical-scan/clamd.conf,target=/etc/clamav/clamd.conf,readonly",
    '--entrypoint', '/bin/sh',
    'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186',
    '-c', 'exec timeout 15s clamd --foreground --config-file=/etc/clamav/clamd.conf'
)
$taskPriorPreference = $ErrorActionPreference
try {
    # Native stderr is expected here; capture it for the explicit refusal assertion.
    $ErrorActionPreference = 'Continue'
    $taskStaleOutput = & docker @taskStaleArguments 2>&1
    $taskStaleExit = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $taskPriorPreference
}
$taskStaleText = ($taskStaleOutput | ForEach-Object { $_.ToString() }) -join "`n"
if ($taskStaleExit -ne 1 -or $taskStaleText -notmatch 'Virus database is older than 2 days') {
    throw 'Bundled-definition daemon must refuse startup explicitly; timeout or another error is not acceptance.'
}
Write-Output 'PASS: disposable daemon refuses genuinely stale bundled definitions (exit 1); no live volumes or network.'
