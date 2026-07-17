## Verification Status

Last verified against code: 2026-07-10
Verification method:
- repo inspection
- route list
- tests
- scoped Pint

If this file conflicts with source code, source code wins.
Update this module after verification.


# Doctor Reports Context

Use this module for doctor profile workflows, doctor reservation views, reservation notes/files, medical reporting, and doctor-facing completion flows.

Do not load this module for auth-only role taxonomy, payment-only lifecycle, or checkup CRUD unless doctor-facing report/reservation behavior is directly involved.

## Current State

- Doctor Blade panel exists under `/doctor/*`.
- Doctor API routes exist under `/api/doctor/*`.
- Doctor profile includes specialty, fee, bio, experience, availability, and verification state.
- Doctor can list/show own reservations through API.
- Doctor can mark a reservation as done through API only after the appointment time and only after the related payment is verified as `paid`.
- `reservation_notes` and `reservation_files` tables/models exist, but full route/controller workflows are still listed as unfinished.
- No dedicated medical report domain model/controller is present yet.
- Reservation rating pros/cons options exist as admin-managed DB records, but client rating submission and follow-up messaging after `done` are not implemented yet.

## Open First

- `routes/doctor.php`
- `routes/api.php`
- `app/Http/Controllers/Doctor/DashboardController.php`
- `app/Http/Controllers/Doctor/ProfileController.php`
- `app/Http/Controllers/Doctor/ServicesController.php`
- `app/Http/Controllers/Api/DoctorProfileController.php`
- `app/Http/Controllers/Api/BookingApiController.php`
- `app/Http/Controllers/Api/Admin/ReservationRatingOptionController.php`
- `app/Http/Controllers/Api/ReservationRatingOptionController.php`
- `app/Models/DoctorProfile.php`
- `app/Models/Reservation.php`
- `app/Models/ReservationRatingOption.php`
- `app/Models/ReservationNote.php`
- `app/Models/ReservationFile.php`
- `app/Policies/ReservationPolicy.php`

Schema files:

- `database/migrations/2025_11_09_072921_create_doctor_profiles_table.php`
- `database/migrations/2025_11_09_123757_create_reservation_notes_table.php`
- `database/migrations/2025_11_09_123758_create_reservation_files_table.php`

Views:

- `resources/views/doctor/dashboard.blade.php`
- `resources/views/doctor/profile/edit.blade.php`
- `resources/views/doctor/services/edit.blade.php`

## Guardrails

- Do not invent a medical report schema without explicit approval.
- Keep doctor reservation authorization scoped to the authenticated doctor's profile.
- Keep admin override behavior separate from doctor ownership behavior.
- Avoid changing booking/payment status behavior from report work unless explicitly in scope.
- Uploaded files need storage/security review before adding workflows.
- Do not treat rating pros/cons as hardcoded UI labels; use `reservation_rating_options`.

## Verification

```bash
php artisan test --filter=BookingPaymentRiskTest
php artisan test --filter=ReservationRatingOptionTest
php artisan test
php artisan route:list --path=api --except-vendor
```

Manual smoke path:

- Login as `doctor@checkupino.test`.
- Visit `/doctor`.
- Visit `/doctor/profile/edit`.
- Visit `/doctor/services`.

## Update After Changes

- This module for durable doctor/report facts.
- `docs/TODO.md` Phase 6 for notes/files/reporting roadmap status.
