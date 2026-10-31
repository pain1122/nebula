param([switch]$InspectOnly)

$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskProject = 'checkupino_medical_acceptance'
$taskName = 'checkupino_medical_acceptance-mysql-acceptance-1'
$taskImage = 'sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b'
$taskRaw = & docker inspect $taskName --format '{{json .}}'
if ($LASTEXITCODE -ne 0) { throw 'Disposable container inspection failed; nothing changed.' }
$taskDb = $taskRaw | ConvertFrom-Json
if ($taskDb.Name -ne "/$taskName" -or $taskDb.Image -ne $taskImage -or
    $taskDb.Config.Labels.'com.docker.compose.project' -ne $taskProject -or
    $taskDb.Config.Labels.'com.docker.compose.service' -ne 'mysql-acceptance' -or
    $taskDb.State.Running -or -not $taskDb.State.OOMKilled -or $taskDb.RestartCount -ne 0 -or
    $taskDb.HostConfig.Memory -ne 536870912 -or $taskDb.HostConfig.MemorySwap -ne 536870912 -or
    $taskDb.Config.User -ne '999:999' -or -not $taskDb.HostConfig.ReadonlyRootfs -or
    $taskDb.HostConfig.Privileged -or $taskDb.HostConfig.RestartPolicy.Name -ne 'no' -or
    @($taskDb.HostConfig.CapDrop).Count -ne 1 -or $taskDb.HostConfig.CapDrop[0] -ne 'ALL' -or
    $taskDb.HostConfig.SecurityOpt -notcontains 'no-new-privileges:true' -or
    @($taskDb.Mounts).Count -ne 0 -or @($taskDb.HostConfig.PortBindings.PSObject.Properties).Count -ne 0 -or
    $taskDb.HostConfig.Tmpfs.'/var/lib/mysql' -ne 'size=512m,mode=0700,uid=999,gid=999') {
    throw 'Only the recorded stopped, OOM-killed, isolated 512 MiB test container may be recovered.'
}
$taskMembers = @(& docker ps -a --filter "label=com.docker.compose.project=$taskProject" --format '{{.Names}}')
if ($LASTEXITCODE -ne 0 -or $taskMembers.Count -ne 1 -or $taskMembers[0] -ne $taskName) {
    throw 'Unexpected acceptance-project membership; nothing changed.'
}
$taskNetworkName = 'checkupino_medical_acceptance_acceptance'
$taskDbNetworks = @($taskDb.NetworkSettings.Networks.PSObject.Properties.Name)
if ($taskDbNetworks.Count -ne 1 -or $taskDbNetworks[0] -ne $taskNetworkName) {
    throw 'Unexpected disposable database network; nothing changed.'
}
$taskNetworkRaw = & docker network inspect $taskNetworkName --format '{{json .}}'
if ($LASTEXITCODE -ne 0) { throw 'Acceptance network inspection failed; nothing changed.' }
$taskNetwork = $taskNetworkRaw | ConvertFrom-Json
$taskAttached = @($taskNetwork.Containers.PSObject.Properties | ForEach-Object { $_.Value.Name })
if (-not $taskNetwork.Internal -or $taskNetwork.Labels.'com.docker.compose.project' -ne $taskProject -or
    @($taskAttached | Where-Object { $_ -ne $taskName }).Count -ne 0) {
    throw 'Unexpected network ownership or attached containers; nothing changed.'
}
if ($InspectOnly) {
    Write-Output 'PASS: recorded disposable OOM failure and project/network isolation verified; no changes made.'
    return
}
if (Test-Path Env:CHECKUPINO_MEDICAL_ACCEPTANCE_PASSWORD) { throw 'Temporary variable already exists; leave it unchanged.' }
$env:CHECKUPINO_MEDICAL_ACCEPTANCE_PASSWORD = [guid]::NewGuid().ToString('N')
$taskCompose = @('--project-directory', $taskRoot, '--project-name', $taskProject, '--file', (Join-Path $taskRoot 'docker-compose.medical-acceptance.yml'))
try {
    & docker compose @taskCompose config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Acceptance configuration failed; stop here.' }
    # Only this inspected disposable project. No volume deletion or main-project operations.
    & docker compose @taskCompose down
    if ($LASTEXITCODE -ne 0) { throw 'Disposable project removal failed; stop here.' }
    & docker compose @taskCompose up -d --no-deps --no-build --pull never mysql-acceptance
    if ($LASTEXITCODE -ne 0) { throw 'Disposable MySQL startup failed; stop here.' }
    Write-Output 'PASS: isolated MySQL recreated with a 1 GiB cap and no extra swap; health verification is still required.'
} finally {
    Remove-Item Env:CHECKUPINO_MEDICAL_ACCEPTANCE_PASSWORD -ErrorAction SilentlyContinue
}
