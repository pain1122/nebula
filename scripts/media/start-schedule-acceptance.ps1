param([switch]$RecreateDisposable, [switch]$RemoveDisposable)

$ErrorActionPreference = 'Stop'
if ($args.Count -ne 0) { throw 'No arguments or project overrides accepted.' }
if ($RecreateDisposable -and $RemoveDisposable) { throw 'Choose recreation or removal, never both.' }
$taskExisting = $RecreateDisposable -or $RemoveDisposable
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskProject = 'checkupino_schedule_acceptance'
if (Test-Path Env:CHECKUPINO_SCHEDULE_ACCEPTANCE_PASSWORD) { throw 'Temporary password variable already exists; leave it unchanged.' }
$taskMembers = @(& docker ps -a --filter "label=com.docker.compose.project=$taskProject" --format '{{.Names}}')
if ($LASTEXITCODE -ne 0) { throw 'Project inspection failed.' }
if (-not $taskExisting -and $taskMembers.Count -ne 0) { throw 'Acceptance project must be absent; no existing database is reused, reset or removed.' }
$taskNames = @(& docker ps -a --format '{{.Names}}')
if ($LASTEXITCODE -ne 0 -or (-not $taskExisting -and $taskNames -contains 'checkupino_schedule_acceptance-mysql-acceptance-1')) { throw 'Container-name collision; stop here.' }
$taskNetworks = @(& docker network ls --format '{{.Name}}')
if ($LASTEXITCODE -ne 0 -or (-not $taskExisting -and $taskNetworks -contains 'checkupino_schedule_acceptance_acceptance')) { throw 'Acceptance network must be absent; nothing removed.' }
if ($taskExisting) {
    # Reject live projects, durable data, extra clients, unhealthy/OOM runtimes,
    # changed pins/ownership/security/limits before removing this tmpfs service.
    $taskGuard = @'
import {spawnSync} from 'node:child_process';
import {admitScheduleDatabase,scheduleScope as s} from './scripts/media/schedule-acceptance-guard.mjs';
const go=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('Inspection failed');return r.stdout;};
const db=JSON.parse(go(['inspect',s.container,'--format','{{json .}}']));
const net=JSON.parse(go(['network','inspect',s.network,'--format','{{json .}}']));
const members=go(['ps','-a','--filter','label=com.docker.compose.project='+s.project,'--format','{{.Names}}']).trim().split(/\r?\n/);
admitScheduleDatabase(db,net,members);
console.log('PASS: only the healthy pinned internal tmpfs-only acceptance project may be recreated or removed.');
'@
    Push-Location $taskRoot
    try {
        $taskGuard | & node --input-type=module
        if ($LASTEXITCODE -ne 0) { throw 'Disposable recreation ownership/isolation guard failed; nothing removed.' }
    } finally { Pop-Location }
}
& docker image inspect sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b --format '{{.Id}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Pinned local MySQL image missing; no pull or build attempted.' }
$env:CHECKUPINO_SCHEDULE_ACCEPTANCE_PASSWORD = [guid]::NewGuid().ToString('N')
$taskCompose = @('--project-directory', $taskRoot, '--project-name', $taskProject, '--file', (Join-Path $taskRoot 'docker-compose.schedule-acceptance.yml'))
try {
    & docker compose @taskCompose config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Disposable configuration failed; stop here.' }
    if ($taskExisting) {
        & docker compose @taskCompose down
        if ($LASTEXITCODE -ne 0) { throw 'Disposable removal failed; no automatic retry.' }
    }
    if ($RemoveDisposable) {
        Write-Output 'PASS: only the verified disposable schedule project removed; no Docker volume deletion or live project operation.'
        return
    }
    & docker compose @taskCompose up -d --no-deps --no-build --pull never mysql-acceptance
    if ($LASTEXITCODE -ne 0) { throw 'Disposable startup failed; stop here. No automatic retry or cleanup.' }
    Write-Output 'PASS: disposable schedule MySQL startup requested. Health/isolation and empty-schema checks are still required; no test or live job has run.'
} finally {
    Remove-Item Env:CHECKUPINO_SCHEDULE_ACCEPTANCE_PASSWORD -ErrorAction SilentlyContinue
}
