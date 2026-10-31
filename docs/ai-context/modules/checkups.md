## Verification Status

Latest scoped verification: 2026-10-15 - guarded checkup/category and specialty administration.
Historical foundation verification: 2026-08-16; the following broad-suite counts remain historical.
Verification method:
- repo inspection
- focused catalog authority/archive suite: 24 tests, 215 assertions
- complete SQLite suite: 304 tests, 1,796 assertions with three expected MySQL-only skips
- item-20 touched-file Pint, route contract, and `git diff --check`
- user-confirmed full disposable-MySQL Phase 1 suite: 307 tests, 1,816 assertions

If this file conflicts with source code, source code wins.
Update this module after verification.

# Checkups And Services Context

Use this module for checkup categories, checkups, specialties, doctor service selection, and doctor/checkup eligibility.

Do not load this module for auth-only, payment-only, notification, or admin shell routing tasks unless checkup/service data is directly involved.

## Current State

- October15 latest: both approved remaining catalog slices are deployed/accepted on healthy43f3a3e5/54 assets, retained catalog-controls-accepted-2026-10-15 with0748 read-only rollback. Checkup/category guarded create/edit/soft archive and specialty lists/details/hierarchy/reference-safe controls share fresh revision/locked active authority/current resource policies/reason/confirmation/recent password/atomic audit; category moves preserve active/archived history and critical risk. Isolated53/644/Pint, full frontend63/591/all quality/final focused108/unchanged ratchets/readiness14,11 retained groups161 requests and23 native ENFA groups275 requests/four desktop-390px mirrors/16 viewport captures pass. Catalog/doctor-reference/original-protected hashes and twelve services/idle worker/jobs0 remain; no live business save/schema/dependency/env/scanner operation. [Acceptance and rollback](../../deployment/admin-catalog-controls-2026-10-15.md). Next schedule administration, then payments/general settings/real dashboard. Positive live saves/download-audit and fresh scanner/current engine proof stay open; user-owned profile rehearsal remains deferred.

- Blade admin CRUD exists for specialties, checkup categories, and checkups under `/admin/*`.
- API booking exposes checkup listing and doctors for a checkup.
- `/api/checkups` supports search/filter plus whitelisted sorting by title, price, category, and created date.
- `/api/checkups/{checkup}/doctors` resolves verified doctors through active `doctor_workplace_checkup` services and preserves search/filter/sort behavior.
- Service eligibility and base price/currency overrides are workplace-scoped. Exact materialized doctor-declared visit slots are service-specific and can resolve a rule/day or individual-slot price above that fallback.
- Checkup pricing feeds the initial payment amount when a reservation is created.
- Blade checkup create/update explicitly require price, uppercase three-letter currency, default duration from 5-720 minutes, and a reason. Both paths use `CheckupPolicy`, recent password confirmation, transactions, and fail-closed allowlisted audit; audit failure rolls back the catalog mutation.
- Checkups and checkup categories use soft archive; there is no application force-delete/purge route.
- Archiving a checkup preserves its reservations, payment summaries/attempts, notes, files, and workplace-service assignments.
- Category archive presents an explicit detach-or-reassign popup. Both choices keep every active/archived checkup record; category archive never cascades an archive/delete into children.
- `checkups.checkup_category_id` is nullable. Physical category deletion uses `SET NULL`; physical checkup deletion is restricted while reservation history exists.
- Archived checkups are excluded from active catalog/booking queries but remain resolvable through `Reservation::checkup()` for history.

## Open First

- `app/Services/CatalogAdministration.php`
- `app/Http/Controllers/Api/Admin/CatalogMutationController.php`
- `tests/Feature/Api/AdminCatalogMutationTest.php`
- `scripts/media/verify-admin-catalog-mutations.ps1`

- `app/Http/Controllers/Api/Admin/CatalogReadController.php`
- `tests/Feature/Api/AdminCatalogReadContractTest.php`
- `scripts/media/verify-admin-catalog-read.ps1`
- `scripts/media/verify-admin-catalog-read-runtime.mjs`

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
- `tests/Feature/Admin/CatalogAuthorityTest.php`
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

```powershell
docker compose exec app php artisan test --filter=ListingFilterSortTest
docker compose exec app php artisan test --filter=BookingPaymentRiskTest
docker compose exec app php artisan test --filter=CatalogDestructiveDataSafetyTest
docker compose exec app php artisan test --filter=CatalogAuthorityTest
docker compose exec app php artisan route:list --path=api --except-vendor
```

Manual smoke path:

- Login as admin and visit `/admin/checkups`.
- Login as doctor and visit `/doctor/services`.
- Login as patient and visit `/book`.

## Update After Changes

- This module for durable checkup/service facts.
- `docs/TODO.md` only when a future roadmap item changes; completed Phase 1 catalog evidence stays closed.
