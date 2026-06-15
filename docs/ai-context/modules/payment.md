## Verification Status

Last verified against code: 2026-06-15
Verification method:
- repo inspection
- route list
- tests
- database check where relevant

If this file conflicts with source code, source code wins.
Update this module after verification.


# Payment Context

Use this module for payment rows, providers, callbacks/webhooks, reservation payment state, refunds, or payment status transitions.

Do not load this module for normal role, admin shell, checkup CRUD, or booking UI work unless reservation/payment lifecycle is touched.

## Current State

- `Payment` rows are created when reservations are created.
- Current local reservation creation sets provider to `stripe`, currency to `IRR`, and status to `unpaid`.
- There is no dedicated payment controller, callback route, webhook handler, refund workflow, or deterministic provider contract yet.
- Admin reservation API includes payment details when loading reservations.
- Reservation status and payment status are separate concepts.
- `docs/TODO.md` still lists payment lifecycle/callback handling as unfinished.

## Open First

- `app/Models/Payment.php`
- `app/Models/Reservation.php`
- `app/Models/ReservationStatus.php`
- `app/Http/Controllers/Front/BookingController.php`
- `app/Http/Controllers/Api/BookingApiController.php`
- `app/Http/Controllers/Api/AdminReservationController.php`
- `database/migrations/2025_11_09_123759_create_payments_table.php`
- `database/migrations/2025_11_09_123756_create_reservations_table.php`
- `routes/api.php`
- `routes/web.php`

## Guardrails

- Do not assume Stripe is final just because the seed/current rows use `stripe`.
- Do not mark reservations paid without a deterministic payment transition rule.
- Do not add webhooks or provider SDKs without explicit approval.
- Keep reservation lifecycle and payment lifecycle explicit; avoid one field silently driving both.
- Prefer an idempotent callback design when payment callbacks are introduced.

## Known Gaps

- Payment statuses are raw strings.
- Provider references are available as `provider_ref`, but no callback flow fills them.
- No tests cover payment/reservation transition behavior yet.
- No failure, refund, timeout, or retry policy is documented.

## Verification

```bash
docker compose exec app php artisan test
docker compose exec app php artisan route:list --except-vendor
docker compose exec db mysql -ucheckupino -pcheckupino_pass checkupino -e "SELECT id, reservation_id, provider, provider_ref, amount, currency, status FROM payments ORDER BY id DESC LIMIT 10;"
```

## Update After Changes

- This module for durable payment facts.
- `docs/TODO.md` Phase 5 for lifecycle roadmap status.
- A new ADR only if provider strategy or payment authority changes.
