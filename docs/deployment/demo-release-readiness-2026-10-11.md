# Demo release readiness

User selects repeatable demo/release readiness after the accepted golden flow. This slice adds an operator check and walkthrough, with no application, UI, dependency, schema, environment or runtime activation change. Monday October12 remains the target. Client UI refactoring remains expected; server contracts retain authority.

## Current disposition

The recorded synthetic story remains accepted. Latest [visual questionnaire editor](questionnaire-visual-editor-2026-10-13.md) is a5b45485/47 assets: full58/460,31 real-pointer ENFA groups/nine layouts/16 captures and11 role groups pass using existing packages/adapter, with44 Node safeguards. Prior [RTL mirror/grid](panel-mirror-acceptance-2026-10-13.md) and earlier artifacts/original completed-protected data are preserved. Successful live writes/download audits, optional vendor interactions and fresh scanning remain separate gates.

October12 [recovery and real-pointer follow-up](demo-admin-recovery-2026-10-12.md) recovered12 services/idle worker/jobs0 with unchanged original data. The persistent-customizer-backdrop claim was not reproduced; close/Escape/backdrop cleanup is verified. Farsi pointer testing instead demonstrated content/sidebar overlap; the subsequent explicit three-offset correction is delivered under the linked successor acceptance. Historical recovery, old candidate and failed-pointer proofs remain unchanged; no definition contact, business-write or exact-job delivery authority is inferred.

Fresh-upload readiness remains open. Scanner is stopped and the last accepted daily28148 definitions are expired. The recorded cooldown ends October11 **21:46:52 Tehran /18:16:52UTC**; a newer observed cooldown always takes precedence. Successful container startup or the old scan acceptance never substitutes for a current real probe. The dedicated worker intentionally sleeps and cannot automatically deliver a new file.

## Repeatable read-only gate

Run from the project root in PowerShell:

```powershell
Set-Location 'C:\Users\Pain\Desktop\work\checkupino'
node scripts/media/check-demo-readiness.mjs
if ($LASTEXITCODE -ne 0) { throw 'Recorded demo checkpoint changed; stop and inspect.' }
```

The command inspects only the13 named Checkupino services, pinned candidate/app/parser/worker/scanner identity, worker/parser isolation, both read-only socket attachments and actual worker sleep. It verifies MySQL/Redis as UID33, app producer/local-storage/encrypted dedicated-queue configuration, a synthetic in-memory parser check, health/guest401/deep-link delivery and every accepted asset hash (47 on the visual-editor successor;45 on RTL/grid;42 on earlier medical/questionnaire;36 on reservation;31 on retained8db rollback). Clinical/payment/settings/audit/outbox/questionnaire/protected7/8 fingerprints must match the accepted completion checkpoint and remain unchanged at the end. No protected login occurs. Scanner logs are read privately to extract the maximum recorded cooldown; identifiers and credentials are never printed.

It writes no files, evidence, clinical rows or jobs, starts no service and requests no definitions. It does not log in, submit a questionnaire, book/pay/complete, replay a browser writer or consume a queue. Laravel's ordinary boot and read-only probes use existing runtime resources; the parser may use its isolated temporary working space. Successful exit means **existing_history_ready**, not a fresh scan or release permission. Named failure stages are printed without database/Docker exception details.

`fresh_pipeline_ready` requires the explicit current synthetic probe below. `fresh_upload_demo_ready` remains false because an actual new upload needs its own authorized exact-file/encrypted-job binding and guarded delivery. No stored probe or clock/host/account/job override is accepted.

The baseline is deliberately fixed to the accepted recorded story: reservation8 completed/paid,2 requests/2 files/2 published reports/0 jobs/1 questionnaire submission. An authorized new business write changes that checkpoint; record and review its new proof before preparing a successor gate. Do not edit hashes to hide an unexpected change. Availability, current authenticated sessions, native save dialogs, current EN/FA interaction and new upload/delivery are not established by this read-only CLI; their prior scope/evidence remains in the linked rehearsal. UI candidate selection now requires both served proof and11-group admin rehearsal on the same successor image, with before/after hashes equal to that unchanged clinical checkpoint. The original8db artifact remains valid for rollback, reporting admin_reservation_panel_ready:false; successor reports true for the reservation read slice only. The medical/questionnaire candidate additionally has served and read/role/confirmation proofs; this CLI does not claim live successful administrative mutations or download audit acceptance. No new business checkpoint or permission to scan is inferred.

## Scanner recovery gate

October13 visual questionnaire editing is accepted ona5b45485/47 assets through its fixed ready static/11-role evidence pair. Full58/460/31 real-pointer groups/nine layouts/16 captures and44 Node safeguards pass. Reasons/revision/server sanitizer/history/role controls and original completed/protected data remain intact; no live write. See [editor acceptance/rollback](questionnaire-visual-editor-2026-10-13.md). Prior12112/0b1 and other retained artifacts remain recognized; fresh scanning stays gated.

Before any recovery, verify that the intended Docker VPN/TUN route is active. Docker registry mirrors do not establish ClamAV definition access. Route verification and the existing supported CDN diagnosis are separate from this CLI; never substitute alternative definition downloads or edit cooldown/freshness controls.

After the deadline, obtain the current deadline from the check rather than relying only on the October11 time:

```powershell
$taskReadinessRaw = node scripts/media/check-demo-readiness.mjs
if ($LASTEXITCODE -ne 0) { throw 'Readiness inspection failed; no scanner start.' }
$taskReadiness = ($taskReadinessRaw -join [Environment]::NewLine) | ConvertFrom-Json
if (-not $taskReadiness.existing_history_ready) { throw 'Recorded demo is not verified.' }
$taskCooldown = [DateTimeOffset]::Parse($taskReadiness.cooldown_until_utc)
if ([DateTimeOffset]::UtcNow -le $taskCooldown) { throw 'Scanner cooldown remains active; stop here.' }

docker compose --project-name checkupino_scan --file docker-compose.scan.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Scanner configuration failed.' }
$taskScannerRunning = docker inspect --format '{{.State.Running}}' checkupino_scan-scanner-1
if ($LASTEXITCODE -ne 0) { throw 'Existing scanner identity check failed.' }
if ($taskScannerRunning -eq 'false') {
    docker start checkupino_scan-scanner-1
    if ($LASTEXITCODE -ne 0) { throw 'Scanner startup failed; stop here.' }
}
docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' checkupino_scan-scanner-1
docker logs --tail 30 --timestamps checkupino_scan-scanner-1
```

This is one controlled existing scanner start, not a retry loop. Keep network/provider identifiers local. On403/429 or any new cooldown, preserve it and stop. Read-only health inspection may be repeated while a normal initial update runs; do not repeat a definition download/start after failure. No build/pull/recreation, scanner-check restart, general worker or definition-volume action.

Once the official update succeeds and the existing daemon is healthy:

```powershell
node scripts/media/check-demo-readiness.mjs --scanner-probe
if ($LASTEXITCODE -ne 0) { throw 'Fresh scanner/parser acceptance failed; no upload or delivery.' }
```

This flag refuses before contacting the scanner when cooldown is active or the existing daemon is not healthy. It uses the actual app caller, clean synthetic PDF and in-memory EICAR test string, checks their real verdicts/digest/database consistency and retained48-hour freshness/future-clock tolerance, and verifies the remote parser. It starts no updater and changes no file verdict. It rechecks data/idle worker and scanner identity plus the latest cooldown after inspection. Exit0 under this flag establishes only the current pipeline probe; exact new delivery remains separate. Current healthy-engine execution of this new command remains unaccepted until recovery; its default deployed path and refusal are verified now.

## Presentation walkthrough

1. Warm login and reservation reads on localhost. Use only existing synthetic patient4 and assigned doctor5 with existing demo credentials; keep credentials out of logs. Retain the accepted wider1,551.3ms/1,500ms timing exception and cold-login limitation.
2. Patient reservation table shows recorded reservation8 paid/completed. Refresh future availability before discussing a new booking: last accepted checkup5/doctor2/workplace3 slot is October18 08:00–08:30Tehran,7,000,000IRR. A new future booking cannot be completed early; do not backdate or recreate fixtures.
3. Doctor reservation table enters `/panel/doctor/reservations/01m44ah0fxjqz5mbpbabe1qj44/medical`. Medical pages use the reservation public ID, unlike the numeric appointment-completion API. Select the accepted new request and show the two immutable published synthetic outcomes/history in EN/FA. Publication and completion already occurred; never replay them.
4. Patient `/panel/my/reservations/01m44ah0fxjqz5mbpbabe1qj44/medical` shows the same published history and eligible synthetic PDF. The original quarantined file remains unavailable. Exact session HTTP downloads are accepted; native Chrome save-dialog automation is excluded.
5. Patient `/panel/my/questionnaire` demonstrates the fixed3-question/9-choice EN/FA form and approved mobile/keyboard behavior. Describe the existing ordinary score2/recommendation acceptance separately; another submit would be a new write and is unnecessary for the recorded walkthrough.
6. For a fresh upload, stop until current scanner acceptance and a new exact file/job delivery plan pass. Upload receipt/checking UI never claims the idle worker is processing. Do not replay `deliver-demo-medical-job.mjs` or relax its closed job1/request guards.

## Checklist and verification

- [x] Repeatable fixed-checkpoint gate with private diagnostics, no evidence overwrite and explicit recorded-history/current-scan separation.
- [x] Ten bounded Node safeguard tests: cooldown boundary/latest/malformed dates, stale/future definitions, incomplete/wrong-engine probes, health-versus-real-probe separation, no delivery authority and rejected overrides.
- [x] Default live gate:12 running services,31 exact served assets, parser/MySQL/Redis/idle worker and unchanged accepted/protected fingerprints.
- [x] Live `--scanner-probe` refuses during cooldown without engine contact or scanner log/start change.
- [x] Operator walkthrough, dynamic cooldown recovery commands, accepted exclusions and rollback retained.
- [ ] After supported recovery, run the new current healthy-engine probe and prepare only the authorized fresh exact file/job binding if a new upload is required.

Evidence: [dated gate/refusal/source-hash proof](evidence/demo-release-readiness-2026-10-11.json). It is a new file created with an exclusive-write guard; historical evidence is untouched. The readiness CLI itself only prints JSON and never overwrites proof files.

Rollback: stop using the new readiness helper and return to the accepted [recovery/rehearsal report](demo-recovery-rehearsal-2026-10-11.md). This slice changes no app state, data, image, overlay, schema or UI. Keep the main-env disabled producer rollback and both socket overlays on any later app recreation. Original evidence and its separately disclosed older-parser overwrite limitation remain unchanged.
