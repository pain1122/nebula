# Phase 1E Correctness And Security Gap Audit

Snapshot date: 2026-08-03

Status: historical planning evidence for Phase 1E items 16-20. The gaps below describe the 2026-08-03 starting point; corrected items 16-20 were subsequently implemented and verified. Current closure evidence is `docs/audits/phase-1-verification-gate-2026-08-16.md`.

## Purpose

This audit compares the Phase 1E roadmap with the actual Laravel schema, models, services, policies, controllers, routes, and tests after Phase 1C/1D. Its purpose is to prevent two errors:

- rebuilding foundations that already pass
- marking broad roadmap language complete while product-facing correctness remains missing

Phase 1C verification remains the starting baseline: SQLite 186 tests/950 assertions with one expected MySQL-only skip, disposable MySQL 187 tests/961 assertions, touched Pint, 104 non-vendor routes, and deterministic payment concurrency.

## Executive Result

| Item | Current result | Main remaining boundary |
| --- | --- | --- |
| 16. Booking correctness | Partially implemented | replace client-influenced subdivision with service-specific declared slots/pricing, implement audited rescheduling, validate ranges, prove concurrent overlap safety on MySQL |
| 17. Payment/reservation lifecycle | Strong payment foundation, incomplete product transition | move cancellation/completion into one locked service and emit one rating-request intent |
| 18. Questionnaire integrity | Answer completeness and server scoring exist | sanitize stored HTML, add anti-automation, close recommendation/version/test gaps |
| 19. Medical workflow | Private file foundation exists | add requested-result and immutable published-report workflow plus APIs/policies |
| 20. High-authority paths | Most named paths are protected | close admin-user, catalog-create/pricing, payment-adjustment HTTP, and future-bulk gaps |

This audit records the pre-implementation gap state. Corrected items 16-20 are implemented as of 2026-08-16; current status is tracked in `CURRENT_TASK.md`, and item-20 evidence is `docs/audits/phase-1e-high-authority-closeout-2026-08-16.md`.

## 16. Booking Correctness

### Already implemented and verified

- `BookingService::createReservation()` is the shared API/Blade write boundary.
- Booking locks the patient, active checkup, and doctor before the final decision.
- Eligibility is based on active `doctor_workplace_checkup`, not the removed `checkup_doctor` pivot.
- The current offered duration resolves from `duration_override_minutes` or `checkups.default_duration_minutes` and booking rejects a different client value. This is verified existing behavior, but it is superseded by the approved declared-range rule.
- `assertRequestedSlotIsGenerated()` currently rejects non-positive duration, past/current starts, and non-generated slots.
- `SchedulingService::hasConflict()` uses true interval overlap and the `Reservation::blocking()` scope.
- Only confirmed reservations and live pending holds block availability.
- One-hour holds, synchronous expiry checks, scheduled expiry, retry idempotency, and hold caps exist.
- The reservation snapshots actual duration, start/end/timezone, workplace/hospital, doctor, checkup, price, and currency.
- `reservation_schedule_changes` and `ReservationScheduleChange` reserve append-only history.

### Gaps recorded on 2026-08-03

1. No reschedule service, request, route, controller action, or behavior test exists. Only schema, relation, and `ReservationPolicy::reschedule()` exist.
2. `BookingApiController::availability()` accepts an arbitrary `slot` value and does not bind availability to a selected checkup/offering. It can advertise a range that `BookingService` must reject.
3. Blade `BookingController::pickTime()` generates 30-minute ranges and its view hardcodes 30/45/60 choices; patients can influence duration even though the doctor must own every declared range.
4. The existing workplace-service pivot can override price/currency, but a declared range/day cannot. It also stores a duration override that conflicts with exact declared ranges.
5. `DoctorScheduleService` rejects reversed ranges but does not reject duplicate/overlapping ranges, does not bind them to a workplace service, and hardcodes `slot_duration_minutes` to 30.
6. Creation locks the doctor row, which should serialize competing bookings for one doctor, but there is no deterministic MySQL test proving two overlapping concurrent requests cannot both commit.
7. Cancellation and completion still contain raw/enum normalization and transition logic in `BookingApiController`, so reservation policy is not centralized.
8. `docs/architecture/boundaries.md` still names `checkup_doctor`; this is stale.

### Approved implementation boundary

- Store recurring working-hour rules with doctor-selected duration, daily money, effective dates, and multiple breaks, then materialize persistent dated occurrences tied to an active workplace service.
- Expose and accept only the occurrence public ULID at booking/rescheduling boundaries; patients never select trusted owner, timestamp, duration, or money facts.
- Resolve occurrence money from rule/day, workplace service, then active checkup base and snapshot it at booking.
- Validate working-window and break direction/overlap/containment before replacement.
- Implement Phase 1E rescheduling to another persistent slot for the same doctor/workplace/checkup. It supports live pending and confirmed reservations, rejects terminal/expired states, preserves slot/time history, requires a reason, authorizes admin/assigned doctor, locks and conflict-checks, and fails closed when audit fails.
- Rescheduling preserves the reservation's original price snapshot, currency snapshot, payment summary, attempts, and payment state even if the replacement range has another current price. It does not initiate refund, void, or repayment behavior.
- Do not add cross-doctor/workplace/service reassignment in this slice. The existing history schema may carry identical previous/new workplace IDs.
- Extend conflict checking with an explicit current-reservation exclusion for rescheduling.
- Add deterministic MySQL concurrency coverage for overlapping creation/rescheduling.

### Corrected completion result — 2026-08-09

- The first completion claim was reopened after review found that clients still selected timestamps and recurring range rows were being treated as visit identities.
- `doctor_working_windows` now owns recurring workplace-service rules with doctor-selected duration, effective dates, and day money; `doctor_working_window_breaks` owns multiple contained, non-overlapping breaks.
- `doctor_visit_slots` is the persistent dated occurrence source. Every occurrence has a public ULID, exact immutable time/ownership/currency, resolved price, and active state. Materialization uses hospital-local calendar rules, excludes breaks/trailing fragments, preserves existing overrides, and is replenished daily for a rolling 90-day horizon.
- API and Blade availability expose public slot IDs. Booking and rescheduling accept only a slot ULID and derive ownership, range, duration, price, currency, and snapshots server-side.
- Reservations and schedule history retain current/previous/new slot foreign keys as well as immutable time and financial facts. Rescheduling remains same-offering and never invokes refund or repayment behavior.
- `DoctorVisitSlotControlService` provides reasoned, audited price/active controls for an individual slot, concrete local day, or concrete ISO calendar week. Locked bulk changes exclude past and ever-reserved slots and roll back on audit failure.
- Deterministic MySQL create/create and create/reschedule tests lock through the production public-ID index and retain the final locking conflict read. Testing also caught and fixed MySQL foreign-key identifier length and mixed-index lock-order issues.
- Verification closed with SQLite 201 tests/1,017 assertions (three expected MySQL-only skips), focused MySQL schema/materialization/seed/booking/reschedule/control 20 tests/104 assertions, deterministic MySQL booking concurrency 17 assertions, and dirty Pint across 40 PHP files.

## 17. Payment And Reservation Lifecycle Integrity

### Already implemented and verified

- Payment summary, attempts, provider-event receipts, and adjustments are separate retained records.
- `PaymentLifecycleService` verifies callback authenticity before writes, deduplicates external events, locks the summary/reservation/attempt, chooses one canonical success, and reconciles late/competing success.
- Successful payment confirms only a live pending hold.
- Root-admin override uses `ReservationOverrideService`, `ReservationPolicy`, row locks, recent password middleware, a reason, payment checks, and fail-closed audit.
- Refund/void reservation requests are guarded through `PaymentAdjustmentService`; they do not falsely claim provider execution.
- A doctor completion route exists and checks assigned-doctor ownership, paid summary state, and appointment time.
- Rating-option administration and active client reads exist.

### Actual gaps

1. `doctorCompleteReservation()` changes status directly in the controller without policy authorization, a shared lifecycle service, a transaction, a reservation/payment lock, or audit.
2. Completion checks only the summary string state and does not require the canonical successful attempt under the same lock.
3. Patient cancellation also mutates directly in the controller and duplicates lifecycle rules instead of using `ReservationPolicy` and one transition service.
4. There is no typed `reservation.completed` or `rating.requested` outbox event and no idempotent rating-request trigger.
5. No focused API test proves successful doctor completion, non-owner denial, race safety, audit rollback, or exactly-once rating intent.
6. `PaymentAdjustmentService` has service tests but no root-admin, stepped-up, reasoned HTTP endpoint.
7. There is intentionally no public provider callback adapter or SDK. The provider-neutral callback contract is sufficient for Phase 1E; the deterministic sandbox/provider HTTP adapter remains Phase 3.

### Approved implementation boundary

- Introduce one `ReservationLifecycleService` for ordinary cancellation and doctor completion.
- Use enum-only transitions, policy authorization, deterministic lock ordering, payment/canonical-success validation, timestamps, minimal audit snapshots, and typed outbox intent in the owning transaction.
- Completion is allowed once for an assigned doctor when a confirmed reservation has a paid summary and canonical successful attempt and the appointment start has been reached. A root override remains a separate critical path.
- Pending unpaid patient cancellation may complete immediately. Confirmed paid cancellation may preserve paid payment history and reservation cancellation as separate facts; it must not invent a refund. Refund/void remains an explicit adjustment request.
- Emit one sanitized `reservation.completed` event and one `rating.requested` event. Do not add notification providers, a rating-submission product, or provider webhooks here.
- Expose the existing payment-adjustment request service through a root-admin-only, recent-password, reasoned API boundary without claiming provider execution.

No new rating table is required for Phase 1E; the durable outbox transition is the trigger boundary.

## 18. Questionnaire Integrity

### Already implemented

- Public definitions exclude choice scores and recommendation rules.
- The submit action loads server-owned questions/choices, rejects duplicate question IDs, requires the submitted question set to equal the questionnaire question set, rejects foreign choices, and calculates the total from stored scores.
- Submission snapshots include question/choice text, score, total, recommendation result, questionnaire title/slug, and a questionnaire-version column.
- Questionnaire administration uses Form Request validation, policy checks, recent password middleware, transactions, versions, reasons, and fail-closed audit.
- Questionnaire/submission archive uses soft deletion and preserves history.

### Actual gaps

1. `content_html` and recommendation `body_html` accept arbitrary HTML and are returned publicly without sanitization. This is a stored-XSS boundary.
2. The public submit route has no limiter and no recorded CAPTCHA/anti-automation decision.
3. Recommendation input does not enforce `min_score <= max_score` or a deterministic overlap/tie policy.
4. `conditions` are stored but ignored by scoring, which can imply unsupported behavior.
5. `QuestionnaireSubmission::$fillable` omits `questionnaire_version`; `create()` therefore silently keeps the database default instead of the real published version after questionnaire edits.
6. Existing answer-integrity coverage proves the duplicate case but does not separately prove missing answers, foreign question IDs, choice/question mismatch, invalid choices, score tampering, recommendation boundary behavior, or version snapshots.
7. Submission validation/scoring lives in a large controller action and uses ad-hoc `abort(422, ...)` responses rather than the stable API error contract.

### Approved anti-automation decision

Phase 1E will use a named, multi-key submission limiter based on authenticated user when present, normalized-phone hash, and IP, with explicit `429` tests. A provider CAPTCHA is not selected during the backend foundation phase because no canonical questionnaire frontend/provider/credential lifecycle exists. Phase 3 may add a provider adapter if product abuse evidence or deployment policy requires one.

### Approved implementation boundary

- Move public validation/scoring into a Form Request plus a transaction-owned questionnaire submission service.
- Sanitize rich HTML on write using a reviewed allowlist and return only sanitized stored content.
- A mature sanitizer package is preferred; adding it is a dependency change and requires explicit user approval before implementation.
- Reject ambiguous recommendation ranges/priority ties and reject non-empty `conditions` until condition evaluation is intentionally implemented.
- Fix the questionnaire-version snapshot and add the missing tamper/boundary/regression matrix.
- Preserve server-owned scores and result snapshots; never expose internal per-answer scoring rules publicly.

No questionnaire schema expansion is currently required.

## 19. Medical Record And File Safety

### Already implemented and verified

- `reservation_files` has private/opaque storage metadata, checksum, MIME/extension/size, classification, scan state, retention, archive metadata, ULID, and soft delete.
- `ReservationFileService` validates PDF/JPEG/PNG up to 10 MiB, writes quarantine storage, compensates failed database/audit writes, records scan transitions, restricts downloads to clean/non-expired/private files, and audits upload/access/archive/scan.
- `ReservationFilePolicy` checks reservation relationship ownership.
- `reservation_notes` has retained author/visibility/type/body structure.
- File service tests cover invalid MIME, quarantine, clean/infected/failed constraints, unauthorized download, retention, private disk enforcement, replacement, and fail-closed audit.

### Actual gaps

1. There is no requested-test/result aggregate or lifecycle.
2. A file cannot be linked to a doctor request.
3. There are no HTTP upload/download/scan/review routes or explicit API Resources/Form Requests for the medical workflow.
4. `ReservationFilePolicy` currently grants generic marketplace admins medical-file upload/view/archive through `canAccessAdminPanel()`. That is broader than least privilege and the Phase 1D contract.
5. There is no report aggregate, state, publication, immutable final outcome, amendment chain, patient-visibility rule, service, policy, or route.
6. `reservation_notes` has no service/policy and must not be treated as the patient-visible report.
7. The scan-state service exists, but no provider or internal delivery endpoint exists. Provider selection remains outside Phase 1E.

### Minimal schema authorized by the blueprint

1. `reservation_medical_requests`
   - public ID, reservation, requesting doctor user, request type/title/instructions, enum state, due/review/close timestamps, retention/archive fields
2. nullable `medical_request_id` on `reservation_files`
   - ties an upload to one request while retaining the reusable file aggregate
3. `reservation_reports`
   - public ID, reservation/request, doctor author and snapshot, enum state, patient-visible published body, published timestamp, optional `supersedes_report_id`, retention/archive fields

### Approved workflow boundary

```text
assigned doctor creates request
    -> reservation patient uploads one or more quarantined files to the open request
    -> scanner service records clean/infected/failed
    -> assigned doctor reviews only clean active files
    -> doctor publishes an immutable report/outcome
    -> reservation patient reads the published outcome and authorized clean files
```

- Generic admin authority does not grant medical-body or file access.
- Draft reports may be replaced before publication; published reports are never edited in place. An amendment creates a new report referencing the superseded report.
- `reservation_notes` remain care-team/internal notes and are not returned to patients by the report endpoint.
- Audit payloads contain IDs/state/timestamps only, never report body, instructions, filename/path, or medical contents.
- Phase 1E uses the existing scanner contract/service state transition; no antivirus vendor, credential, or public scan callback is selected.
- The slice is backend/API only. No Vite or Blade medical UI is included.

## 20. Remaining High-Authority Paths

| Path | Current state | Remaining work |
| --- | --- | --- |
| Admin-to-admin authority | root-only admin identity management, step-up, audit, and boundary tests exist | require reasons for admin identity create/update; remove known optional fallback password; move authority into an explicit policy/service boundary |
| Account state | root-only policy, reason, step-up, session/token revocation, audit, rollback tests complete | regression only |
| Doctor verification | policy, step-up, reason, transaction, audit, rollback tests complete | regression only |
| Catalog pricing/update | update has step-up, reason, transaction, audit | authorize via explicit policy; include currency/default duration; cover create/pricing authority and fail-closed audit; do not silently use a public known default password-style shortcut anywhere |
| Questionnaire administration | policy, step-up, reason, audit, archive safety complete | HTML/scoring integrity from item 18 plus regression |
| Tenant registry/features/settings | root-only policy/service, step-up, reason, audit, field allowlist complete | regression only; tenant-local HTTP product remains Phase 7 |
| Reservation override | root-only policy/service, step-up, reason, payment checks, locks, audit complete | regression plus ordinary lifecycle separation from item 17 |
| Payment adjustment | root-only policy/service, reason, locks, audit complete | add the missing stepped-up HTTP boundary |
| Future bulk operations | no bulk mutation endpoints exist | explicitly forbid bulk role upgrades; require soft archive where applicable and one per-subject audit event under a shared batch ID when a real bulk endpoint is later approved |

## Execution Order

1. 16A — recurring rules, breaks, persistent dated slot materialization, and public-ID availability/booking.
2. 16B — audited public-ID same-offering rescheduling and immutable slot/time history.
3. 16C/16D — deterministic MySQL overlap proof plus guarded slot/day/week price/active controls.
4. 17 — centralize cancellation/completion and add exactly-once rating intent/payment-adjustment API.
5. 18 — close questionnaire HTML, anti-automation, scoring, snapshot, and test gaps.
6. 19A — add the minimal medical request/report schema and enums/models.
7. 19B — implement policies/services/API resources and the complete backend medical acceptance flow.
8. 20 — close remaining admin-user/catalog/payment HTTP authority gaps and run the high-authority route audit.
9. Phase 1 gate — full SQLite/MySQL/Pint/routes/migration lifecycle/security verification and documentation reconciliation.

This order keeps booking locks stable before completion logic, closes public stored-XSS before frontend work, and gives the medical workflow its own explicit schema gate.

## Scope Guardrails

- No Phase 2/Vite work.
- No payment, mail, SMS, push, CAPTCHA, malware-scanner, or storage provider selection without explicit approval.
- No tenant-local feature implementation; tenant product work remains Phase 7.
- No cross-database query/write path.
- No provider callback route is required for Phase 1E; the provider-neutral payment contract remains the boundary until Phase 3.
- No rating submission product, notification inbox, or medical UI.
- No direct controller status mutations after the lifecycle service is introduced.
- No public or generic-admin access to medical body/file content.
- No broad refactor across all controllers; each work package must stay independently reviewable and tested.

## Phase 1E Completion Evidence Required

- Every item 16-20 sub-gate is checked only after source, tests, and docs agree.
- Focused SQLite tests pass after each work package.
- Booking/payment concurrency behavior is proven on disposable MySQL.
- Fresh migration/seed/rollback/reapply remains green on SQLite and MySQL after medical schema work.
- Full SQLite and disposable-MySQL suites pass.
- Touched PHP passes Pint and the route list loads.
- Public questionnaire HTML and medical resources have explicit privacy/security tests.
- `CURRENT_TASK.md`, module docs, `docs/PROJECT_MAP.md`, and `docs/TODO.md` are reconciled before Phase 1 is closed.
