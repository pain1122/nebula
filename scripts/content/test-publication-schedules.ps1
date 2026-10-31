$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ((Get-Location).Path -ne $taskRoot) { throw 'Run from the Checkupino project root.' }

# Source tests only: no Compose, network, live environment/cache/storage or writable project mounts.
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
    'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746',
    'sh', '-c',
    'mkdir -p /tmp/checkupino-article-source/framework/cache /tmp/checkupino-article-source/framework/views /tmp/checkupino-article-source/framework/sessions /tmp/checkupino-article-source/logs; touch /tmp/checkupino-article-source/empty.environment; exec php vendor/bin/phpunit --do-not-cache-result tests/Feature/Api/ArticlePublicationScheduleTest.php tests/Unit/Content/ArticlePublicationTimeTest.php tests/Unit/Content/ArticleContentTest.php tests/Unit/Content/ArticleSeoTest.php tests/Feature/Api/ArticleDraftWriteTest.php tests/Feature/Api/ArticleEditorialTest.php tests/Feature/Api/ArticleAdministrationReadTest.php tests/Feature/Database/ArticleSchedulingMediaSchemaTest.php tests/Feature/Database/ArticleContentSchemaTest.php'
)
& docker @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Isolated article publication schedule gate failed.' }
Write-Host 'PASS: isolated article scheduling, exact-version delivery and legacy compatibility; no live operation or queued-job consumption.'
