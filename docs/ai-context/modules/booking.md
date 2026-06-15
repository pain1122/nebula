## Verification Status

Last verified against code: 2026-06-15
Verification method:
- repo inspection
- route list
- tests
- database check where relevant

If this file conflicts with source code, source code wins.
Update this module after verification.

# Booking And Reservation Context

Use this module for public booking pages, API reservations, scheduling, doctor availability, reservation ownership, cancellation, completion, or slot validity.

Do not load this module for role taxonomy, admin shell routing, payment-only lifecycle, or notifications unless booking behavior is directly involved.

## Current State

- Web booking routes live under `/book*` and `/my/reservations`.
- API booking routes include `/api/checkups`, `/api/checkups/{checkup}/doctors`, `/api/doctors/{doctor}/availability`, `/api/reservations`, and `/api/my/reservations`.
- Reservation creation exists in both web and API controllers.
- Conflict checks use `App\Services\SchedulingService`.
- Runtime doctor/checkup eligibility still uses `doctor_profiles.specialty_id == checkups.checkup_category_id`.
- `checkup_doctor` exists and is seeded for local data, but runtime booking still needs consistent enforcement through that pivot.
- Slot conflict is checked, but reservation creation still needs proof that the requested slot came from generated availability.
- Reservation status is cast to `App\Models\ReservationStatus`.

## Open First

- `routes/web.php`
- `routes/api.php`
- `app/Http/Controllers/Front/BookingController.php`
- `app/Http/Controllers/Api/BookingApiController.php`
- `app/Http/Controllers/Api/AdminReservationController.php`
- `app/Services/SchedulingService.php`
- `app/Models/Reservation.php`
- `app/Models/ReservationStatus.php`
- `app/Models/DoctorProfile.php`
- `app/Models/Checkup.php`
- `app/Policies/ReservationPolicy.php`

Schema/data files:

- `database/migrations/2025_11_09_123756_create_reservations_table.php`
- `database/migrations/2025_11_09_123757_create_reservation_notes_table.php`
- `database/migrations/2025_11_09_123758_create_reservation_files_table.php`
- `database/migrations/2026_02_22_000000_create_checkup_doctor_table.php`
- `database/seeders/DoctorServicesSeeder.php`

Views:

- `resources/views/front/booking/choose-checkup.blade.php`
- `resources/views/front/booking/choose-doctor.blade.php`
- `resources/views/front/booking/pick-time.blade.php`
- `resources/views/front/booking/my.blade.php`

## Guardrails

- Do not duplicate booking rules between web and API. Move shared rules into a service when changing behavior.
- Do not treat specialty/category matching as the final eligibility model; the pivot is the planned source.
- Do not change payment lifecycle from booking code unless the payment task is in scope.
- Do not compare enum-cast reservation statuses as raw strings without checking casts.

## Verification

```bash
docker compose exec app php artisan test
docker compose exec app php artisan route:list --except-vendor
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
