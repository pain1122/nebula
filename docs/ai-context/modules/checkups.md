## Verification Status

Last verified against code: 2026-06-15
Verification method:
- repo inspection
- route list
- tests
- database check where relevant

If this file conflicts with source code, source code wins.
Update this module after verification.

# Checkups And Services Context

Use this module for checkup categories, checkups, specialties, doctor service selection, and doctor/checkup eligibility.

Do not load this module for auth-only, payment-only, notification, or admin shell routing tasks unless checkup/service data is directly involved.

## Current State

- Blade admin CRUD exists for specialties, checkup categories, and checkups under `/admin/*`.
- API booking exposes checkup listing and doctors for a checkup.
- `checkup_doctor` pivot exists and local seeder attaches checkups to the demo doctor.
- Runtime doctor/checkup filtering still often uses specialty/category matching.
- Checkup pricing feeds the initial payment amount when a reservation is created.

## Open First

- `routes/admin.php`
- `routes/api.php`
- `app/Http/Controllers/Admin/SpecialtyController.php`
- `app/Http/Controllers/Admin/CheckupCategoryController.php`
- `app/Http/Controllers/Admin/CheckupController.php`
- `app/Http/Controllers/Doctor/ServicesController.php`
- `app/Http/Controllers/Api/BookingApiController.php`
- `app/Models/Specialty.php`
- `app/Models/CheckupCategory.php`
- `app/Models/Checkup.php`
- `app/Models/DoctorProfile.php`

Schema/data files:

- `database/migrations/2025_11_09_072222_create_specialties_table.php`
- `database/migrations/2025_11_09_105430_create_checkup_categories_table.php`
- `database/migrations/2025_11_09_105440_create_checkups_table.php`
- `database/migrations/2026_02_22_000000_create_checkup_doctor_table.php`
- `database/seeders/SpecialtySeeder.php`
- `database/seeders/CheckupCategorySeeder.php`
- `database/seeders/CheckupSeeder.php`
- `database/seeders/DoctorServicesSeeder.php`

Views:

- `resources/views/admin/specialties/*`
- `resources/views/admin/checkup_categories/*`
- `resources/views/admin/checkups/*`
- `resources/views/doctor/services/edit.blade.php`

## Guardrails

- Do not treat `specialty_id == checkup_category_id` as a durable business rule.
- Keep checkup price changes aware of payment amount creation.
- Keep doctor service eligibility aligned between admin, doctor, web booking, and API booking.
- Do not merge product admin CRUD with Velzon demo/toolbox cleanup.

## Verification

```bash
docker compose exec app php artisan test
docker compose exec app php artisan route:list --except-vendor
docker compose exec app php artisan migrate --seed --force
```

Manual smoke path:

- Login as admin and visit `/admin/checkups`.
- Login as doctor and visit `/doctor/services`.
- Login as patient and visit `/book`.

## Update After Changes

- This module for durable checkup/service facts.
- `docs/TODO.md` Phase 5 if eligibility enforcement changes.
