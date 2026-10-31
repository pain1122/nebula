# Bounded medical worker rehearsal and scanner recovery route

October 9 update: controlled operator startup after corrected TUN succeeds with official daily 28148 and healthy pinned 1.5.4; isolation and actual clean/EICAR probe pass. The prepared actual-worker mode now passes **2 tests/24 assertions** in 24.928 seconds, real scanner/remote qpdf/clean provenance and infected blocked download, preserving the default sentinel in disposable SQLite/tmpfs. Live quarantine/history/zero jobs/reports and scanning false/private local preserved; standing worker absent. Current readonly history verifier adds `--scanner-ready`. No startup retry remains pending; older route/commands below are historical. [Actual acceptance and remaining gates](medical-scanner-acceptance-2026-10-09.md).

October 8, 2026, Asia/Tehran. User authorizes planning and execution of the next scanner/worker slice. The existing scanner remains stopped after official HTTP 403; expiry of its cooldown does not establish access. This slice prepares upstream recovery and verifies cross-process worker behavior without touching the live queue or enabling scanning.

## Route and gates

1. Preserve the current backend/parser, images, definitions/cooldown and existing quarantined attachment. Readonly health, MySQL/Redis, admission, attachment integrity and protected/history checks remain the baseline.
2. Resolve the CDN refusal through supported upstream investigation. Rechecked official documentation lists 1.5.4 as the latest supported 1.5 patch and FreshClam/cvdupdate as supported update clients. Retained logs identify the October 7 403 and CF-Ray; existing metadata reports IR/FRA without proving a denial rule. The operator says open [issue #1851](https://github.com/Cisco-Talos/clamav/issues/1851) is probably from a previous chat. Prepare an update to that thread; no comment/ticket is sent by this session. [Sanitized follow-up draft](clamav-upstream-access-draft-2026-10-08.md).
3. Independently rehearse the real Laravel worker against disposable synthetic SQLite state and scripted Unix-socket scanner replies. Require a real remote qpdf parser for successful content release. This gate establishes bounded process/queue behavior, not an actual ClamAV verdict.
4. After a supported upstream resolution or a confirmed supported network correction, have the operator perform one scanner/check-only startup. Verify actual definitions, health, isolation and the clean/EICAR probe; stop on any new refusal and preserve the resulting cooldown. No loop, unofficial downloads, mirror/routing change or freshness bypass.
5. Run the separately guarded actual-engine worker rehearsal against disposable SQLite/tmpfs and read-only scanner/parser sockets. Accept live dedicated-worker runtime and any live scanning activation separately after remaining engine/failure/capacity checks. Never start the standing worker profile just to satisfy this rehearsal.

## What the rehearsal does

- `scripts/media/verify-medical-worker.ps1` uses an already-accepted exact image, UID 33, no network, read-only source/root, no capabilities, no-new-privileges, 512 MiB memory with no extra swap, one CPU, PID limit 32 and bounded tmpfs. It masks the source mount's live private-storage directory with empty tmpfs. No build, pull, Compose, long install or standing worker is required.
- `tests/Feature/Services/MedicalWorkerRuntimeTest.php` initializes only a guarded in-memory SQLite schema, creates synthetic fixtures through ordinary services, then snapshots into a random UID-owned mode-0700 `/tmp/checkupino-worker-*` directory. Parent and child inspect the same disposable database. A default-queue sentinel's entire row must remain unchanged.
- `tests/Fixtures/medical-worker-entry.php` refuses non-testing/non-SQLite configuration, any noncanonical directory/database/cache path, project configuration cache or a nonsynthetic key. It loads no project `.env`; the parent test also avoids project `.env`. The child environment is cleared and reconstructed from synthetic values. Each child runs exactly `queue:work medical-scan --queue=medical-scan --once --sleep=0 --tries=3 --timeout=120 --memory=128`, with an outer process deadline (20 seconds for protocol rehearsal; 125 for actual-engine mode).
- Clean acceptance crosses the encrypted queue, actual child worker, checksum-bound scanner adapter and actual parser socket/native qpdf checks. A second delivery must be harmless with no scanner contact or duplicate scan audit. The unavailable-engine case verifies the actual 15-second first backoff, waits for it and then succeeds through the same encrypted job after fixture recovery.
- Scripted infected, engine-error, stale-definition, bounded-timeout and missing-parser cases verify blocked access and correct terminal/retry/audit behavior. The exhausted-attempt case uses an explicitly labelled synthetic queue fixture with two earlier attempts; it verifies failed delivery and redaction. No live queue row is edited, and no manual clean/paid/completed state is assigned.
- Child processes and random directories are removed; all new schema/fixture/queue/audit writes disappear with container tmpfs. Neither protected accounts nor existing clinical records are test fixtures.

## Verification

Final hardened rehearsal passes **8 tests / 151 assertions**, no skips, in **79.008 seconds**, peak PHP memory **52.50 MiB**. Pint passes both new PHP files. Actual-engine mode correctly refuses the stopped scanner before creating a test container. Readonly existing attachment/protected/history, admission and deployed parser/app remote-validation checks pass. Evidence: `evidence/medical-worker-rehearsal-2026-10-08.json`. Actual-engine tests are prepared but have not run.

Repeat the source/protocol rehearsal from the project directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-medical-worker.ps1
```

Its default mode excludes the `medical-engine` group. No live scanner socket is mounted. The opt-in test class skips outside the explicit rehearsal runner, and rejects unsafe runner configuration before schema initialization. This suite remains a separate gate from the earlier 222-test parser/regression evidence.

## Conditional operator commands — not another retry now

Only after the supported access-resolution gate above, from `C:\Users\Pain\Desktop\work\checkupino`:

```powershell
node scripts/media/validate-scan.mjs
if ($LASTEXITCODE -eq 0) {
    docker compose --project-name checkupino_scan --file docker-compose.scan.yml config --quiet
    if ($LASTEXITCODE -eq 0) {
        docker compose --project-name checkupino_scan --file docker-compose.scan.yml up -d --no-deps --no-build --pull never scanner scan-check
    }
}
```

These operations belong to the operator. Existing init/definition/socket volumes are preserved and no worker profile is selected. Inspect the result before issuing any next command. A start message is not successful signature access or engine acceptance.

After actual scanner readiness/engine checks, the separate temporary-container worker gate is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-medical-worker.ps1 -ActualEngine
```

This mode refuses a stopped/unhealthy or wrong-image scanner before creating its test container, rechecks the deployed parser/app connection, and uses the preserved app/worker image with both sockets read-only and no network/live database access. Each actual-engine test first requires `medical:scanner-check --probe` to pass fresh-definition clean/EICAR checks. It then exercises an actual worker on a synthetic PDF or deliberately quarantined harmless antivirus test marker. These two cases pass on October 9 (2/24); the older guarded engine integration cases remain unexecuted. Healthy-container refusal alone is not evidence of successful engine acceptance.

## Limits and rollback

This is an isolated worker rehearsal, not acceptance of a standing Compose worker, MySQL concurrency, production packaging, scanner throughput/recovery, storage encryption, multipart, File Manager/forms or full medical flow. Scripted scanner replies prove adapter/worker behavior only. Actual-engine stale/error/timeout and deployed-runtime recovery checks remain open. No independent human expert review is claimed.

No business service, schema, live environment, credentials, image pin or Compose definition changes in this slice. Rollback can stop running the new test harness and retain all existing schema/history/release safeguards. Scanning remains false/private local, one request/file remains open/quarantined, and live jobs/reports remain zero. Future app recreations still require the existing content-client overlay.
