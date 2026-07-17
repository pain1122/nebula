## Verification Status

Last verified against code: 2026-07-10
Verification method:
- repo inspection
- route list
- tests
- scoped Pint

If this file conflicts with source code, source code wins.
Update this module after verification.


# Payment Context

Use this module for payment rows, providers, callbacks/webhooks, reservation payment state, refunds, or payment status transitions.

Do not load this module for normal role, admin shell, checkup CRUD, or booking UI work unless reservation/payment lifecycle is touched.

## Current State

- The compatibility `Payment` model maps to `reservation_payment_summaries`; booking creates exactly one unpaid summary without assuming a provider.
- `payment_attempts` supports repeated provider attempts with provider-scoped idempotency/reference uniqueness. Provider events and adjustments have separate retained tables.
- There is no dedicated payment controller, callback route, webhook handler, refund workflow, or deterministic provider contract yet.
- Admin reservation API includes payment details when loading reservations.
- Reservation status and payment status are separate concepts.
- Admin reservation status updates cannot mark a reservation `paid` unless the related payment row is already `paid`.
- Admin and doctor completion paths block `done` before verified payment; they also block completion before the appointment time.
- `docs/TODO.md` still lists payment lifecycle/callback handling as unfinished.

## Open First

- `app/Models/Payment.php`
- `app/Models/Reservation.php`
- `app/Models/ReservationStatus.php`
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
- Prefer an idempotent callback design when payment callbacks are introduced.

## Known Gaps

- Payment statuses are raw strings.
- Provider references are available as `provider_ref`, but no callback flow fills them.
- `BookingPaymentRiskTest` covers the current guard that blocks unpaid reservations from being marked `paid`.
- No failure, refund, timeout, or retry policy is documented.
- No provider callback, admin override, refund, or retry flow is implemented yet.

## Verification

```bash
php artisan test --filter=BookingPaymentRiskTest
php artisan test
php artisan route:list --path=api --except-vendor
```

## Update After Changes

- This module for durable payment facts.
- `docs/TODO.md` Phase 5 for lifecycle roadmap status.
- A new ADR only if provider strategy or payment authority changes.
