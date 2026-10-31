# Disposable schedule contention - October 16, 2026

Accepted October17 at17:33:06 Tehran (14:03:06UTC): all nine forced-interleaving cases pass on pinned MySQL8.0.46/repeatable-read, including two-slot day/three-slot week, stale refusal, committed booking money, immutable targets and audit rollback. Evidence: `docs/deployment/evidence/schedule-contention-2026-10-16.json`. All31 admission guards/Pint/source syntax/unchanged quality ratchets pass;161 retained source/256 prior evidence bindings and live container identity/state remain. No production code or UI was changed. The operator completed guarded cleanup; project-labelled and exact-named test container/network are absent. Final closure: `schedule-contention-completion-2026-10-17.json`. Five original static-admin/media services run; backend/parser/scanner/checker/worker remain stopped.

Observed limitation: both forced legacy-doctor/admin cycles selected the legacy doctor as deadlock victim. The doctor transaction rolled back completely with zero doctor audit; the admin committed once. This establishes fail-closed atomicity, not successful automatic doctor-edit recovery or exercised admin deadlock retries. Next hardening is compatible doctor lock ordering/bounded retries and explicit failure delivery. That work, positive live saves and scanner recovery remain open.

The next approved stage8 verification slice covers concurrent admin slot controls versus booking, another admin and the legacy doctor writer. Production services, routes, UI, roles, schema, environment and dependencies are unchanged. Live admin/profile saves remain separately deferred. The accepted static admin remains55f10d0b/64 assets.

Before: isolated SQLite mutations and read-only MySQL previews passed; they did not establish contention or deadlock behavior for the new admin writer. After: nine guarded disposable MySQL cases establish committed/stale/unavailable/audit-rollback outcomes and exact atomicity. Three synthetic bookings/unpaid payments/outbox events and seven admin audits committed in the test database; zero doctor audits, provider attempts/adjustments, medical files, reschedules or consumed jobs. Live business data was not accessed by the runner; live container identity/state and production source hashes were verified unchanged.

## Isolation and admission

`docker-compose.schedule-acceptance.yml` creates only `checkupino_schedule_acceptance-mysql-acceptance-1` on its own internal network, with no published port, live network, bind mount or durable volume. It reuses the existing pinned MySQL8.0.46 image: UID999, read-only root, no capabilities/new privileges,1GiB memory/no extra swap,1CPU/64PIDs and capped tmpfs data/runtime directories. No pull, build or general worker is involved.

The operator owns database Compose operations. `start-schedule-acceptance.ps1` defaults to refusing any existing project/container/network. The explicit `-RecreateDisposable` option verifies the exact healthy pinned project, sole container/network membership, ownership, caps, limits and absence of durable mounts before replacing that test service. It never removes a live project or Docker volume; all failed evidence stays in the repository.

`verify-schedule-contention.mjs` admits only that healthy isolated database. The PHP runner is UID33, read-only, networked only to the disposable database, with capped resources, masked private storage and fresh tmpfs Laravel environment/cache paths. No project dotenv or configuration cache is loaded. Before any schema setup, PHP checks the effective database identity, MySQL version, repeatable-read isolation and zero existing tables. Only then may existing migrations and the synthetic role seed run. A populated schema is refused without reset/reseed or automatic retry.

## Bounded cases

1. Booking holds the actual slot lock before an admin write; booking commits, stale admin preview refuses and booked money stays original.
2. Admin disables a slot before booking; the subsequent booking refuses it.
3. Admin reprices before booking; the reservation snapshot and unpaid payment use the committed slot price/currency.
4. Two admin previews for one slot commit only once; the second refuses its stale revision.
5. The same contention covers a two-slot day without partial changes or duplicate audit.
6. The same contention covers a three-slot ISO week spanning two days.
7. Legacy doctor workplace-first locks contend with the admin slot-first writer.
8. The reverse doctor/admin interleaving is also forced.
9. A synthetic audit failure rolls back slot changes and releases the blocked booking to use original money.

Barriers pause after a real production locking query and observe the competing locking-query attempt; follower elapsed time must overlap the held lock. The production transaction/retry boundary is preserved; the harness adds no outer transaction around either writer. Every case verifies exact committed audit actor/action/snapshots, immutable slot identity/time/currency and reservation/payment/outbox counts. Batch assertions cover every target. A default-queue sentinel must remain untouched; no medical job, provider attempt, adjustment, file or reschedule record is allowed.

The legacy doctor service has no automatic deadlock retry. If MySQL chooses it as a victim, the accepted outcome must be an explicit1213 rollback with no audit/partial save; it is never recorded as a successful edit. Admin retries must settle or refuse the stale preview. This slice does not silently change that compatibility contract.

## Verification and preserved harness history

- All31 host admission tests pass, including wrong/live project, image, user, mounts, resources, ports, extra network/client, unhealthy/OOM/restarted container and database credential-shape refusals.
- PHP syntax/Pint and Node/PowerShell syntax pass. Missing isolated environment is refused before framework/SQL boot.
- Operator startup passed; actual pinned MySQL8.0.46 is healthy/internal/tmpfs-only, repeatable-read.
- First run refused the harness's `QUEUE_CONNECTION=null` assumption before schema creation. Laravel converts the literal to a null value; the harness now uses its isolated database queue with an unconsumed sentinel. Read-only diagnosis confirmed zero tables before the corrected run.
- Second run stopped in synthetic request setup: rebinding Laravel's request replaced the preinstalled user resolver. The helper now binds the request first, then installs its resolver. Read-only diagnosis on the test database confirms the corrected preview passes with one eligible fixture. No reservation or audit had committed. Both failed records and both read-only diagnosis records are immutable.
- A fresh operator recreation is requested because the second run created test setup. Do not reuse/reset that populated schema or claim the nine contention cases passed yet.

October17 continuation: the operator recreated the test project, then a Docker interruption stopped it along with the live backend. Admission refused the stopped database before SQL. The operator started only the existing test service; MySQL health/isolation passed. The next run created exactly one synthetic booking, unpaid payment and outbox event with zero schedule audits, then failed a harness assertion. Inspection found that strict immutable-field array comparison included key order: factory insertion order differs from fresh database column order. Both sides are now key-sorted before strict value/type comparison. Redacted failures now retain only explicit harness assertion messages and safe child class/stage/line diagnostics, never generic exception messages, SQL or credentials. PHP/Pint and runner syntax pass. Another guarded operator test-project recreation is requested; the full nine-case contention acceptance remains open. The backend stays stopped, with only static admin/four media plus the separate test database running.

The third immutable failure is `schedule-contention-failed-1792245039347-2026-10-16.json`; its October16 filename identifies the original slice, while its `checked_at` records October17 execution. Do not overwrite or reinterpret it as success.

The corrected source preparation is recorded separately in `schedule-contention-source-ready-2026-10-17.json`:31 admission checks/Pint/source syntax/unchanged quality ratchets and161 retained source bindings/prior evidence integrity. It explicitly does not establish concurrent MySQL acceptance. No frontend rebuild is needed for these test-only files.

The next fresh run passed the first three complete cases, then stopped at `same_slot_admin_revision` (`schedule-contention-failed-1792245430378-2026-10-16.json`). Two admins contend on the shared locked authority-role row before the second reaches its slot query, so a barrier waiting only for the slot attempt times out. The barrier now explicitly observes `roles` for admin/admin pairs and records the blocking table; other pairs retain their slot/workplace marker. Earlier authority serialization is preserved, not bypassed. Own assertion messages and completed partial cases are retained in subsequent failure evidence. Source/Pint/PowerShell checks pass; all nine cases still require a fresh run. The earlier source-ready binding is historical for the prior harness revision and remains immutable.

`start-schedule-acceptance.ps1 -RemoveDisposable` adds guarded final cleanup of the same sole healthy pinned tmpfs project. It uses the same ownership/network/security admission as recreation, runs only project-scoped `down`, deletes no Docker volume and starts nothing. The user explicitly chose to perform recreation/cleanup themselves and completed both; no Compose delegation was granted.

Evidence: `docs/deployment/evidence/schedule-contention-failed-1792180110882-2026-10-16.json`, `schedule-contention-failed-1792180161260-2026-10-16.json`, `schedule-contention-read-diagnosis-2026-10-16.json` and `schedule-contention-read-diagnosis-corrected-2026-10-16.json`.

## Recorded final cleanup - completed

The operator explicitly chose to run recreation and cleanup themselves. After successful acceptance, they ran only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/start-schedule-acceptance.ps1 -RemoveDisposable
if ($LASTEXITCODE -ne 0) { throw 'Disposable cleanup failed; stop here.' }
```

The assistant verified that project-labelled and exact-named test container/network are absent, runtime code/protected source hashes remain, static admin stays healthy55f10d0b and exactly five original services run. The earlier bounded acceptance binding records cleanup as pending at that moment; final completion explicitly supersedes this runbook's documentation hash only and preserves all prior evidence. Do not rerun the accepted writer or alter evidence. Backend/parser/scanner/checker/worker remain stopped.

## Recorded startup and execution commands

From the project directory, the operator runs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/start-schedule-acceptance.ps1 -RecreateDisposable
if ($LASTEXITCODE -ne 0) { throw 'Disposable recreation failed; stop here.' }
```

After health/isolation verification, the assistant ran (accepted; do not replay):

```powershell
node scripts/media/verify-schedule-contention.mjs
if ($LASTEXITCODE -ne 0) { throw 'No completed contention acceptance; preserve evidence and diagnose.' }
```

Only a complete verified result writes `schedule-contention-2026-10-16.json` with exclusive creation. Failures write separate redacted immutable files. It never accepts an exit code alone, overwrites evidence or automatically resets/replays the database. The accepted writer now refuses replay because its evidence exists.

No live SQL mutation, UI deployment, protected-account access, credential replacement, scanner/worker activation, clinical download, provider operation or unrelated job consumption is authorized by this runner. HTTP/session/CSRF acceptance, positive live admin saves, sustained load and fresh scanner recovery remain separate gates.
