# Phase 1E Implementation Blueprint and Closeout

Archived: 2026-08-16

This is the closed Phase 1E execution blueprint formerly stored in `CURRENT_TASK.md`. It is retained as historical evidence and must not be used as the active task. The active task now begins Phase 2 with a fresh source-versus-roadmap planning audit.

Snapshot date: 2026-08-16

## Status

Phase 1C, Phase 1D, and corrected Phase 1E items 16-20 are implemented and verified. After five test-only JSON key-order assumptions were corrected, the user-confirmed clean full disposable-MySQL suite passes 307 tests/1,816 assertions. The final Phase 1 roadmap item remains intentionally open for user additions; `AI_BOOT.md` has not been changed.

The canonical gap evidence is `docs/audits/phase-1e-gap-audit-2026-08-03.md`.

This file is both the guarded implementation blueprint and current completion record. Phase 2 and the parked Vite admin remain out of scope.

## Active Objective

Preserve the verified Phase 1E result and hold the final Phase 1 Working Mode item open for the user's additions.

Do not begin Phase 2/Vite work or change `AI_BOOT.md` until the user defines the additions to the remaining Phase 1 item.

## Current-State Summary

| Roadmap item | Preserve | Complete next |
| --- | --- | --- |
| 16. Booking | recurring rules/breaks, persistent immutable slots, public-ID booking/rescheduling, guarded slot/day/week controls, snapshots, MySQL concurrency proof | complete; regression only |
| 17. Lifecycle | verified/idempotent payment callback, canonical success, root override, locked ordinary cancellation/completion, audit, rating intent, payment-adjustment API | complete; regression only |
| 18. Questionnaire | exactly one server-validated answer per question, hidden scores, transaction-owned scoring/snapshots, HTML sanitation, multi-key rate limiting, deterministic recommendations/versioning, tamper tests | complete; regression only |
| 19. Medical | private quarantine/checksum/scan/download/archive plus request/upload/review/publish/amendment/patient-read workflow | complete; regression only |
| 20. Authority | root-only admin identity policy/service, explicit password contract, catalog create/update safeguards, account state, doctor verification, questionnaire, tenant controls, root overrides, payment adjustment, route audit, bulk prohibition | complete; regression only |

## Ordered Work Packages

### 16A. Recurring Schedule Rules, Breaks, And Materialized Slots â€” Complete

Goal: doctors declare recurring working hours, visit duration, daily price, and break intervals. The server materializes those rules into persistent dated visit slots with public ULIDs.

Required behavior:

- A recurring rule belongs to one active workplace service and contains weekday, working start/end, doctor-selected visit duration, effective dates, and optional day price/currency.
- A rule supports multiple non-overlapping breaks wholly inside its working hours. A generated slot may not cross or overlap a break; trailing fragments shorter than the declared duration are ignored.
- Each dated occurrence is persisted in `doctor_visit_slots` with an internal bigint key, public ULID, exact immutable start/end, resolved price/currency, and active state.
- Availability returns persistent slots and their public IDs. Clients never submit a timestamp, end, duration, price, currency, doctor, workplace, or checkup as booking authority.
- Booking locks and resolves the selected slot by public ULID, then derives every ownership, schedule, and financial fact on the server.
- Slot ordering is `starts_at`, then internal `id`; ULIDs and internal IDs are identities, not chronological sequence values.
- Archived/inactive checkup, hospital, workplace, service, unverified doctor, past time, and non-generated slot remain rejected.

Acceptance tests:

- rule validation covers reversed/overlapping windows, invalid duration, and invalid/overlapping/out-of-window breaks
- materialization excludes breaks and incomplete trailing fragments and does not duplicate occurrences
- slot-price, workplace-service-price, and catalog-price fallback paths
- arbitrary timestamp, owner, end, duration, price, currency, and unknown-slot tampering rejected
- API and Blade use the same persistent public slot IDs and resolved facts
- multi-workplace selection remains explicit
- existing booking/hold/idempotency regressions remain green

### 16B. Slot-ID Booking And History-Preserving Rescheduling â€” Complete

Goal: add an explicit, audited move to another persistent visit slot without reopening payment pricing or reassignment.

Required behavior:

- Admin or the assigned doctor may reschedule a live pending or confirmed reservation; patient rescheduling is not introduced.
- The replacement is identified only by public slot ULID and must belong to the same doctor/workplace/checkup. Its range may have a different derived duration.
- Preserve the reservation's original price snapshot, currency snapshot, payment summary, attempts, and payment state even if the replacement slot now has another price. Do not initiate refund, void, or repayment behavior.
- Require a non-empty reason and `ReservationPolicy::reschedule` authorization.
- Lock the reservation, doctor, and replacement slot; exclude the current reservation from conflict detection, then recheck overlap.
- Update start/end only after inserting append-only `reservation_schedule_changes` and a minimal fail-closed audit event in the same transaction.
- Reject terminal/expired reservations, past slots, invalid windows, inactive offerings, and audit failure.

Acceptance tests:

- assigned doctor/admin success and unauthorized/patient denial
- history contains exact previous/new values, actor, and reason
- current reservation does not conflict with itself
- another live hold/confirmed reservation blocks the move
- invalid state, past slot, inactive service, and audit failure roll back

### 16C. MySQL Booking Concurrency Gate â€” Complete

Goal: prove the existing doctor-row serialization plus locked conflict recheck prevents two overlapping commits.

Required behavior:

- Use a deterministic two-process disposable-MySQL test, not timing-only assertions.
- Cover overlapping create/create and create/reschedule or reschedule/reschedule as the implementation permits.
- Exactly one conflicting transition commits; the other receives a stable domain/validation failure.
- SQLite remains the compatibility suite; MySQL is authoritative for lock semantics.

### 16D. Immutable Slot, Day, And Calendar-Week Controls â€” Complete

Goal: permit doctors to change only price and availability at individual-slot, concrete-day, or concrete-calendar-week scope without mutating schedule identity or booked facts.

Required behavior:

- Slot `starts_at`, `ends_at`, workplace, checkup, doctor, rule, and currency are immutable after materialization.
- A doctor may set `is_active` and/or price for one future slot, every future slot on one local calendar date, or every future slot in one local calendar week.
- Controls are scoped to a workplace service owned by the authenticated doctor. A concrete week is not a recurring weekly-rule mutation.
- Bulk changes lock their target rows and affect only unreserved future slots. Booked slots and reservation money/payment snapshots remain untouched.
- A future working-hours, duration, or break change creates replacement rule versions and regenerates only future unreserved occurrences; historical and booked occurrences remain preserved.
- Every control requires a reason and writes a minimal fail-closed audit containing scope, target IDs/date, and old/new active/price factsâ€”never patient or payment data.

Acceptance tests:

- ownership/IDOR denial and past/reserved-slot rejection or exclusion
- time/ownership/currency mutation is impossible through the slot-control boundary
- individual, local-day, and local-calendar-week targeting
- price and active changes do not modify existing reservations or payments
- a later individual-slot control remains possible after a day/week bulk action
- audit failure rolls back the entire locked mutation

### 17. Central Reservation Lifecycle And Rating Intent â€” Complete

Goal: remove ordinary lifecycle mutation from controllers and make completion/cancellation atomic and idempotent.

Required behavior:

- `ReservationLifecycleService` owns patient cancellation and assigned-doctor completion.
- Use enum transitions, `ReservationPolicy`, row locks, timestamps, and minimal fail-closed audit.
- Completion requires `confirmed`, appointment start reached, `paid` summary, and a canonical successful attempt under the same lock.
- A repeated completion cannot duplicate audit/outbox effects.
- Completion publishes sanitized typed `reservation.completed` and `rating.requested` intents inside the transaction.
- Cancellation never changes payment facts or invents a refund. Paid cancellation and refund/void requests remain explicit separate facts.
- Add a root-admin-only, recent-password, reasoned API endpoint around the existing `PaymentAdjustmentService`.
- Do not add a provider SDK/webhook, executed refund, rating submission, or notification provider.

Acceptance tests:

- assigned doctor successful completion
- wrong doctor/patient/admin denial on ordinary completion
- early/unpaid/noncanonical/terminal failure
- audit or outbox failure rolls back completion
- exactly one rating request under repeated calls
- cancellation authorization/state/payment separation
- payment-adjustment HTTP authority, step-up, reason, and validation

### 18. Questionnaire Safety And Determinism â€” Complete

Goal: keep the existing server-owned scoring while closing stored-XSS, automation, version, and ambiguity gaps.

Required behavior:

- Move submission validation/scoring into a Form Request and transaction-owned service.
- Sanitize questionnaire and recommendation rich HTML on write through an explicit allowlist.
- Stop before adding a sanitizer dependency and request user approval; do not use `strip_tags` as the security boundary.
- Add a named limiter keyed by authenticated user when present, normalized-phone hash, and IP. Provider CAPTCHA is deferred until a canonical frontend/provider decision.
- Enforce `min_score <= max_score` and reject ambiguous overlapping range/priority combinations.
- Reject non-empty recommendation `conditions` until condition evaluation exists.
- Persist the actual questionnaire version in every submission snapshot.
- Return stable validation/error envelopes rather than controller `abort()` strings.

Acceptance tests:

- duplicate, missing, foreign, mismatched, and tampered answers
- hidden public scores/rules and deterministic totals/recommendations
- boundary and overlap validation
- version snapshot after questionnaire update
- malicious HTML removed while approved formatting survives
- limiter produces `429` without storing a submission

### 19A. Minimal Medical Request/Report Schema â€” Complete

Goal: add only the aggregates required by the approved backend vertical slice.

Authorized schema:

- `reservation_medical_requests`
- nullable `medical_request_id` on `reservation_files`
- `reservation_reports` with immutable publication and optional supersession
- backed enums for request and report states

Required constraints:

- marketplace-local reservation/patient/doctor ownership only
- public ULIDs and restrictive foreign keys
- explicit states/timestamps/retention/archive metadata
- published report history cannot be overwritten or physically cascaded away
- report body is separate from file storage and internal `reservation_notes`

Acceptance tests:

- fresh/rollback/reapply on SQLite and MySQL
- FK/retention/history behavior
- enum casts and mass-assignment exclusion of ownership/state/author/publication fields

### 19B. Medical Workflow Services And API â€” Complete

Goal: complete the backend sequence:

```text
assigned doctor request
    -> reservation patient upload
    -> scan result
    -> assigned doctor review
    -> immutable published report
    -> reservation patient view
```

Required behavior:

- Policies default-deny generic admins from file/report bodies.
- Patient upload must target their own reservation and an open doctor request.
- Only clean, active, retained files may be reviewed/downloaded.
- Assigned doctor owns request/review/report transitions.
- Published reports are immutable; amendments create a new report with `supersedes_report_id`.
- Patient resources expose only published outcome and approved clean-file metadata, never disk/path, scan internals, internal notes, or another patient's data.
- Audit uses IDs/state/timestamps only; no report body, request instructions, filenames, paths, or medical contents.
- Reuse the current scan-state service; do not select an antivirus provider or expose a public scan callback.
- No frontend/Blade/Vite medical UI.

Acceptance tests:

- golden backend flow from request through patient view
- patient/doctor ownership and IDOR failures
- generic-admin denial
- quarantine/infected/failed/retention download denial
- report immutability and amendment history
- fail-closed audit and PII/medical-data response/audit assertions

### 20. High-Authority Closeout â€” Complete

Goal: close only the remaining named authority gaps and prove the entire mutation surface.

Required behavior:

- Admin identity create/update requires explicit policy authority, recent password, a reason, and fail-closed audit.
- Remove the known `TempPass123!` fallback. Do not expose or log plaintext credentials. The exact provisioning flow must be approved before implementation.
- Catalog create/pricing/default-duration/currency changes use explicit policy, step-up, reason, transaction, and audit.
- Preserve already-passing account-state, doctor-verification, questionnaire, tenant-control, reservation-override, and payment-adjustment service rules.
- Bulk role upgrades remain forbidden. A future approved bulk archive must use soft deletion and one per-subject audit under a shared batch ID.
- Do not invent bulk endpoints just to satisfy this item.

Acceptance tests:

- normal admin cannot manage admin identities; root-admin can under all safeguards
- no known fallback credential path
- catalog create/update authority and audit rollback
- route-level audit proves every named high-authority mutation has policy, step-up where required, reason, transaction, and fail-closed audit

## Non-Negotiable Guardrails

- Complete work packages in order. Do not combine multiple numbered Phase 1E domains in one source change.
- Before each edit, reduce the work package to one behavior, one domain, at most three source files, and one focused verification path. If that is impossible, split again.
- Preserve `BookingService`, payment summary/attempt separation, callback verification, canonical-success locking, hold expiry, settings, files, audit, API, and outbox foundations.
- Do not trust client owner IDs, state, slot end/duration, price, currency, score, scan status, report publication data, or provider state.
- Do not add dependencies, provider SDKs, credentials, public callbacks, or malware/CAPTCHA adapters without explicit approval.
- Do not broaden generic admin access to medical content.
- Do not cross-write or query tenant operational databases.
- Do not implement tenant product features, Phase 2/Vite, Phase 3 UI, rating submission, or live notifications.
- Do not mark an item complete from schema or service existence alone; its reachable API behavior, regression coverage, and docs must agree.

## Verification Ladder

After each micro-slice:

1. focused tests for the changed behavior
2. focused Pint for touched PHP
3. relevant route/schema check

At item gates:

1. complete domain-focused SQLite suite
2. MySQL coverage for locking/schema semantics where applicable
3. module/current-task/TODO reconciliation

At the Phase 1 gate:

1. full SQLite suite
2. full disposable-MySQL suite
3. deterministic concurrency tests
4. marketplace and tenant fresh/seed/rollback/reapply lifecycle
5. full agreed Pint scope
6. non-vendor route discovery
7. final ownership/IDOR, PII/audit, session, CSRF/CORS, and migration checks

The user runs Docker build and Compose-heavy commands. Codex may run tests and read-only Docker inspection, but must leave image builds and Compose lifecycle commands to the user.

## Item 16 Completion Evidence

- `doctor_working_windows` now owns recurring workplace-service rules: weekday, working hours, doctor-selected duration, effective dates, and optional day money. `doctor_working_window_breaks` owns multiple validated break intervals.
- `SchedulingService` materializes persistent dated `doctor_visit_slots` for a rolling 90-day horizon in the hospital timezone. Each occurrence has a public ULID, immutable time/ownership/currency, active state, and resolved price; regeneration preserves existing manual overrides.
- Availability exposes the public slot ULID. API and Blade booking accept only `slot_id`; timestamp, owner, end, duration, price, and currency authority are prohibited. Reservations reference the slot and still snapshot all schedule and financial facts.
- Assigned-doctor and stepped-up admin rescheduling accept only a replacement slot ULID for the same offering, preserve original money/payment facts, append previous/new slot IDs and schedule history, and fail closed with audit.
- Doctors can change active state and/or price for one slot, one concrete local day, or one ISO calendar week. Locked bulk operations exclude past or ever-reserved slots, preserve reservations/payments, enforce ownership, and roll back on audit failure.
- Slot ordering is `starts_at`, then internal `id`; neither internal IDs nor ULIDs encode display order.
- Final SQLite gate: 201 tests/1,017 assertions with three expected MySQL-only skips. Focused MySQL schema/materialization/seed/booking/reschedule/control coverage passes 20 tests/104 assertions; deterministic MySQL create/create and create/reschedule each pass (17 assertions total). Dirty Pint passes 40 files.

## Item 17 Completion Evidence

- `ReservationLifecycleService` now owns ordinary patient cancellation and assigned-doctor completion behind `ReservationPolicy`, enum transitions, transaction-scoped locks, timestamps, and fail-closed audit.
- Cancellation requires a reason, is idempotent, preserves the payment summary/canonical attempt, creates no adjustment, and keeps another patient's reservation hidden behind the existing not-found boundary.
- Completion requires exactly `confirmed`, an appointment whose start has been reached, a `paid` summary, and its locked canonical `succeeded` attempt with matching reservation, summary, amount, currency, and completion fact.
- First completion writes one sanitized audit event plus typed `reservation.completed` and `rating.requested` outbox intents in the same transaction. Repetition produces no duplicate audit or outbox effects; audit/outbox failure rolls everything back.
- `POST /api/admin/payments/{payment:public_id}/adjustments` exposes only the existing pending refund/void request boundary. It requires root-admin authority, recent session password confirmation, a reason, and server-owned payment facts; it performs no provider call or executed refund/void transition.
- Focused lifecycle/payment/outbox regressions pass 32 tests/156 assertions. The full SQLite gate passes 215 tests/1,102 assertions with the three expected MySQL-only concurrency skips; touched Pint and payment-adjustment route discovery pass.

## Item 18 Progress Evidence

- `SubmitQuestionnaireRequest` now owns structural input validation and prohibits client-owned questionnaire/version/user/score/result/recommendation facts.
- `QuestionnaireSubmissionService` owns the locked transaction, exact question-set/choice validation, canonical question-order snapshot, server scoring, deterministic ordered recommendation read, submission creation, and guest lead update.
- The service uses a trusted `forceFill` boundary for `questionnaire_version`, which remains excluded from public mass assignment. Tests prove snapshots advance from version 7 to version 8 instead of silently using the database default.
- Missing, duplicate, foreign, mismatched, and client-tampered answers return the shared stable API validation envelope without controller `abort()` strings. Focused coverage passes 4 tests/29 assertions and touched Pint passes.
- The required dependency stop was honored; implementation resumed only after explicit user approval and installation.

## Item 18 Completion Evidence

- The approved `symfony/html-sanitizer:^7.4.14` LTS dependency is installed. A reviewed allowlist preserves only basic text structure and `http`/`https`/`mailto`/`tel` links with `href`/`title`; styles, classes, IDs, event handlers, scripts, images, forms, iframes, embedded media, unsafe schemes, and relative links are removed on admin create/update.
- Dependency installation exposed 38 advisories across 13 stale packages. A controlled compatible update moved Laravel to 12.66.0, Symfony components to maintained 7.4.x, Guzzle to 7.15.3/PSR-7 2.13.0, CommonMark to 2.10.0, PHPUnit to 11.5.56, and PsySH to 0.12.24. Strict Composer validation and the locked audit now pass with zero advisories.
- `SubmitQuestionnaireRequest` and `QuestionnaireSubmissionService` own structural validation, a locked transaction, exact question/choice matching, canonical answer snapshots, server scoring, actual questionnaire version, deterministic recommendation selection, and guest lead updates.
- The named `questionnaire-submissions` limiter applies independent authenticated-user, normalized-phone-hash, and IP budgets. Equivalent Persian/international phone forms share a bucket; raw phone values are not used in limiter keys; throttled requests return the stable API `429` envelope and store nothing. CAPTCHA remains deferred.
- Admin writes reject reversed score ranges, inclusive overlapping ranges at the same priority, and non-empty unsupported conditions. Overlap with distinct priorities remains valid and selects the lowest numeric priority deterministically.
- Focused questionnaire coverage passes 11 tests/79 assertions. The final SQLite gate passes 224 tests/1,170 assertions with three expected MySQL-only skips; 14 touched PHP files pass Pint, route discovery shows the named limiter, and `git diff --check` passes.

## Item 19A Completion Evidence

- `reservation_medical_requests` and `reservation_reports` now provide public ULIDs, explicit backed-enum states, lifecycle/publication timestamps, retention and soft-archive metadata, restrictive ownership/history foreign keys, and an optional same-request supersession chain. `reservation_files.medical_request_id` remains nullable for existing reusable private files.
- Composite foreign keys prevent a file or report from referencing another reservation's medical request and prevent an amendment from superseding a report outside its reservation/request history.
- Models exclude reservation/request/uploader/author/state/publication/retention/archive facts from mass assignment. Request states require consistent review/close timestamps; reports require state-consistent publication timestamps; and a published report rejects update and delete operations. Amendments may point only to published predecessors.
- Request/report factories preserve reservation-to-doctor ownership by default. The existing quarantine/checksum/scan/download/archive file service remains green after tightening file ownership mass assignment.
- Focused SQLite schema, rollback/reapply, factory, file-service, FK, state, and history coverage passes 17 tests/111 assertions. All 12 touched PHP files pass Pint and `git diff --check` passes.
- User-confirmed disposable-MySQL verification passes the same 17 tests/111 assertions, including fresh migration, rollback/reapply, composite ownership/history constraints, factories, immutable publication, and the existing file-service regressions. Item 19B routes, policies, services, and resources had not started at this gate.

## Item 19B Completion Evidence

- Assigned doctors create and rediscover medical requests by reservation/request public ULID. `ReservationMedicalRequestService` locks ownership and state, accepts only confirmed/completed reservations for creation, and moves an open request into review only when a clean, private, active, retained file exists.
- Reservation patients rediscover their requests and upload PDF/JPEG/PNG files only to their own open request. Storage path, owner, request link, quarantine state, checksum, MIME facts, and retention remain server-owned; audit failure removes both stored file and database row.
- The existing internal `recordScan()` boundary is reused. Linked-file scan/access/archive/replacement audit payloads contain IDs, states, and timestamps only, and replacements preserve their request link. No provider, public callback, credential, or scanner adapter was added.
- `ReservationReportService` owns plain-text drafts, correction before publication, locked publication, request completion, idempotence, and amendments as new rows referencing a published predecessor. Published rows remain immutable and cannot be soft/physically deleted through the model/history FKs.
- Patient outcome/history resources return only completed requests, active published report bodies marked `plain_text`, and clean/private/active/retained file metadata. Draft/expired reports, unsafe files, storage/checksum/scan internals, internal notes, owner IDs, and other patients are absent. Generic admins and root admins have no medical body/file policy authority.
- The golden API flowâ€”doctor request, patient upload, internal scan result, doctor review, draft/publication, patient outcome, and clean downloadâ€”passes. Focused medical/schema/API/audit coverage passes 58 tests/485 assertions; all 39 touched PHP files pass Pint; 68 API routes load with no public scan callback.
- The full SQLite regression gate passes 267 tests/1,547 assertions with the three expected MySQL-only concurrency skips. Item 19A separately passed its user-confirmed disposable-MySQL lifecycle/constraint gate.

## Item 20 Completion Evidence

- The user approved a root-admin-controlled password suggestion design. The future browser popup will generate a memorable multi-word suggestion locally and allow the root admin to replace it; no suggestion endpoint, server-returned plaintext credential, email invitation, provider, or Vite UI was added in Phase 1E.
- Admin-created identities now require a confirmed 15-64 character password and reject a local baseline of common or account-derived choices. The password is hashed before persistence and excluded from resources and audit. The general user-update endpoint prohibits password replacement; the existing reset/change-password workflows remain the credential-change boundary.
- `UserPolicy` and `AdminIdentityService` now enforce root-only admin identity creation/promotion/update/demotion, a non-empty reason, transaction-scoped mutation, and fail-closed audit. The old optional `TempPass123!` path has no remaining source/test/config reference.
- Checkup creation and update now use explicit `CheckupPolicy` abilities, recent password confirmation, a reason, a transaction, and fail-closed audit. Price, three-letter uppercase currency, and default duration (5-720 minutes) are required on both writes and exposed by the existing Blade forms instead of silently using model defaults.
- `HighAuthorityRouteContractTest` fixes the named privileged mutation inventory at 21 routes and proves auth, active-account, admin/root-admin role, and recent-password middleware. It also proves no bulk/mass/role-upgrade admin mutation route exists. Future approved bulk archive remains soft-delete-only with one audit row per subject under a shared batch ID.
- Focused identity coverage passes 19 tests/106 assertions; focused catalog coverage passes 24 tests/215 assertions; the route contract passes 22 tests/127 assertions. The combined named high-authority regression passes 124 tests/780 assertions, including questionnaire and rating-option create/update/archive audit rollback.
- Final SQLite passes 304 tests/1,796 assertions with the three expected MySQL-only concurrency skips. The 20 touched PHP files pass Pint, 68 API/121 total non-vendor routes load, `git diff --check` passes, and item 20 added no dependency or provider.
- The first full MySQL run reached 302 passes/1,816 assertions and found five assertions that treated decoded JSON object key order as meaningful. MySQL stores native JSON with implementation-defined key ordering, while SQLite had preserved PHP insertion order. The assertions now compare the exact key sets independent of order; the four affected files pass focused MySQL verification with 25 tests/194 assertions.
- The user-confirmed clean full MySQL rerun passes 307 tests/1,816 assertions with no errors. This closes the backend verification dependencies for the Phase 1 gate.
- Durable closeout evidence is `docs/audits/phase-1e-high-authority-closeout-2026-08-16.md`.

## Next Action

Wait for the user's additions to the final Phase 1 Working Mode item. Keep that checkbox open, leave `AI_BOOT.md` unchanged, and do not begin Phase 2 before the expanded item is agreed and completed.


