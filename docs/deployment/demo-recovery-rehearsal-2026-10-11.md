# Recovery, ordinary completion and final rehearsal

Operator explicitly requests container recovery/restarts and continuation. Eight required services were stopped, exit255/no OOM; admin/four SeaweedFS had already restarted with Docker. Existing backend db/Redis/app/Nginx were started with content-client and producer overlays, parser with its permission initializer dependency, then exact check/idle worker containers. Twelve services run; scanner stays stopped deliberately. No build/pull/recreation/reset/reseed/migration/credential change or unrelated container action.

Backend/admin health200, www-data MySQLSELECT/RedisPING, producertrue/private local/both read-only sockets and actual idle `sleep infinity` worker pass. Parser isolation/socket UID33/mode0600/synthetic validation/tamper/following recovery/application validation pass. Current code/artifact remains frontend54/414, isolated completion9/61, admin8db6aa7e/31 assets; no new application/UI source changes.

## Ordinary completion accepted

One ordinary assigned-doctor5 modal confirmation issued one empty-body POST to `/api/doctor/reservations/8/complete`, with fresh numeric-ID detail before delivery. Reservation8 completed at **October11 13:44:21 Tehran / 10:14:21UTC**, after08:00 start. Patient4/doctor5 show completed/paid EN/FA and after refresh; unassigned doctor3 receives404. Nine groups pass.

Only audit27 (`reservation.completed`, actor5) and outbox5/6 (`reservation.completed`, `rating.requested`) were added, correctly bound to exact reservation/actor/patient/occurrence. Old audit/outbox rows, other reservations, stable target fields, payments/attempts, requests/files/policies/two published reports, questionnaire, settings, jobs and protected7/8 hashes remain. No notification/scheduler/general-worker consumption. Current state: completed reservation8,2 requests2 files2 reports0 jobs,1 questionnaire submission; original open request/quarantine preserved.

The initial writer stopped on a loading-row selector before POST: deliveredfalse, zero clinical writes, confirmed/null completion and unchanged hashes. Its failed evidence remains. Final writer required those exclusions, fresh unchanged hashes and a started marker before one guarded target delivery. Both writers are closed; never replay them.

## Final read-only rehearsal

Fourteen groups pass: patient/doctor keyboard medical links, retained File Manager/two published bodies EN/FA, patient refresh, authenticated future availability, questionnaire visible-link keyboard navigation,3-question/9-choice form EN/FA without another submission,390px mobile Farsi direction/viewport and full immutable fingerprints. An earlier read-only pass focused a hidden duplicate questionnaire anchor and stopped with zero business writes. Final selects the visible anchor; no UI restyling.

Twelve warm browser API samples across patient/doctor auth-me/reservation lists measure **81.2–654ms**. These bounded samples do not replace the wider historical1,551.3ms/1,500ms exception. Existing checkup5/doctor2/workplace3 availability now includes **October18 08:00–08:30 Tehran**,7,000,000IRR. Earlier October11 09:00 candidate is past. Refresh availability before presenting; no fixture writes/backdating/hold extension.

## Scanner gate still open

Scanner is stopped. Retained1.5.4/daily28148 dated October9 06:25:40UTC exceeded48-hour freshness October11 09:55:40Tehran. Last log October10 22:16:52UTC reports cooldown until **October11 18:16:52UTC / 21:46:52Tehran**. No scanner restart/extra definition request/cooldown-file edit/alternate download/freshness bypass. Producer remains as approved; unavailable/stale engine cannot establish clean verdicts, and idle worker consumes nothing. Existing completed/published history/questionnaire can be presented; Monday fresh-upload readiness requires actual scanner recovery.

After cooldown, verify the intended Docker VPN/TUN route, then use one controlled existing scanner start. Do not run before the guard, repeat after rejection, build/pull/recreate or start a worker:

```powershell
Set-Location 'C:\Users\Pain\Desktop\work\checkupino'
$taskScannerCooldown = [DateTimeOffset]::Parse('2026-10-11T18:16:52Z')
if ([DateTimeOffset]::UtcNow -le $taskScannerCooldown) { throw 'Scanner cooldown has not elapsed; stop here.' }
docker compose --project-name checkupino_scan --file docker-compose.scan.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Scanner configuration failed.' }
docker start checkupino_scan-scanner-1
if ($LASTEXITCODE -ne 0) { throw 'Scanner startup failed; stop here.' }
```

Inspect official update result. On403/429 preserve new cooldown and stop. Successful start alone is insufficient; after fresh definitions/daemon health, run the existing synthetic-only actual-engine probe:

```powershell
docker exec --user 33:33 checkupino_scan-scan-check-1 php artisan medical:scanner-check --probe
if ($LASTEXITCODE -ne 0) { throw 'Fresh scanner acceptance failed; no demo delivery.' }
```

Do not relax/replay old pre-upload/disabled checkpoint scripts or accepted file/job1 writers. A new demo upload needs its exact authorized job/file binding and separate guarded one-job delivery, without unrelated consumption.

## Evidence, correction and rollback

Current proofs: `evidence/demo-recovery-runtime-2026-10-11.json`, `content-demo-restart-app-runtime-2026-10-11.json`, `demo-appointment-completed-final-2026-10-11.json`, `demo-golden-rehearsal-final-2026-10-11.json`. Failed pre-write/loading-row and hidden-anchor evidence remains. Separate earlier medical/queue/questionnaire successful acceptance remains historical; this recovery does not establish another fresh scan.

A copied parser helper retained a dynamically constructed October10 evidence path and overwrote untracked `content-restart-app-runtime-2026-10-10.json` with today's result. Path corrected; exact current result preserved separately as `content-demo-restart-app-runtime-2026-10-11.json`. Original bytes of that individual old JSON were not recovered; never cite it as the original October10 time/count proof. Separate unchanged `media-restart-runtime-2026-10-10.json` and clinical/queue/questionnaire evidence remain. No application/patient data affected. Original helper unchanged; current helper is `verify-content-demo-restart.mjs --app-connected`.

Static retention tag `checkupino-admin:demo-completion-controls-accepted-2026-10-11` and prior questionnaire/medical tags remain. UI rollback preserves completed status/audit/outbox/clinical/questionnaire records. Keep both app sockets/producer rollback default; no broad cleanup/prune or protected project/account operation.
