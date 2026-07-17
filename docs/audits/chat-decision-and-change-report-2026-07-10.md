# Chat Decision And Change Report - 2026-07-10

## Purpose

Document the decisions and implementation changes made during the July 2026 risk-closure chat that started from the repository technical audit findings and moved into Phase 3.75 backend/domain hardening.

## Source Context

- Audit reviewed: `docs/audits/repository-technical-audit-2026-07-08.md`.
- Roadmap updated: `docs/TODO.md`.
- Active task updated: `CURRENT_TASK.md`.
- Active sprint updated: `CURRENT_SPRINT.md`.
- Durable handoff log updated: `docs/ai-context/TASK_LOG.md`.

## Decisions

1. Confirmed audit risks are immediate Phase 3.75 blockers.
   They should not be delayed into later phases just because some UI work would happen in Phase 4.

2. Phase 4 UI cannot expose real workflows whose backend/domain blockers are still open.
   Prototype UI is allowed only when it does not imply the backend behavior is complete.

3. Tenancy is required.
   The product needs a main platform plus hospital/clinic tenant variant websites. Tenants need backend-resolved identity, doctor/client assignment, subscription entitlements, feature gates, content syndication, and central monitoring/admin controls.

4. Tenant feature access must be enforced in the backend.
   Hiding a feature in the frontend is not enough. Tenant subscriptions must control API access too.

5. The first Phase 3.75 implementation slice is booking/payment correctness.
   This was chosen because invalid booking and false payment/status state would become high-impact once client/admin UI is built on top of it.

6. Doctor/checkup booking eligibility uses the `checkup_doctor` pivot.
   `doctor_profiles.specialty_id == checkups.checkup_category_id` is not a valid booking authority rule.

7. Booking rules must be centralized.
   API and Blade booking should not duplicate eligibility, slot, conflict, reservation, or payment creation logic.

8. Listing filters can support sorting, but sorting must be whitelisted.
   User-controlled values must not be passed directly into SQL column names.

9. Rating pros/cons are admin-managed database records.
   They should not be hardcoded in the frontend. Admins decide the available pro/con options.

10. `done` should be a real completion workflow.
    Completion should be an admin/doctor confirmation and should later trigger client follow-up/rating messaging. The first backend guard is now payment/time validation; the explicit follow-up flow remains future work.

11. A reservation cannot be marked `paid` unless payment state is verified.
    The current implemented rule requires the related `payments.status` to be `paid` before reservation status can become `paid`.

12. Phase 3.75 booking/payment is partially closed, not fully complete.
    Provider callbacks, audited override policy, explicit completion endpoint/rating request flow, reservation status audit/step-up, and a stricter duration policy remain open.

## Roadmap And Task Changes

- Added `Phase 3.75 - Confirmed Risk Closure Before Product UI` to `docs/TODO.md`.
- Moved confirmed risk-map items into Phase 3.75 as immediate pre-Phase-4 blockers.
- Added tenant/subscription/hospital variant platform requirements to the roadmap.
- Removed the disliked broad boundary clarification and replaced it with concrete blocker ownership.
- Updated `CURRENT_TASK.md` to make Phase 3.75 the active task.
- Updated `CURRENT_SPRINT.md` to make booking/payment correctness the first executable slice.
- Updated `docs/ai-context/TASK_LOG.md` with the July 10 implementation and verification facts.

## Tests Added

- `tests/Feature/Api/BookingPaymentRiskTest.php`
  - Proves booking rejects doctors not assigned through `checkup_doctor`.
  - Proves booking rejects non-generated and past slots.
  - Proves admin cannot mark an unpaid reservation as `paid`.

- `tests/Feature/Api/ListingFilterSortTest.php`
  - Proves checkup doctor listing filters/sorts attached verified doctors.
  - Proves admin reservations can filter/search/sort by related fields.

- `tests/Feature/Api/ReservationRatingOptionTest.php`
  - Proves admins can create/update/delete rating pro/con options.
  - Proves clients only receive active rating options.

## Backend Changes

### Booking And Reservation

- Added `app/Services/BookingService.php`.
- API booking now calls `BookingService`.
- Blade booking now calls `BookingService`.
- `BookingService` enforces:
  - doctor exists and is verified
  - doctor is attached to the checkup through `checkup_doctor`
  - requested slot is in the future
  - requested slot exactly matches generated doctor availability for the requested duration
  - conflict check happens inside a locked booking transaction
  - reservation is created as `pending`
  - payment is created as `unpaid`, `IRR`, provider `stripe`

### Payment And Status

- Admin reservation status update now blocks `paid` unless related payment status is `paid`.
- Admin `done` transition now blocks before verified payment and appointment time.
- Doctor completion now also blocks before verified payment and appointment time.

### Listing, Filtering, And Sorting

- Added `app/Support/QuerySorting.php`.
- Touched list endpoints now use whitelisted `sort_by` and `sort_dir`.
- Added/expanded search/filter/sort behavior on booking/admin/questionnaire list endpoints.
- Checkup doctor listing now uses `checkup_doctor` and returns only verified attached doctors.

### Rating Options

- Added `app/Models/ReservationRatingOption.php`.
- Added migration `database/migrations/2026_07_10_000000_create_reservation_rating_options_table.php`.
- Added public active-option controller:
  - `app/Http/Controllers/Api/ReservationRatingOptionController.php`
- Added admin CRUD controller:
  - `app/Http/Controllers/Api/Admin/ReservationRatingOptionController.php`
- Added API routes for public and admin rating options.

## Documentation Changes

- `docs/TODO.md`
  - Phase 3.75 blocker list.
  - Tenant/subscription/hospital variant platform requirements.
  - Partial status notes for booking/payment fixes.

- `CURRENT_TASK.md`
  - Phase 3.75 active task.
  - First booking/payment fix marked implemented and verified.

- `CURRENT_SPRINT.md`
  - First slice checklist marked complete.
  - Verification commands recorded.

- `docs/ai-context/TASK_LOG.md`
  - July 10 durable handoff notes.

- `docs/ai-context/modules/booking.md`
  - Updated for `BookingService`, pivot eligibility, generated-slot enforcement, and list sorting.

- `docs/ai-context/modules/payment.md`
  - Updated for verified-payment status guards and remaining provider gaps.

- `docs/ai-context/modules/checkups.md`
  - Updated for pivot-based doctor listing and checkup listing sort/filter support.

- `docs/ai-context/modules/doctor-reports.md`
  - Updated for paid/time-gated doctor completion and rating-option facts.

## Verification Run

Passing checks recorded during the chat:

```bash
php artisan route:list --path=api --except-vendor
php artisan test --filter=ListingFilterSortTest
php artisan test --filter=ReservationRatingOptionTest
php artisan test --filter=AdminQuestionnaireSoftDeleteTest
php artisan test --filter=BookingPaymentRiskTest
vendor\bin\pint --test app/Services/BookingService.php app/Http/Controllers/Api/BookingApiController.php app/Http/Controllers/Front/BookingController.php app/Http/Controllers/Api/AdminReservationController.php
php artisan test
```

Full backend result:

- 49 tests passed.
- 163 assertions passed.

Notes:

- A grouped Pint run on questionnaire controller files timed out once.
- Single-file Pint checks passed for two questionnaire files.
- `Admin/QuestionnaireController.php` syntax and affected tests passed, but that one Pint check timed out during the chat.

## Remaining Work

1. Booking/payment lifecycle:
   - decide and enforce stricter allowed-duration policy
   - implement real provider callback/webhook flow
   - define audited admin override policy, if one is allowed
   - add explicit admin completion endpoint and client rating request workflow
   - add audit/step-up around reservation status mutations

2. Catalog destructive-data safety:
   - prevent checkup/category deletes from erasing reservation/payment history
   - decide archive/soft-delete policy
   - add audit and step-up

3. Privileged mutation expansion:
   - reservation status
   - doctor verification
   - questionnaire mutations
   - catalog updates/pricing/deletes
   - future bulk actions

4. Admin authority:
   - decide whether normal admins can manage other admins
   - enforce and test the rule

5. Medical files/reports:
   - private storage
   - authorized download routes
   - MIME/type/size validation
   - audit events

6. Tenant foundation:
   - tenant/site/domain model
   - tenant membership rules
   - subscription entitlements
   - feature gates
   - content syndication
   - central monitoring

7. Frontend health:
   - fix TypeScript failure around missing `ForgetPassword.tsx` reducer
   - add frontend build/type gates

## Current Safe Interpretation

The first booking/payment correctness slice is implemented and verified. It is safe to build UI on top of the specific fixed behaviors listed above, but not safe to claim the full reservation/payment lifecycle is complete until callbacks, override policy, completion/rating flow, and audit/step-up coverage are implemented.

## Post-Report Workflow Update

Later on 2026-07-10, Phase 3.75 catalog destructive-data safety was implemented and verified. Checkups/categories now soft-archive; category archive explicitly detaches or reassigns child checkups; no child checkup, reservation, payment, note, file, or doctor assignment is deleted. Database history guards, policy authorization, recent session password confirmation, fail-closed batched audit events, and concurrency locks were added. The full backend suite then passed with 67 tests and 320 assertions, and the four catalog migrations passed apply/rollback/re-apply checks on disposable SQLite and MySQL databases. The catalog item under "Remaining Work" above should therefore be read as the pre-implementation state captured by the original report.
