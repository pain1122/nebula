param([string]$Image = 'nebula-app:clean')
$ErrorActionPreference = 'Stop'
if ($Image -notmatch '^(nebula-app:clean|sha256:[a-f0-9]{64})$') { throw 'Use the local Nebula runtime or an explicit installed image digest.' }
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskImageId = & docker image inspect $Image --format '{{.Id}}'
if ($LASTEXITCODE -ne 0 -or $taskImageId -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Build/load the local PHP runtime first; this gate never pulls images.' }
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
    '--env', 'LARAVEL_STORAGE_PATH=/tmp/checkupino-article-source',
    '--env', 'APP_CONFIG_CACHE=/tmp/checkupino-article-source/config.php',
    '--env', 'APP_ROUTES_CACHE=/tmp/checkupino-article-source/routes.php',
    '--env', 'VIEW_COMPILED_PATH=/tmp/checkupino-article-source/framework/views',
    $taskImageId, 'sh', '-c',
    'mkdir -p /tmp/checkupino-article-source/framework/cache /tmp/checkupino-article-source/framework/views /tmp/checkupino-article-source/framework/sessions /tmp/checkupino-article-source/logs; touch /tmp/checkupino-article-source/empty.environment; exec php vendor/bin/phpunit --do-not-cache-result tests/Feature/Api/PatientArticleReadTest.php tests/Feature/Api/ArticleMediaTest.php tests/Feature/Api/ArticleAdministrationReadTest.php tests/Feature/Database/MarketplaceSeederTest.php'
)
& docker @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Isolated patient/article/media reader tests failed.' }
Write-Host 'PASS: isolated patient publication, media and retained staff reader boundaries; no live writes or scanner acceptance claim.'
