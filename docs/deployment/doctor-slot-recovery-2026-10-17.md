# Doctor slot-edit recovery - October 17, 2026

The user explicitly approved consistent locking, bounded rollback-safe retries and a clear refresh/retry response after reviewing the earlier two real MySQL doctor deadlock victims. This is the requested narrow hardening slice; combined panel/release rehearsal remains the next product-delivery step.

Before: doctor controls locked workplace before slots and attempted the transaction once. Both forced admin/doctor orders selected the doctor as a1213 victim; complete rollback protected data but the edit failed. After: doctor targets lock by ID before workplace/doctor/checkup/hospital/owner authority, matching admin and booking resource order. The full transaction retries up to three times for framework-recognized database concurrency failures. All eleven real MySQL cases pass; the earlier evidence remains immutable.

## Scope and compatibility

- Production changes are limited to `DoctorVisitSlotControlService`, the two existing `DoctorProfileController` slot-control catches and the new internal `ScheduleControlConflict` exception. Public method arguments, routes, successful response shapes and price/active-only controls remain compatible. No frontend, dependency, migration, environment or credential change is needed.
- Fresh account/doctor-role/ownership, active workplace/hospital/offering and rule facts are read under locks on every attempt. Actor/user locks follow resource locks to avoid introducing a doctor-user/slot inversion with admin's owner checks. Cached roles or profile relations cannot authorize recovery after revocation/reassignment.
- Single-slot selection uses its public identity; batch locks use ascending IDs. Day/week periods use hospital-local dates, ISO Monday weeks and exclusive next-local-midnight UTC bounds. A changed hospital binding/timezone refuses with409. Selections over250 candidates refuse before mutation, matching the established admin selection ceiling; narrower scopes remain available. No slot materialization occurs.
- Current locking reservation/history/conflict reads after the doctor lock exclude direct reservation history, rescheduled-away occurrences and overlapping live doctor bookings across workplaces. Booked money, slot identity/time/currency and append-only history are preserved.
- Slot changes and one exact actor-attributed audit commit together. Retries replay only a fully rolled-back transaction. Unrelated SQL/audit failures propagate rather than masquerading as retryable conflicts; unknown delivery/connection failures are not presented as a successful save or automatically replayed by this code.
- Exhausted serialization/deadlock/lock-timeout failures map to a fixed private409 message: refresh availability and try again. Existing API error envelopes retain `errors.slot_id` or `errors.date`, with `slot_control_conflict`; SQL, bindings and credentials are excluded. A nested deadlock unwinds to its outer transaction owner without an unsafe inner retry.
- Existing doctor set-value semantics remain: doctor-first completion invalidates an earlier admin revision; admin-first completion can be followed by the authorized doctor setting a new value, with two distinct ordered audits. There is no newly invented admin-price precedence or doctor optimistic-revision contract.

## Verification

Passed source/isolated gate:32 tests/261 assertions under UID33, network-none, read-only root/workspace, masked private storage, fresh Laravel environment/cache paths and SQLite memory. Six PHP files pass Pint; Node runner syntax passes. The twelve new recovery checks cover successful third attempt, private single/range409 after three failures, timeout mapping, revoked role/new booking between retries, suspended/reassigned cached ownership, reschedule history, cross-workplace conflict,250 bound, audit/unrelated SQL refusal and nested rollback. Five retained doctor-service and fifteen admin-control cases also pass.

The retry/exhaustion faults are intentionally injected into real SQLite transactions and framework retry handling. They do not establish a forced real-MySQL retry path. The new MySQL matrix checks both doctor/admin orders completing or refusing the stale preview, doctor/booking in both orders, existing admin single/day/week controls and audit rollback. Every committed target/audit/money count and unrelated queue sentinel is verified; transaction-attempt counts are recorded. No live HTTP/admin save is authorized.

Accepted MySQL8.0.46/repeatable-read evidence: [eleven-case result](evidence/doctor-slot-recovery-mysql-2026-10-17.json), checked October17 at15:23:40UTC. Doctor-first commits3000 and the stale admin refuses; admin-first commits2500 then the authorized doctor commits3000 with both distinct audits. Doctor-first booking snapshots3000; booking-first retains1000 and refuses the doctor edit as reserved. All four doctor invocations finish in one transaction attempt, with no final deadlock victim. Totals are five bookings/payments/outbox, six admin audits and three doctor audits; immutable slot facts, exact target/audit values, default-queue sentinel and zero medical jobs pass. This proves the exercised orders, not sustained load or a forced real-MySQL retry.

The unchanged admission guard passes31 tests; Node syntax and quality ratchets pass. All161 unrelated retained Staff source bindings and256 prior immutable evidence bindings remain intact. The new MySQL proof binds the three intentional production changes and their isolated runners/tests.

## Operator startup and acceptance

The user retains database Compose ownership. Start the existing guarded empty-project definition only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/start-schedule-acceptance.ps1
if ($LASTEXITCODE -ne 0) { throw 'Disposable startup failed; stop here.' }
```

After actual health/isolation verification, run `node scripts/media/verify-doctor-slot-recovery-mysql.mjs`. It reuses the unchanged pinned internal/tmpfs admission guard and refuses a populated schema or existing acceptance file. New exclusive evidence is `doctor-slot-recovery-mysql-2026-10-17.json`; the original nine-case runner/evidence are not changed or replayed. After acceptance, the operator uses the same guarded `-RemoveDisposable` cleanup and absence is verified.

Completed: the operator started the guarded project, all eleven cases passed on the first run, then the operator removed it with `-RemoveDisposable`. Read-only verification confirms no exact-named or project-labelled test container/network remains. Exactly five original services run (healthy static admin and four SeaweedFS services); live backend and parser/scanner/checker/worker remain stopped. Do not replay the accepted writer or cleanup. Combined panel/release rehearsal is next, after operator-owned existing-backend recovery; successful live saves and fresh scanner proof remain separate.

[Final acceptance and cleanup binding](evidence/doctor-slot-recovery-acceptance-2026-10-17.json) records the current source/context hashes, original evidence preservation and read-only runtime checks.

Static admin remains55f10d0b/64 assets. Backend/parser/scanner/checker/worker stay stopped; no source test starts a live backend or consumes jobs. Source rollback requires restoring only the reviewed service/controller/exception changes while retaining unrelated dirty work; no database rollback, reset or reseed is involved. Older clients retain the existing successful contract and receive a safe409 instead of an unhandled exhausted concurrency failure.
