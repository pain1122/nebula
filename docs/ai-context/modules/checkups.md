## Verification Status

Last verified against code: 2026-07-10
Verification method:
- repo inspection
- route list
- tests
- scoped Pint

If this file conflicts with source code, source code wins.
Update this module after verification.

# Checkups And Services Context

Use this module for checkup categories, checkups, specialties, doctor service selection, and doctor/checkup eligibility.

Do not load this module for auth-only, payment-only, notification, or admin shell routing tasks unless checkup/service data is directly involved.

## Current State

- Blade admin CRUD exists for specialties, checkup categories, and checkups under `/admin/*`.
- API booking exposes checkup listing and doctors for a checkup.
- `/api/checkups` supports search/filter plus whitelisted sorting by title, price, category, and created date.
- `/api/checkups/{checkup}/doctors` resolves verified doctors through active `doctor_workplace_checkup` services and preserves search/filter/sort behavior.
- Service eligibility, price/duration overrides, and schedules are workplace-scoped; factories/seeders are rebuilt in Current Task item 7.
- Checkup pricing feeds the initial payment amount when a reservation is created.
- Checkups and checkup categories use soft archive; there is no application force-delete/purge route.
- Archiving a checkup preserves its reservations, payment summaries/attempts, notes, files, and workplace-service assignments.
- Category archive presents an explicit detach-or-reassign popup. Both choices keep every active/archived checkup record; category archive never cascades an archive/delete into children.
- `checkups.checkup_category_id` is nullable. Physical category deletion uses `SET NULL`; physical checkup deletion is restricted while reservation history exists.
- Archived checkups are excluded from active catalog/booking queries but remain resolvable through `Reservation::checkup()` for history.

## Open First

- `routes/admin.php`
- `routes/api.php`
- `app/Http/Controllers/Admin/SpecialtyController.php`
- `app/Http/Controllers/Admin/CheckupCategoryController.php`
- `app/Http/Controllers/Admin/CheckupController.php`
- `app/Http/Controllers/Doctor/ServicesController.php`
- `app/Http/Controllers/Api/BookingApiController.php`
- `app/Services/BookingService.php`
- `app/Support/QuerySorting.php`
- `app/Models/Specialty.php`
- `app/Models/CheckupCategory.php`
- `app/Models/Checkup.php`
- `app/Models/DoctorProfile.php`
- `app/Policies/CheckupPolicy.php`
- `app/Policies/CheckupCategoryPolicy.php`
- `tests/Feature/Admin/CatalogDestructiveDataSafetyTest.php`

Schema/data files:

- `database/migrations/2025_11_09_072222_create_specialties_table.php`
- `database/migrations/2025_11_09_105430_create_checkup_categories_table.php`
- `database/migrations/2025_11_09_105440_create_checkups_table.php`
- `database/migrations/2025_11_09_110000_create_doctor_workplace_services_and_windows.php`
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
- Keep doctor service eligibility aligned between admin, doctor service selection, web booking, and API booking.
- Never reintroduce a category/checkup cascade that can erase reservation or payment history.
- Category archive must detach children or reassign them to one locked, active replacement category; it must not archive/delete children.
- Catalog archive and its audit events must remain one fail-closed transaction with recent session password confirmation.
- Do not merge product admin CRUD with Velzon demo/toolbox cleanup.

## Verification

```bash
php artisan test --filter=ListingFilterSortTest
php artisan test --filter=BookingPaymentRiskTest
php artisan test --filter=CatalogDestructiveDataSafetyTest
php artisan route:list --path=api --except-vendor
```

Manual smoke path:

- Login as admin and visit `/admin/checkups`.
- Login as doctor and visit `/doctor/services`.
- Login as patient and visit `/book`.

## Update After Changes

- This module for durable checkup/service facts.
- `docs/TODO.md` Phase 3.75 if catalog archive/history safety changes.
- `docs/TODO.md` Phase 5 if eligibility enforcement changes.
