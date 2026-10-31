## Verification Status

October16 root-only Staff directory is deployed/accepted on healthy55f10d0b/64 assets, retained staff-directory-accepted-2026-10-16 with eadb icon rollback. User reserves /panel/users for admins/future content managers and explicitly defers defining the content-manager role. Existing route/sidebar now root-only; new GET /api/admin/staff reloads active root before/after reads, excludes clinical/mixed/root identities, refuses role overrides and redacts private fields. Staff form permits admin only with retained reason/password/audit controls; no live save. Patient/doctor directories retain existing users API and metadata-only support profiles/clinical Back links. Isolated32/341/Pint3/full frontend70/728/all quality/unchanged ratchets/31 UID33 read-only checks/eleven guest401/11 native groups50 requests/two ENFA desktop-mobile mirrors/four captures pass. Source tests cover role/session/refusal/unsafe response and clinical compatibility; one existing reservation failure fixture stabilized, production reservation code unchanged. All clinical-financial-provider-adjustment-catalog-schedule-protected fingerprints/nine services/stopped helpers-scanner retained. Read docs/deployment/staff-directory-2026-10-16.md and immutable binding. No role/permission assignment, dependency/schema/env/credential/business/password/download/provider/queue/backend Compose change. Content-manager permissions, positive live saves/concurrent MySQL/current scanner/user-owned profile/refund/media/content gates and narrow Farsi weekday headings remain separate. Supplemental completed support reads pass5 groups/31 requests/four captures for ordinary-admin patient4/doctor5 HTTP200/render/Back in ENFA; no writer replay.

Historical full-suite checkpoint: 2026-08-16 (current scoped verification is above)
Verification method:
- repo inspection
- SQLite full backend suite: 186 tests, 950 assertions, with one expected MySQL-only skip
- disposable-MySQL full suite: 187 tests, 961 assertions, including a deterministic two-process row-lock regression
- marketplace/tenant migration lifecycle and MySQL schema/isolation inspection
- focused payment lifecycle, adjustment, override, hold-expiration, failure, and touched-file Pint checks
- Phase 1E item-17 focused regressions: 32 tests/156 assertions; full SQLite: 215 tests/1,102 assertions with three expected MySQL-only skips
- final Phase 1 baseline: SQLite 304 tests/1,796 assertions with three intentional MySQL-only skips; user-confirmed MySQL 307 tests/1,816 assertions

If this file conflicts with source code, source code wins.
Update this module after verification.


# Payment Context

Use this module for payment rows, providers, callbacks/webhooks, reservation payment state, refunds, or payment status transitions.

Do not load this module for normal role, admin shell, checkup CRUD, or booking UI work unless reservation/payment lifecycle is touched.

## Current State

- Five safe admin/root payment read APIs and both approved panel pages are accepted. Exact DTOs and independent histories omit provider references/callback bodies/idempotency/error/reason/private identity data. Root request preview and the existing POST now enforce fresh locked active authority, canonical consistency, actor-bound expiring revision, confirmation, duplicate/stale rejection and atomic audit. No provider execution or lifecycle mutation. The approved root request modal is now accepted in English/Farsi with signed preview, exact amount, confirmation/password and uncertain-result controls; positive live requests/concurrent MySQL writes stay separate. [Current scope](../../deployment/admin-payment-panel-2026-10-16.md).

- Local sandbox on image 8c8bb2e4 is browser-accepted October 5 after user-run backend start; no rebuild pending. One ordinary new reservation 8 for patient account 4/doctor account 5 passed Farsi failure, English new-attempt success, reversed/duplicate terminal results and paid/confirmed scoped visibility. Read-only MySQL verifies one canonical success, two verified provider events, unchanged 7,000,000 IRR/expiry and three pending outbox intents. Same derived identity replay was checked at lifecycle level; original-client-key HTTP replay remains covered by October 4 source tests, not repeated deployed evidence. Local/testing-only HMAC gateway, server facts, shared Velzon Dialog/query/CSRF and locks remain unchanged. Historical source quality 48/260, build 5.41 seconds, backend 31/190. Evidence: `docs/deployment/demo-sandbox-payment-2026-10-04.md`. Reservation 7 is expired and rejected; never extend/backdate holds. Protected patient accounts 7/8 are untouched. Real providers/dependencies/topology remain excluded.

- The compatibility `Payment` model maps to `reservation_payment_summaries`; booking creates exactly one unpaid summary without assuming a provider.
- `payment_attempts` supports repeated provider attempts with provider-scoped idempotency/reference uniqueness. Provider events and adjustments have separate retained tables.
- `PaymentSummaryStatus`, `PaymentAttemptStatus`, `PaymentAdjustmentType`, and `PaymentAdjustmentStatus` provide enum-safe persistence boundaries.
- `PaymentLifecycleService` owns idempotent attempt creation, signature-first provider callback processing, external-event deduplication, locked canonical-success selection, late/competing-success reconciliation, and reservation confirmation.
- A newly created attempt writes `payment.attempt.requested` in the same transaction; an idempotent retry returns the existing attempt without publishing another logical event. Focused and full SQLite/MySQL regressions pass.
- `PaymentGateway` is provider-neutral. A local-only deterministic sandbox adapter is implemented for the approved demo; no real provider SDK, credential or anonymous public provider callback adapter has been selected.
- `PaymentAdjustmentService` allows a stepped-up root admin to reserve a server-owned refund/void amount with a reason and fail-closed audit. A pending adjustment is a request boundary, not proof that a provider executed it.
- `POST /api/admin/payments/{payment:public_id}/adjustments` exposes that request boundary to root admins only and requires recent session password confirmation, reason, expected_revision, expires_at and explicit confirmed acceptance. Client-provided currency, state, provider, attempt, and reservation facts are prohibited.
- `ReservationOverrideService` owns explicit root-admin reservation overrides under policy, recent-password, reason, payment checks, row locks, and transactional audit.
- `ReservationHoldService` and the every-minute `ExpireOverdueReservationHolds` job expire overdue reservations and open attempts idempotently; attempt retries never extend the reservation hold.
- The MySQL-only concurrency regression holds a payment-summary row in one process, starts a competing successful callback in another, verifies lock waiting, and proves one canonical success plus one reconciliation.
- Admin reservation API includes payment details when loading reservations.
- Reservation status and payment status are separate concepts.
- `ReservationLifecycleService` owns assigned-doctor completion and accepts only a started confirmed reservation whose locked paid summary points to a matching succeeded canonical attempt. Completion atomically writes fail-closed audit and sanitized `reservation.completed`/`rating.requested` outbox intents.

## Open First

- `app/Models/Payment.php`
- `app/Models/Reservation.php`
- `app/Models/ReservationStatus.php`
- `app/Models/PaymentAttempt.php`
- `app/Models/PaymentAdjustment.php`
- `app/Enums/PaymentSummaryStatus.php`
- `app/Enums/PaymentAttemptStatus.php`
- `app/Enums/PaymentAdjustmentType.php`
- `app/Enums/PaymentAdjustmentStatus.php`
- `app/Contracts/Integrations/PaymentGateway.php`
- `app/Services/PaymentLifecycleService.php`
- `app/Services/PaymentAdjustmentService.php`
- `app/Services/ReservationOverrideService.php`
- `app/Services/ReservationHoldService.php`
- `app/Jobs/ExpireOverdueReservationHolds.php`
- `app/Http/Controllers/Front/BookingController.php`
- `app/Http/Controllers/Api/BookingApiController.php`
- `app/Http/Controllers/Api/AdminReservationController.php`
- `app/Services/BookingService.php`
- `database/migrations/2025_11_09_123759_create_payments_table.php`
- `database/migrations/2025_11_09_123756_create_reservations_table.php`
- `routes/api.php`
- `routes/web.php`

## Guardrails

- Do not assume Stripe is final just because the seed/current rows use `stripe`.
- Do not mark reservations paid unless payment state is verified or an explicit audited override policy has been approved and implemented.
- Do not add webhooks or provider SDKs without explicit approval.
- Keep reservation lifecycle and payment lifecycle explicit; avoid one field silently driving both.
- Verify callback authenticity and external-event idempotency before changing payment or reservation state.
- Preserve the payment-summary row lock as the serialization point for canonical success and adjustment totals.
- Do not describe a pending refund/void adjustment as provider-executed money movement.
- Do not extend a reservation hold when creating or retrying payment attempts.

## Known Gaps

- Patient refund requests and deduction/cancellation-fee policy remain undecided. Patient cancellation does not create or execute a refund; current pending requests are root-only with no automatic cut. User explicitly asked to retain this follow-up and continue general settings. [Decision log](../../deployment/refund-policy-follow-up-2026-10-16.md). No fee or automatic refund is authorized by that discussion.

- The local sandbox UI/API has deployed functional acceptance. Worker/scheduler execution and pending outbox delivery remain unverified. Real provider adapter/SDK, public callback transport and credential/rotation deployment remain unselected; sandbox success represents no real money movement.
- Refund/void adjustments are safely reserved requests; provider execution and resulting final adjustment/summary transitions remain later integration work.
- Rating submission and notification delivery remain later work; item 17 publishes intent only.
- Payment methods, receipts, disputes/chargebacks, settlement, and accounting/reconciliation operations are not implemented.

## Verification

```powershell
docker compose exec app php artisan test --filter=BookingPaymentRiskTest
docker compose exec app php artisan test --filter=PaymentLifecycleServiceTest
docker compose exec app php artisan test --filter=PaymentAdjustmentServiceTest
docker compose exec app php artisan test --filter=ReservationOverrideServiceTest
# MySQL only:
docker compose exec app php artisan test --filter=PaymentLifecycleMySqlConcurrencyTest
docker compose exec app php artisan test
docker compose exec app php artisan route:list --path=api --except-vendor
```

## Update After Changes

- This module for durable payment facts.
- `docs/TODO.md` only when a future roadmap item changes; Phase 1 payment/lifecycle items are closed evidence.
- A new ADR only if provider strategy or payment authority changes.
