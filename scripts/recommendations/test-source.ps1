param(
    [string]$Image = 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746',
    [switch]$WithArticleRegression
)
$ErrorActionPreference = 'Stop'
if ($Image -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Use an explicit installed PHP image digest.' }
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ((Get-Location).Path -ne $taskRoot) { throw 'Run from the Checkupino project root.' }
$taskImageId = docker image inspect $Image --format '{{.Id}}'
if ($LASTEXITCODE -ne 0 -or $taskImageId.Trim() -ne $Image) { throw 'Installed image required; no pull/build is attempted.' }
$taskRun = 'mkdir -p /tmp/checkupino-article-source/framework/cache /tmp/checkupino-article-source/framework/views /tmp/checkupino-article-source/framework/sessions /tmp/checkupino-article-source/logs && touch /tmp/checkupino-article-source/empty.environment && exec php vendor/bin/phpunit --do-not-cache-result tests/Feature/Database/RecommendationSchemaTest.php tests/Feature/Api/RecommendationTest.php tests/Unit/Recommendations/RulePredicateTest.php'
if ($WithArticleRegression) {
    $taskRun += ' tests/Feature/Api/PatientArticleReadTest.php tests/Feature/Api/ArticleAdministrationReadTest.php tests/Feature/Api/ArticleMediaTest.php'
}
$taskArguments = @(
    'run','--rm','--pull','never','--network','none','--read-only','--init','--user','33:33',
    '--cap-drop','ALL','--security-opt','no-new-privileges:true',
    '--memory','512m','--memory-swap','512m','--cpus','1','--pids-limit','32',
    '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
    '--tmpfs','/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--tmpfs','/var/www/storage/app/article-media:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--mount',"type=bind,source=$taskRoot,target=/var/www,readonly",'--workdir','/var/www',
    '--env','APP_ENV=testing','--env','APP_DEBUG=false',
    '--env','DB_CONNECTION=sqlite','--env','DB_DATABASE=:memory:','--env','DB_URL=','--env','DB_SOCKET=',
    '--env','CACHE_STORE=array','--env','SESSION_DRIVER=array','--env','MAIL_MAILER=array','--env','LOG_CHANNEL=null',
    '--env','MEDICAL_SCAN_ENABLED=false','--env','MEDICAL_STORAGE_DRIVER=local','--env','BCRYPT_ROUNDS=4',
    '--env','LARAVEL_STORAGE_PATH=/tmp/checkupino-article-source',
    '--env','APP_CONFIG_CACHE=/tmp/checkupino-article-source/config.php',
    '--env','APP_ROUTES_CACHE=/tmp/checkupino-article-source/routes.php',
    '--env','VIEW_COMPILED_PATH=/tmp/checkupino-article-source/framework/views',
    $Image,'sh','-c',
    $taskRun
)
& docker @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Isolated recommendation source gate failed.' }
if ($WithArticleRegression) {
    node scripts/recommendations/source-bindings.mjs --record-passed-php-gate
    if ($LASTEXITCODE -ne 0) { throw 'Source binding receipt failed.' }
}
Write-Host 'PASS: isolated recommendation source tests; no live schema, data, reviewer, deployment or rule activation.'
