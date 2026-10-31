# Bounded concurrent scan/read acceptance and isolated MySQL stage

October 9, 2026, Asia/Tehran. The current scanner/parser remain healthy. This slice accepts a small concurrent synthetic PDF workload and two isolated MySQL service-race cases after operator recovery of the disposable database. Live environment, limits, storage, schema, queues and UI are unchanged.

Latest follow-up: operator-only disposable cleanup is verified complete; twelve required services/history/integrity/quarantine remain intact. A new optional paced 30-second mode accepts 240 operations with zero failures. Parser-only restart is prepared, not executed. [Current repeated-workload evidence and next command](medical-sustained-capacity-2026-10-09.md) supersedes cleanup-pending notes below; original measurements/evidence remain historical.

## Accepted scan/read workload

The optional capacity runner uses the preserved PHP image, UID 33, read-only source/root/sockets, no capabilities, no-new-privileges, no network, 512 MiB memory with no extra swap, one CPU, 16 PIDs and 96 MiB tmpfs. Live private storage is masked. Parent/children skip project environment/cache; models are explicitly unsaved and no database/schema/queue is initialized. Only a canonical synthetic exact **1 MiB PDF** is written inside owned tmpfs.

Children wait at a shared barrier before opening independent `VerifiedPrivateFile` snapshots. Scan tasks use the production adapter against real fresh ClamAV, verify the synthetic digest, then require remote qpdf 12.4.2 validation. Read tasks verify every byte/digest. The one/two-scan cases require all operations to pass; the four-scan burst permits only recognized blocked/redacted scan/parser errors and always requires all reads to pass. No retry loop or concurrency setting change is made.

| Synchronized workload | Accepted | Blocked | Wall time |
| --- | ---: | ---: | ---: |
| 1 scan/parse + 2 verified reads | 3 | 0 | 0.091 s |
| 2 scans/parses + 2 verified reads | 4 | 0 | 0.132 s |
| 4 scans/parses + 4 verified reads | 8 | 0 | 0.210 s |

Baseline scan/parse is 0.090 s, recovery 0.072 s; individual scan/parse times in the largest burst are 0.119/0.141/0.162/0.198 s. Parent PHP peak is 32 MiB, not aggregate container/child memory. These are single-run observations of a simple PDF on this laptop, not throughput/SLO guarantees or video/ZIP/10 MiB/sustained-load acceptance. Application/engine limits are unchanged.

An already verified snapshot stays immutable when its synthetic source is altered; a fresh read rejects the altered source. Restoring only that temporary fixture permits real scan/parser recovery; final clean/EICAR/freshness probe passes. All temporary children/files/containers are removed. Readonly existing attachment/private integrity/protected/settings/booking/payment/outbox/audit checks pass: one request open, one file quarantined/unscanned, zero jobs/reports, scanning false/private local. Twelve required containers remain, no standing worker.

The initial externally padded fixture failed strict remote validation and is not counted as acceptance. The final fixture constructs exact bytes inside a PDF stream, with no validator relaxation. That failed run exposed a runner problem: Laravel may display an exception with exit zero. Capacity now requires completed JSON evidence and explicitly exits nonzero on post-bootstrap exceptions. The existing failure wrapper also requires structured completion and re-passes all failure/stale-daemon probes; its earlier source-hash evidence remains historical. PHP syntax/Pint (two new probes), JS/PowerShell parsing and unsafe ordinary-app execution guards pass.

Repeat the accepted scan/read workload only when a relevant change needs it:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-scanner-capacity.ps1
```

## Isolated MySQL race stage — accepted

The operator completed guarded recreation with a 1 GiB/no-extra-swap cap. Exact image, UID, project, internal-only network, tmpfs/mount/port/resource restrictions and healthy state passed before the single guarded race run. The database remains healthy afterward, no OOM/zero restarts. The temporary PHP client was removed; only the disposable MySQL remains on its network. Earlier initialization-failure/recovery notes below are retained as history.

| Bounded service workload | Accepted | Blocked | Wall time |
| --- | ---: | ---: | ---: |
| Same patient, last 1 MiB allowance, two writers | 1 | 1 | 0.950 s |
| Different patients, two shared slots, two writers | 2 | 0 | 1.353 s |

The same-owner loser was rejected as `capacity_busy` by owner admission, not as a demonstrated simultaneous transactional quota conflict. A subsequent upload separately rejected the committed exhausted quota. File/audit/private blob counts agree after each case; all three exact 1 MiB PDF files remain quarantined/unscanned with verified integrity. Zero owned admission locks remain, zero medical jobs were dispatched, and the complete unrelated default-queue sentinel row is unchanged. Only the named, verified-empty disposable schema was initialized and synthetic roles seeded; no live migrations, queues or data were used.

Readonly live attachment/history/private integrity/quarantine and upload-admission rechecks pass. Twelve required services still run plus one disposable test database; no standing worker/live scanning activation. This accepts only two bounded service-writer cases, not HTTP/CSRF, sustained load, crash cleanup, large videos/ZIP or deployment restart/update-outage recovery. [Actual race evidence](evidence/medical-upload-races-2026-10-09.json) records results and source hashes. Do not rerun the migration harness against this now-used database.

### Operator cleanup — completed, historical commands

Evidence is retained. The operator completed this scoped cleanup, and container/network absence plus live safeguards now pass. This block is historical; do not replay it:

```powershell
if (Test-Path Env:CHECKUPINO_MEDICAL_ACCEPTANCE_PASSWORD) { throw 'Temporary variable already exists; leave it unchanged.' }
$env:CHECKUPINO_MEDICAL_ACCEPTANCE_PASSWORD = [guid]::NewGuid().ToString('N')
try {
    docker compose --project-name checkupino_medical_acceptance --file docker-compose.medical-acceptance.yml down
    if ($LASTEXITCODE -ne 0) { throw 'Disposable cleanup failed; stop here.' }
    Write-Output 'PASS: disposable acceptance project removed.'
} finally {
    Remove-Item Env:CHECKUPINO_MEDICAL_ACCEPTANCE_PASSWORD -ErrorAction SilentlyContinue
}
```

The temporary interpolation value is unused for authentication and does not replace credentials. No volume-removal/orphan/prune/main-project flags are used. Verify afterward that the disposable container/network are absent and required live services/history still pass. Continue bounded capacity/deployment recovery prerequisites before any standing-worker/live activation.

### Operator result and bounded recovery

The operator repeated the capacity runner successfully: exact 1 MiB, all 3/4/8 operations accepted, zero blocked; wall times 0.081/0.132/0.201 s, baseline 0.089 s and recovery 0.067 s. Snapshot/tamper guard passed; parent PHP peak 32 MiB. This separate repeat does not replace the original measurements above.

Operator Compose validation/startup succeeded, but Docker inspection shows the disposable MySQL exited 1 with **OOMKilled=true**, zero restarts, at 17:38:41 UTC (21:08:41 Tehran), during initialization under the original 512 MiB/no-extra-swap cap. Filtered initialization messages show database-file initialization completed; they do not establish successful server startup or identify peak memory. No race test, schema migration or synthetic seeding ran. The verifier rejects this stopped container before creating a test client. Twelve required live services still run; readonly existing attachment/history/integrity/quarantine checks pass.

Only the disposable database cap is raised to **1 GiB**, with no extra swap; its 512 MiB data tmpfs, image, UID, network and other restrictions stay intact. Tmpfs data and MySQL process memory share the container budget. The new cap subsequently passed the bounded runtime above. The JS verifier also requires the exact memory/swap/CPU/PID/tmpfs bounds.

The optional recovery script checks exact pinned identity, stopped/OOM state, original 512 MiB cap, project membership, no mounts/ports, and internal network ownership with no unrelated attached containers. Its `-InspectOnly` mode passes against this recorded failure without mutations. PowerShell parsing, Node syntax and read-only YAML resource/isolation checks pass. Original evidence remains point-in-time; [recovery evidence](evidence/medical-mysql-recovery-2026-10-09.json) records this later checkpoint.

Historical recovery command, now completed; do not repeat against the healthy accepted database:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/recover-upload-race-db.ps1
```

It validates Compose quietly, removes only the inspected disposable project, generates a fresh temporary password, and recreates its one service with no build/pull/dependencies. No live project, durable volume or main .env is changed. It clears its temporary shell variable and refuses if that variable already exists. It is specifically for this recorded OOM container, not a general reset/retry tool. Do not run the earlier startup block again against the failed container. After the operator result, inspect health and isolation before running the empty-schema-only race verifier once; if another failure occurs, retain evidence and diagnose before another attempt.

`docker-compose.medical-acceptance.yml` uses the exact already-installed MySQL 8.0.46 image `sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`. The dedicated `checkupino_medical_acceptance` project has one UID-999, read-only service, no capabilities/ports/host/live-volume mounts, a private internal network, bounded resources, restart=no and tmpfs-only data. Source isolation checks pass via www-data YAML parsing. Operator supplies a temporary GUID password in their shell; main .env and live credentials are unchanged. Initialization generates a separate root password; verifier outputs omit credentials and raw initialization logs.

`node scripts/media/verify-upload-races.mjs` refuses wrong image/project/service/user/mount/network/health/credentials before creating its restricted test client. The client can reach only the acceptance network, has masked live private bytes, synthetic environment and no scanner/parser sockets. The PHP parent checks the exact database identity/version and refuses any existing tables before migrations and synthetic roles. It never resets/reseeds a used database. Parent and independent child processes skip project .env, whitelist synthetic connection settings and preserve a default-queue sentinel.

Two synchronized writers raced the same patient's last 1 MiB allowance (exactly one commit), then different patients through two shared slots (two commits). Ordinary service authorization, private staging, file/audit atomicity, quarantine, subsequent quota recheck, checksum integrity, no extra blobs, zero medical jobs and owned-lock cleanup passed. These are service-level cases, not HTTP/CSRF, sustained peak load or crash-reconciliation acceptance. Source syntax/Pint/early unsafe-context gates passed before runtime.

Historical initial startup command, superseded by completed recovery and acceptance; do not replay:

```powershell
if (Test-Path Env:CHECKUPINO_MEDICAL_ACCEPTANCE_PASSWORD) { throw 'Temporary variable already exists; leave it unchanged.' }
$env:CHECKUPINO_MEDICAL_ACCEPTANCE_PASSWORD = [guid]::NewGuid().ToString('N')
try {
    docker compose --project-name checkupino_medical_acceptance --file docker-compose.medical-acceptance.yml config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Acceptance configuration failed; stop here.' }
    docker compose --project-name checkupino_medical_acceptance --file docker-compose.medical-acceptance.yml up -d --no-deps --no-build --pull never mysql-acceptance
    if ($LASTEXITCODE -ne 0) { throw 'Acceptance MySQL startup failed; stop here.' }
    Write-Output 'PASS: isolated MySQL startup requested.'
} finally {
    Remove-Item Env:CHECKUPINO_MEDICAL_ACCEPTANCE_PASSWORD -ErrorAction SilentlyContinue
}
```

The guarded JS verifier ran once after health/isolation checks. It read the temporary password internally without displaying/persisting it. Earlier failure evidence is retained; do not rerun migration against this used test database. Operator-only cleanup is prepared above. Never use volume deletion, reset, main-project down or general workers.

## Recovery prerequisites and remaining work

Definition freshness and the working VPN route remain prerequisites; no scanner restart or extra download is needed for this slice. Any later app recreation must retain the content-client overlay. Remaining: disposable-project cleanup, sustained/peak uploads and larger files, deployment-level socket/restart/update-outage recovery, durable orphan reconciliation, standing-worker acceptance/live activation, multipart/File Manager/forms, questionnaire and rehearsal. No deployed restart or update-outage has been exercised. No independent human review is claimed.

Evidence: [capacity acceptance](evidence/medical-capacity-2026-10-09.json). Rollback is to stop using the optional probes and have the operator remove only the disposable acceptance project after retaining evidence. Preserve all live source safeguards, schema/history, volumes and pins.
