## Verification Status

Last verified against code: 2026-07-10
Verification method:
- repo inspection
- route list
- tests
- scoped Pint

If this file conflicts with source code, source code wins.
Update this module after verification.

# Booking And Reservation Context

Use this module for public booking pages, API reservations, scheduling, doctor availability, reservation ownership, cancellation, completion, or slot validity.

Do not load this module for role taxonomy, admin shell routing, payment-only lifecycle, or notifications unless booking behavior is directly involved.

## Current State

- Web booking routes live under `/book*` and `/my/reservations`.
- API booking routes include `/api/checkups`, `/api/checkups/{checkup}/doctors`, `/api/doctors/{doctor}/availability`, `/api/reservations`, and `/api/my/reservations`.
- Reservation creation is centralized in `App\Services\BookingService` and is called by both web and API booking controllers.
- Conflict checks use `App\Services\SchedulingService`.
- Runtime service eligibility uses `doctor_workplace_checkup`; it is scoped to one doctor/hospital workplace, not specialty/category matching.
- `BookingService` re-fetches and locks an active checkup before creation, then enforces verified doctor, checkup/doctor pivot membership, future slot, generated-slot match, and conflict recheck inside the booking transaction. A stale archived checkup model cannot create a reservation.
- Booking creates a one-hour `pending` hold and one `unpaid` reservation payment summary together. Multiple later provider attempts belong to that summary.
- Canonical reservation states are `pending`, `confirmed`, `completed`, `cancelled`, and `expired`.
- Availability uses normalized `doctor_working_windows`. Confirmed reservations and unexpired pending holds block conflicts; stale pending/cancelled/completed/expired rows do not.
- Reservations snapshot hospital, doctor, service/category, price/currency, duration, and timezone and reserve append-only schedule-change history.
- Reservation status is cast to `App\Models\ReservationStatus`.
- Booking, admin reservation, doctor reservation, checkup, doctor, user, questionnaire, and rating-option list endpoints touched in this slice use whitelisted `sort_by`/`sort_dir` handling through `App\Support\QuerySorting`.
- Reservation rating pros/cons are admin-managed DB records exposed through active client reads; the actual post-completion rating submission flow is not implemented yet.

## Open First

- `routes/web.php`
- `routes/api.php`
- `app/Http/Controllers/Front/BookingController.php`
- `app/Http/Controllers/Api/BookingApiController.php`
- `app/Http/Controllers/Api/AdminReservationController.php`
- `app/Services/BookingService.php`
- `app/Services/SchedulingService.php`
- `app/Support/QuerySorting.php`
- `app/Models/Reservation.php`
- `app/Models/ReservationStatus.php`
- `app/Models/DoctorProfile.php`
- `app/Models/Checkup.php`
- `app/Policies/ReservationPolicy.php`

Schema/data files:

- `database/migrations/2025_11_09_123756_create_reservations_table.php`
- `database/migrations/2025_11_09_123757_create_reservation_notes_table.php`
- `database/migrations/2025_11_09_123758_create_reservation_files_table.php`
- `database/migrations/2025_11_09_110000_create_doctor_workplace_services_and_windows.php`
- `database/seeders/DoctorServicesSeeder.php`

Views:

- `resources/views/front/booking/choose-checkup.blade.php`
- `resources/views/front/booking/choose-doctor.blade.php`
- `resources/views/front/booking/pick-time.blade.php`
- `resources/views/front/booking/my.blade.php`

## Guardrails

- Do not duplicate booking rules between web and API. Move shared rules into a service when changing behavior.
- Do not bypass `BookingService` for reservation/payment creation.
- Keep the active-checkup row lock before reservation/payment creation so archive and booking cannot race.
- Do not treat specialty/category matching as a booking eligibility rule; use the workplace-service pivot.
- Do not change payment lifecycle from booking code unless the payment task is in scope.
- Do not compare enum-cast reservation statuses as raw strings without checking casts.
- Current validation accepts a requested duration only when that exact duration produces a generated availability slot. A stricter allowed-duration product policy is still a TODO.

## Verification

```bash
php artisan test --filter=BookingPaymentRiskTest
php artisan test --filter=ListingFilterSortTest
vendor\bin\pint --test app/Services/BookingService.php app/Http/Controllers/Api/BookingApiController.php app/Http/Controllers/Front/BookingController.php app/Http/Controllers/Api/AdminReservationController.php
php artisan test
php artisan route:list --path=api --except-vendor
```

Manual smoke path:

- Login as `patient@checkupino.test`.
- Visit `/book`.
- Pick a checkup, doctor, and time.
- Confirm `/my/reservations` shows the created reservation.

## Update After Changes

- This module for durable booking facts.
- `docs/TODO.md` Phase 5 for roadmap status.
- `docs/architecture/boundaries.md` if shared domain-service boundaries change.
