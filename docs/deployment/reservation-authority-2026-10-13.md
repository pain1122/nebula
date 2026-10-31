# Reservation authority guard — October 13

The user defers the successful live profile-save rehearsal and will attend it personally. Continue the approved remaining administration slices; do not change the completed synthetic demo to prove a save.

## Delivered slice

Reservation reschedule and root status override previously authorized the supplied actor/model before their transaction. An already-loaded role or doctor relationship could remain cached after authority or assignment changed. Both services now lock and reload the actor, load current roles, require an active account and authorize again against the locked reservation before any mutation. Override still requires root authority. Reschedule still permits product admins or the assigned doctor, with the current doctor role now explicitly required. A changed doctor assignment refuses the stale reschedule attempt and requires a fresh read, preserving the established slot/doctor/reservation locking sequence.

Method signatures, routes, request/response formats, schema and dependencies remain unchanged. Valid reasoned actions retain their original payment facts and audit/history behavior. No new panel controls were wired and no live save was attempted. The existing bind-mounted backend uses these source guards; the accepted static admin remains `f6a0de92`.

## Verification and limits

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-reservation-authority.ps1` passes **14 tests / 70 assertions**. The runner reuses the installed pinned validation runtime as UID33, with no network, read-only project mount, masked live private-storage mount, temporary storage and in-memory SQLite. The existing guarded test bootstrap skips project environment/configuration before schema setup. Syntax and pre-Docker argument refusal pass.

Tests exercise cached root/admin/doctor role revocation, suspended/closed actors, cached former-doctor assignment and admin refresh after reassignment. Refusals preserve reservation, payment, schedule history and audit state. Existing valid doctor/admin reschedules, money preservation, root-only override, terminal/offering/conflict refusals and audit rollback pass. Pint passes five PHP files. The initial two test failures compared an unsynchronized newly-created model's attributes with a database-loaded model; the baseline was corrected to a fresh database snapshot, preserving strict whole-row equality.

This is deterministic SQLite authority/rollback coverage, not a new concurrent MySQL race acceptance. The existing MySQL scheduling proofs remain historical. No changed transition rule, payment shortcut, generic worker, scanner/definition operation, migration, environment edit, frontend build or Compose action occurred.

Final repeatable read-only readiness verifies twelve running services, fifty exact served assets, UID33 MySQL/Redis/parser, both read-only sockets, an actually idle worker and zero jobs. Original completed-story/protected fingerprints and all45 accepted profile source hashes remain unchanged. Source/runtime evidence is [reservation-authority-2026-10-13.json](evidence/reservation-authority-2026-10-13.json).

## Next slices and compatibility

The full reschedule/root-override checklist item remains open. Next prepare explicit current action eligibility/fresh revision and a bounded real replacement-slot reader, then connect the approved existing detail-page controls with ordinary reason/password/confirmation, cancellation, fresh checks and ambiguous-delivery safeguards. Successful live profile-save acceptance remains user-owned and deferred; this source guard does not claim it complete. Separate fresh-scanner recovery also remains open.

No database or image rollback is needed for this slice. Existing callers retain the same signatures and normal authorized behavior. Preserve these guards during client UI refactors or static-admin rollback; do not broadly restore the dirty worktree or remove audit/history/payment safeguards.
