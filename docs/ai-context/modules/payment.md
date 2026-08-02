## Verification Status

Last verified against code: 2026-08-03
Verification method:
- repo inspection
- SQLite full backend suite: 186 tests, 950 assertions, with one expected MySQL-only skip
- disposable-MySQL full suite: 187 tests, 961 assertions, including a deterministic two-process row-lock regression
- marketplace/tenant migration lifecycle and MySQL schema/isolation inspection
- focused payment lifecycle, adjustment, override, hold-expiration, failure, and touched-file Pint checks

If this file conflicts with source code, source code wins.
Update this module after verification.


# Payment Context

Use this module for payment rows, providers, callbacks/webhooks, reservation payment state, refunds, or payment status transitions.

Do not load this module for normal role, admin shell, checkup CRUD, or booking UI work unless reservation/payment lifecycle is touched.

## Current State

- The compatibility `Payment` model maps to `reservation_payment_summaries`; booking creates exactly one unpaid summary without assuming a provider.
- `payment_attempts` supports repeated provider attempts with provider-scoped idempotency/reference uniqueness. Provider events and adjustments have separate retained tables.
- `PaymentSummaryStatus`, `PaymentAttemptStatus`, `PaymentAdjustmentType`, and `PaymentAdjustmentStatus` provide enum-safe persistence boundaries.
- `PaymentLifecycleService` owns idempotent attempt creation, signature-first provider callback processing, external-event deduplication, locked canonical-success selection, late/competing-success reconciliation, and reservation confirmation.
- A newly created attempt writes `payment.attempt.requested` in the same transaction; an idempotent retry returns the existing attempt without publishing another logical event. Focused and full SQLite/MySQL regressions pass.
- `PaymentGateway` is provider-neutral. No provider SDK, credential, or public HTTP callback adapter has been selected.
- `PaymentAdjustmentService` allows a stepped-up root admin to reserve a server-owned refund/void amount with a reason and fail-closed audit. A pending adjustment is a request boundary, not proof that a provider executed it.
- `ReservationOverrideService` owns explicit root-admin reservation overrides under policy, recent-password, reason, payment checks, row locks, and transactional audit.
- `ReservationHoldService` and the every-minute `ExpireOverdueReservationHolds` job expire overdue reservations and open attempts idempotently; attempt retries never extend the reservation hold.
- The MySQL-only concurrency regression holds a payment-summary row in one process, starts a competing successful callback in another, verifies lock waiting, and proves one canonical success plus one reconciliation.
- Admin reservation API includes payment details when loading reservations.
- Reservation status and payment status are separate concepts.
- Admin/doctor completion still requires verified payment and appointment time; the complete product-facing completion/rating workflow remains Phase 1E item 17.

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

- There is no selected provider adapter/SDK, public HTTP callback route, credential/rotation deployment, or provider checkout UI.
- Refund/void adjustments are safely reserved requests; provider execution and resulting final adjustment/summary transitions remain later integration work.
- Appointment completion and rating-request triggers remain Phase 1E item 17.
- Payment methods, receipts, disputes/chargebacks, settlement, and accounting/reconciliation operations are not implemented.

## Verification

```bash
php artisan test --filter=BookingPaymentRiskTest
php artisan test --filter=PaymentLifecycleServiceTest
php artisan test --filter=PaymentAdjustmentServiceTest
php artisan test --filter=ReservationOverrideServiceTest
# MySQL only:
php artisan test --filter=PaymentLifecycleMySqlConcurrencyTest
php artisan test
php artisan route:list --path=api --except-vendor
```

## Update After Changes

- This module for durable payment facts.
- `docs/TODO.md` Phase 1 items 15 and 17 plus Phase 3 for lifecycle roadmap status.
- A new ADR only if provider strategy or payment authority changes.
