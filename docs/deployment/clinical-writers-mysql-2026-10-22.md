# Latest clinical saves: bounded MySQL acceptance

Status: **all19 MySQL cases passed and exact disposable container/project/network absence is verified; slice closed**. User selected focused creation/pricing/working-hours tests on October22. No production source/UI, live schema, credentials, live data or queues are changed. The static panel remains the accepted2f7bc492 image. Nine normal services run; scanner/parser/checker/worker stay stopped. The user explicitly delegated this final cleanup attempt; other database Compose/recreation operations retain their standing ownership. The attempt notes below are preserved history; this accepted result supersedes their pending/failure state.

First operator startup passed health/isolation admission. The first MySQL attempt created only the disposable schema/fixture, then failed before any concurrency case completed: the standalone request helper set its user resolver before Laravel rebound the request. Failure records `clinical-writers-mysql-failed-1792678371093-2026-10-22.json` and read-only diagnosis `clinical-writers-mysql-failed-1792678534415-2026-10-22.json` are retained. Corrected resolver ordering passes the same controller context under `SET TRANSACTION READ ONLY`, plus syntax/Pint/preflight. Primitive slot comparisons avoid Carbon object identity, and booking barriers target the intended shared resource after the writer holds it. No production change or accepted concurrency result. Operator-only guarded recreation is requested because the populated-schema guard remains intact.

Second operator recreation was admitted healthy. The first concurrent doctor-creation case then failed with an unexpected SQL refusal; no whole case is accepted (`clinical-writers-mysql-failed-1792684339272-2026-10-22.json`). Review found a second harness authentication mismatch: its user resolver queried on every access, whereas normal Laravel authentication caches the resolved user. Such an extra in-transaction nonlocking query can establish an artificial repeatable-read snapshot before the production lock. The helper now resolves once before the application transaction; read-only inspection verifies stable user identity and **zero** resolver queries. Unexpected SQL exceptions now retain only their structured error number/file rather than losing that detail in an assertion; no raw SQL/credentials. The hypothesis requires the next clean run to establish the outcome; this is not a production defect or passing-case claim. Secondary-location hours and exact reservation/payment/outbox counts are also checked. Syntax/Pint pass. A further operator-owned recreation is pending; no automatic replay/reset.

Third operator recreation was admitted healthy. `clinical-writers-mysql-failed-1792684751409-2026-10-22.json` retains **seven completed case results**: doctor/patient/hospital replay, late doctor/hospital audit rollback, and different-admin doctor/hospital unique-constraint refusal. Their exact outcomes, audits/actors and state/money checks passed on that bound source. The overall run failed on `same_hospital_attachment_replay` before accepting it. The fixture signed its just-created factory hospital rather than the freshly loaded persisted row used by the real API. The fixture now reloads it; read-only inspection confirms persisted revisions are stable and raw attribute order changes the signature. Cached identity still incurs zero extra queries. Syntax/Pint/preflight pass; production source is unchanged. Failed-pair outcomes are now retained separately from completed case results to improve diagnosis. Full execution awaits operator recreation; the remaining12 cases are not accepted and no successful overall receipt exists yet. The previous paragraph's pending-recreation note is historical and superseded by this result.

## Scope

Use the already accepted disposable schedule-test project, not a new database design or dependency. Pinned MySQL8.0.46 uses an internal-only network, no ports or durable volumes,1GiB memory/no extra swap and tmpfs data. The pinned PHP image runs UID33 with a read-only project mount, private temporary environment/storage, no live mounts or public network, and bounded CPU/memory/PIDs/deadlines.

`scripts/media/clinical-writer-mysql-cases.json` defines19 real two-process interleavings:

| Area | Cases |
| --- | --- |
| Creation | Same-context doctor, patient and hospital replay; late doctor/hospital audit failure followed by a successful contender; different-admin duplicate doctor/hospital creation |
| Locations/prices | Same hospital attachment replay; same service-price replay; prices before hours and hours before prices; two locations sharing a practice revision |
| Atomicity | Price-audit failure followed by hours; hours-audit failure followed by prices |
| Bookings | Booking versus service-price saves and booking versus weekly saves, both execution orders |
| Lifecycle | Hospital deactivation before doctor attachment |

Both child processes invoke the actual services/controller. Barriers observe an acquired production transaction lock (or inserted unique-key row), then the contender's actual query attempt. The contender must overlap the held transaction. Checks require exact expected outcomes, transaction closure, audit actions/actors and before/after prices; no partial identities/profiles/specialties/associations; unrelated table preservation; original slot identity/time/currency/price; original booked money/payment amount; full08:00-16:00 shifts with12:00-13:00 lunch and fourteen30-minute sessions. The clock is fixed only inside the disposable test process. No real-time clock is altered.

Unexpected deadlocks/timeouts fail. Two cross-admin duplicate cases explicitly test database unique-constraint rollback; an internal1062 refusal is **not** client-facing409/422 acceptance. HTTP/CSRF/password prompts are outside this service-level MySQL suite and remain covered separately. Sustained load, every possible catalog/role lifecycle race and forced retry exhaustion are not claimed. Any exposed defect must be recorded and resolved or left explicitly unaccepted; expectations must not be weakened to obtain green results.

## Preflight and execution

Prepared runner: `scripts/media/verify-clinical-writers-mysql.mjs`; probe: `scripts/media/probe-clinical-writers-mysql.php`.

Source/matrix/pin preflight passes, PHP syntax/Pint passes, and the31 existing isolation admission tests pass. Focused isolated SQLite `ClinicalOnboardingTest` passes9 tests/75 assertions in `evidence/clinical-writers-source-2026-10-22.log`; this is not MySQL concurrency acceptance. `node scripts/media/verify-clinical-writers-mysql.mjs --inspect` performs only a read-only controller-context check on the verified disposable database; it cannot run a creation/save or replace/reset the schema.

Operator startup (the existing acceptance project must be absent):

```powershell
Set-Location 'C:\Users\Pain\Desktop\work\checkupino'
node scripts/media/verify-clinical-writers-mysql.mjs --preflight
if ($LASTEXITCODE -ne 0) { throw 'Clinical writer preflight failed.' }
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/start-schedule-acceptance.ps1
if ($LASTEXITCODE -ne 0) { throw 'Disposable startup failed; stop here.' }
```

The user retains database Compose/start/recreation/cleanup. After startup, the agent verifies health, ownership, pin, sole network membership and tmpfs/security limits before invoking the runner:

```powershell
node scripts/media/verify-clinical-writers-mysql.mjs
if ($LASTEXITCODE -ne 0) { throw 'MySQL acceptance failed; preserve the disposable database for diagnosis.' }
```

The PHP probe refuses a populated schema **before** existing migrations or role seeding. Those operations target only this verified-empty disposable database; no reset or live migration/reseed occurs. It inserts one synthetic default-queue sentinel and verifies it untouched; no worker exists and no medical job is created/consumed. No successful clinical writer is replayed against live data.

On failure: uniquely named redacted `clinical-writers-mysql-failed-*-2026-10-22.json` preserves partial case results; no automatic retry/reset/recreation/cleanup. Preserve the database. Correct the harness or implementation with evidence, then ask the operator for guarded recreation only when needed. Accepted output is write-once `evidence/clinical-writers-mysql-2026-10-22.json` with exact source/image bindings. Existing October16/17 contention probes/evidence remain unchanged and are not replayed.

After verified success, operator-only cleanup:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/start-schedule-acceptance.ps1 -RemoveDisposable
if ($LASTEXITCODE -ne 0) { throw 'Disposable cleanup failed; stop here.' }
```

The agent then verifies exact test-container/network absence and synchronizes the outcome. No full frontend run, admin rebuild, backend recreation, definition download, scanner activation, general worker or unrelated cleanup is part of this slice. Both current medical-scan jobs, protected patients7/8, hazelnut2.0 and NebulaNV remain untouched.

## Accepted execution

The final clean run passed all19 planned pairs on MySQL8.0.46 / REPEATABLE-READ. Immutable receipt: `evidence/clinical-writers-mysql-2026-10-22.json`. Every pair observed its real transaction barrier and exact expected outcomes, atomic state/audits and preserved slot/booked money. Totals are22 committed audit events and3 synthetic bookings, each with exactly one matching unpaid payment summary/outbox event, only inside the disposable database. Default-queue sentinel is unchanged and medical-job count is0. No unexpected deadlock/timeout is accepted.

Creation/attachment/price/weekly replays refuse stale contenders. Failed late audits roll back and release the next writer safely. Changing one location preserves the other hospital's saved hours. A full08:00-16:00 shift with12:00-13:00 lunch materializes14 half-hour appointments; the price defaults and original booked450000IRR amounts remain correct. Booking before hours preserves its existing slot/money; hours before booking makes the old slot unavailable. Hospital deactivation prevents a pending attachment.

Both cross-admin duplicate cases demonstrate unique-index rollback, not friendly HTTP conflict conversion. That handling, every possible authority/catalog lifecycle race, sustained load, forced retry exhaustion and attended live/browser saves remain outside this acceptance. The19-case suite does not establish full release or current scanner readiness.

The runner verified exact protected production and harness bindings before/after, unchanged unrelated container IDs/images/states, internal-only temporary database isolation and the accepted image pins. The agent made no live SQL connection in this suite; no new live fingerprint claim is inferred. All earlier failed receipts are retained. Successful test execution must not be replayed.

## Cleanup and closeout

The user explicitly instructed the agent to run the prepared cleanup. `start-schedule-acceptance.ps1 -RemoveDisposable` stopped at its inspection guard because the exact test container was already absent, so the script removed nothing. Independent read-only inspection confirmed the exact container name, project-labelled membership and test network are all absent on `desktop-linux`. No actor is attributed to that earlier removal. No guard was bypassed, no database was recreated just to clean it up, and no unrelated container/volume was removed.

`scripts/media/verify-clinical-writers-closeout.mjs` verifies the19-case receipt,22 test audits/3 test bookings, source bindings, exact cleanup state, all nine normal services, unchanged app/accepted static image and stopped helpers. Final write-once record: `evidence/clinical-writers-closeout-2026-10-22.json`. This closes the bounded MySQL slice. Next planned work is the combined four-role ENFA rehearsal/manual walkthrough update; attended live saves, HTTP duplicate-conflict behavior and current scanner/media acceptance remain separate.
