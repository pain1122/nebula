$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ((Get-Location).Path -ne $taskRoot) { throw 'Run from the Checkupino project root.' }

# Disposable process only: no Compose, network, project environment, writable source or live DB.
$taskArguments = @(
    'run', '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--init', '--user', '33:33',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    '--memory', '512m', '--memory-swap', '512m', '--cpus', '1', '--pids-limit', '32',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
    '--tmpfs', '/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--mount', "type=bind,source=$taskRoot,target=/var/www,readonly", '--workdir', '/var/www',
    '--env', 'APP_ENV=testing', '--env', 'APP_DEBUG=false',
    '--env', 'DB_CONNECTION=sqlite', '--env', 'DB_DATABASE=:memory:', '--env', 'DB_URL=', '--env', 'DB_SOCKET=',
    '--env', 'CACHE_STORE=array', '--env', 'SESSION_DRIVER=array', '--env', 'MAIL_MAILER=array', '--env', 'LOG_CHANNEL=null',
    '--env', 'MEDICAL_SCAN_ENABLED=false', '--env', 'MEDICAL_STORAGE_DRIVER=local', '--env', 'BCRYPT_ROUNDS=4',
    '--env', 'LARAVEL_STORAGE_PATH=/tmp/checkupino-health-source',
    '--env', 'APP_CONFIG_CACHE=/tmp/checkupino-health-source/config.php',
    '--env', 'APP_ROUTES_CACHE=/tmp/checkupino-health-source/routes.php',
    '--env', 'VIEW_COMPILED_PATH=/tmp/checkupino-health-source/framework/views',
    'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746',
    'sh', '-c',
    'mkdir -p /tmp/checkupino-health-source/framework/cache /tmp/checkupino-health-source/framework/views /tmp/checkupino-health-source/framework/sessions /tmp/checkupino-health-source/logs; touch /tmp/checkupino-health-source/empty.environment; exec php vendor/bin/phpunit --do-not-cache-result tests/Feature/Api/PatientHealthProfileTest.php'
)
& docker @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Isolated patient health source gate failed.' }
Write-Host 'PASS: isolated patient health source tests; no live schema, data, environment or job operation.'
