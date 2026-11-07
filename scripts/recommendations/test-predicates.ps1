$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ((Get-Location).Path -ne $taskRoot) { throw 'Run from the Checkupino project root.' }
$taskImage = 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746'
docker image inspect $taskImage --format '{{.Id}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Accepted PHP runtime required; this runner never builds or pulls.' }
$taskArguments = @(
    'run','--rm','--pull','never','--network','none','--read-only','--init','--user','33:33',
    '--cap-drop','ALL','--security-opt','no-new-privileges:true',
    '--memory','256m','--memory-swap','256m','--cpus','1','--pids-limit','16',
    '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=32m,mode=1777',
    '--tmpfs','/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--tmpfs','/var/www/storage/app/article-media:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--mount',"type=bind,source=$taskRoot,target=/var/www,readonly",'--workdir','/var/www',
    '--env','APP_ENV=testing','--env','DB_CONNECTION=sqlite','--env','DB_DATABASE=:memory:',
    '--env','DB_URL=','--env','DB_SOCKET=','--env','LOG_CHANNEL=null',
    '--env','APP_CONFIG_CACHE=/tmp/checkupino-predicate-config.php',
    $taskImage,'php','vendor/bin/phpunit','--no-configuration','--bootstrap','vendor/autoload.php',
    '--do-not-cache-result','tests/Unit/Recommendations/RulePredicateTest.php'
)
& docker @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Pure predicate tests failed; no application/database/clinical rule was activated.' }
Write-Host 'PASS: pure synthetic predicate tests; no Laravel bootstrap, database/network, patient lookup, schema or activation.'
