# Foundation Migration Replacement Map

Snapshot date: 2026-07-12

Status: Current Task item 5 planning artifact. No migration or runtime file has been changed by this map.

Inputs:

- `docs/architecture/foundation-current-data-contract-inventory.md`
- `docs/architecture/foundation-target-domain-and-ownership-contract.md`
- `docs/architecture/foundation-shared-primitives-contract.md`

## Scope Boundary

- Rebuild the complete main marketplace schema from the empty/disposable database baseline.
- Preserve the minimal tenant foundation: separate migration path, installation/schema version, single-hospital profile/settings, local authority bootstrap, entitlement state, audit, and outbox.
- Do not build complete tenant doctor/patient/booking/payment/questionnaire/medical workflows in this task.
- Do not add tenant UI, cross-site synchronization, tenant monitoring dashboards, optional SSO, or fleet migration/backup operations in this task.
- Existing marketplace hospital selection is immediately available to doctors; only missing-hospital listing requests require marketplace admin review.
- Marketplace schedules for one doctor may differ by workplace, but overlapping active working windows are rejected.

## Migration Paths

### Marketplace

Keep the default Laravel migration path:

`database/migrations/`

It remains the schema used by ordinary `php artisan migrate`, the marketplace application, and the existing `RefreshDatabase` test suite.

### Minimal tenant foundation

Use an explicit isolated path:

`database/migrations/tenant/`

Tenant migration commands/tests must pass the path explicitly or use a dedicated command. Default marketplace migration/test commands must not load tenant migrations.

## Target Marketplace Migration Groups

The exact timestamps are implementation details; the following stable group order controls dependencies.

| Group | Proposed migration responsibility | Target tables |
| --- | --- | --- |
| M00 | Marketplace users and auth infrastructure | `users`, `password_reset_tokens`, `sessions`, `personal_access_tokens` |
| M01 | Framework operations | `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs` |
| M02 | Spatie authorization | `permissions`, `roles`, `model_has_permissions`, `model_has_roles`, `role_has_permissions` |
| M10 | Marketplace hospital directory | `marketplace_hospitals`, `hospital_listing_requests` |
| M20 | Specialty, doctor, workplace, and service eligibility | `specialties`, `doctor_profiles`, `doctor_specialty`, `doctor_workplaces`, `doctor_workplace_checkup`, `doctor_working_windows` |
| M30 | Checkup catalog | `checkup_categories`, `checkups` |
| M40 | Reservation lifecycle | `reservations`, `reservation_schedule_changes`, `reservation_rating_options` |
| M50 | Payment lifecycle | `reservation_payment_summaries`, `payment_attempts`, `payment_provider_events`, `payment_adjustments` |
| M60 | Questionnaire and lead capture | `questionnaires`, `questionnaire_questions`, `questionnaire_choices`, `questionnaire_recommendations`, `questionnaire_submissions`, `leads` |
| M70 | Medical/profile records | `user_profiles`, `reservation_notes`, `reservation_files` |
| M80 | Audit, settings, features, and outbox | `audit_events`, `setting_definitions`, `setting_values`, `features`, `outbox_events` |
| M90 | Minimal tenant registry/monitoring contract | `tenant_instances`, `tenant_feature_overrides`, `tenant_health_snapshots` |

Ordering note: M20 doctor workplace services reference M30 checkups. During implementation either create M30 before the workplace service pivot or split M20 into doctor/workplace base before M30 and workplace-service/schedule after M30. The replacement must not create a forward FK dependency.

Recommended resolved order:

1. M00 identity/auth
2. M01 operations
3. M02 authorization
4. M10 hospital directory
5. M20a specialties/doctors/workplaces
6. M30 catalog
7. M20b doctor skills/workplace services/windows
8. M40 reservations
9. M50 payments
10. M60 questionnaires/leads
11. M70 medical/profile
12. M80 platform primitives
13. M90 minimal tenant registry/monitoring

## Target Minimal Tenant Migration Groups

| Group | Responsibility | Target tables |
| --- | --- | --- |
| T00 | Tenant installation and hospital identity | `tenant_installation`, `hospital_profile` |
| T01 | Local auth and sessions | `users`, `password_reset_tokens`, `sessions`, `personal_access_tokens` |
| T02 | Local Spatie authorization | `permissions`, `roles`, `model_has_permissions`, `model_has_roles`, `role_has_permissions` |
| T03 | Local framework operations | `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs` |
| T04 | Local settings and entitlement cache | `setting_definitions`, `setting_values`, `feature_entitlements` |
| T05 | Local audit and outbox | `audit_events`, `outbox_events` |

Tenant foundation constraints:

- `hospital_profile` is a singleton by application/constraint convention and contains no marketplace hospital foreign key.
- Tenant `users` are local identities; no marketplace user ID is required.
- Local roles seed only what the tenant bootstrap needs; marketplace `root-admin`/admin authority is not copied implicitly.
- `feature_entitlements` stores the locally enforceable signed/versioned entitlement snapshot, not marketplace operational data.
- No marketplace directory, doctor workplace, reservation, payment, questionnaire, lead, or medical tables enter the minimal tenant path yet.

## Existing Migration-to-Target Map

Every existing migration is accounted for below.

| Existing migration | Existing effect | Replacement target | Action |
| --- | --- | --- | --- |
| `0001_01_01_000000_create_users_table.php` | Creates users, reset tokens, sessions | M00 and tenant T01 | Recreate separately. Add public ID/account state metadata; preserve auth columns; tenant users remain local. Correct rollback order so sessions/reset tokens drop before users. |
| `0001_01_01_000001_create_cache_table.php` | Cache/cache locks | M01 and T03 | Recreate as framework infrastructure in both paths. |
| `0001_01_01_000002_create_jobs_table.php` | Jobs/batches/failed jobs | M01 and T03 | Recreate in both paths; later logging/retention rules apply to failed payloads. |
| `2025_11_09_061807_create_permission_tables.php` | Spatie roles/permissions | M02 and T02 | Recreate from current package-compatible schema. Teams remain disabled because marketplace hospital workplaces and tenants are not authorization teams. |
| `2025_11_09_072222_create_specialties_table.php` | Specialty tree; broken `down()` | M20a | Recreate with correct drop behavior. Keep unique slug; decide whether name is globally unique or only slug before code implementation. Derive/validate hierarchy depth rather than trusting arbitrary `level`. |
| `2025_11_09_072921_create_doctor_profiles_table.php` | Doctor profile, single specialty, availability JSON | M20a/M20b | Recreate with public ID and unique `user_id`; move multi-skill relation to `doctor_specialty`; move queryable schedules out of JSON into `doctor_working_windows`. No destructive user cascade. |
| `2025_11_09_105430_create_checkup_categories_table.php` | Checkup category | M30 | Recreate with public ID, unique slug, archive fields/soft deletes. |
| `2025_11_09_105440_create_checkups_table.php` | Checkup with category and price | M30 | Recreate with nullable category/SET NULL, soft delete, public ID, default duration, minor-unit price, currency, active/archive state. |
| `2025_11_09_123756_create_reservations_table.php` | Patient/doctor/checkup/time/status | M40 | Replace with marketplace reservation referencing patient, doctor workplace, checkup, one-hour `hold_expires_at`, timezone/duration, explicit status, and immutable hospital/doctor/service/category/price/currency snapshots. Use retention-safe restrictions, not user/doctor cascades. |
| `2025_11_09_123757_create_reservation_notes_table.php` | Reservation notes | M70 | Recreate with public ID, author/visibility/type metadata, archive/retention fields, and restrictive reservation retention. Author deletion sets null with display snapshot where required. |
| `2025_11_09_123758_create_reservation_files_table.php` | Path/label only | M70 | Replace with private-file metadata: public ID, uploader, disk/path, safe/original name, MIME, extension, size, checksum, classification, scan/quarantine state, retention/archive timestamps. Restrict reservation deletion. |
| `2025_11_09_123759_create_payments_table.php` | One loose payment row per reservation | M50 | Replace with one unique reservation payment summary plus many attempts/events/adjustments. Enforce unique provider references/idempotency and at most one canonical successful attempt. Restrict reservation deletion. |
| `2025_11_16_111142_create_personal_access_tokens_table.php` | Sanctum tokens/expiry | M00 and T01 | Consolidate into each auth group. Preserve expiry/indexes; account suspension/closure revokes rows. |
| `2025_11_30_083045_add_profile_fields_to_users_table.php` | Adds profile fields, old role, inert tenant ID | M00/T01 | Fold required identity columns into clean user creation. Do not recreate `role` or `tenant_id`. Marketplace/tenant roles use local Spatie tables. Reassess which fields are required for staff versus patients. |
| `2025_12_01_083045_create_questionnaires_table.php` | Questionnaire definition with HTML/status | M60 | Recreate with public ID, author/publication/version/archive metadata and safe HTML policy. Marketplace-owned only in current phase. |
| `2025_12_01_083055_create_questionnaire_questions_table.php` | Questionnaire questions | M60 | Recreate with stable public IDs/order; retain definition ownership. |
| `2025_12_01_083075_create_questionnaire_choices_table.php` | Choices/scores | M60 | Recreate with stable public IDs/order; scores remain internal and never enter public resources. |
| `2025_12_01_083085_create_questionnaire_recommendations_table.php` | Score ranges/HTML/conditions | M60 | Recreate with public IDs, safe HTML/version metadata, and indexes. Range-overlap validation remains application/test responsibility unless a portable constraint is selected. |
| `2025_12_01_083086_questionnaire_submissions.php` | Submission/answer/result snapshots | M60 | Recreate as retained historical snapshot with public ID, PII classification/retention, soft archive, and restrictive questionnaire retention. Never cascade-delete with questionnaire. |
| `2026_02_22_000000_create_checkup_doctor_table.php` | Doctor/checkup eligibility | M20b | Replace with `doctor_workplace_checkup`; service eligibility is scoped to a marketplace workplace. Preserve unique workplace/checkup pair and archive/history behavior. |
| `2026_06_03_095153_create_user_profiles_table.php` | One-to-one medical profile | M70 | Recreate with unique user relation, privacy/audit metadata, and retention-safe account closure. Marketplace-owned in current phase. |
| `2026_06_03_102531_add_patient_status_to_users_table.php` | Nullable patient lifecycle string | M00 | Fold into marketplace users or a patient-specific profile only after separating it from account state. Keep allowed values explicit; non-patient identities must not receive patient status. |
| `2026_06_03_103137_create_leads_table.php` | Questionnaire/manual leads | M60 | Recreate with public ID, source/status enums, consent/retention metadata, and safe links that preserve history. Marketplace-owned in current phase. |
| `2026_06_03_114235_drop_role_from_users_table.php` | Removes legacy role column | No standalone target | Eliminate. Clean user tables never create the legacy role column. |
| `2026_07_05_000000_create_audit_events_table.php` | Shared audit events | M80 and tenant T05 | Recreate independently in each path with public/batch IDs, reason/outcome/correlation, recursive redaction contract, append-only timestamps, and owning-context fields. No automatic cross-database synchronization. |
| `2026_07_06_000000_add_soft_deletes_to_questionnaires.php` | Adds soft deletes | M60 | Fold archive/soft-delete fields directly into questionnaire and submission creation. |
| `2026_07_10_000000_create_reservation_rating_options_table.php` | Pro/con option CRUD | M40 | Recreate with public ID, type/slug uniqueness, active/order/archive fields, and marketplace localization extension point. |
| `2026_07_10_010000_add_soft_deletes_to_checkup_categories.php` | Adds category archive | M30 | Fold directly into category creation. Remove rollback guard because clean down drops the empty development table in dependency order. |
| `2026_07_10_010100_add_soft_deletes_to_checkups.php` | Adds checkup archive | M30 | Fold directly into checkup creation. |
| `2026_07_10_010200_make_checkup_category_optional.php` | Nullable category/SET NULL | M30 | Build nullable category and SET NULL FK correctly in initial checkup creation; remove driver-specific alter migration. |
| `2026_07_10_010300_restrict_reservation_checkup_deletes.php` | Restricts checkup physical deletion with history | M40 | Build restrictive/history-safe FKs in initial reservation creation; remove later FK rewrite. |

## New Marketplace Structures Without Existing Migrations

| Target | Why it is required now |
| --- | --- |
| `marketplace_hospitals` | Manual hospital directory/category and filtering source |
| `hospital_listing_requests` | Doctor request for missing hospital; admin review without hospital-admin accounts |
| `doctor_specialty` | Multiple doctor skills/specialties instead of one profile specialty |
| `doctor_workplaces` | Correct parent for per-hospital marketplace services/schedules/reservations |
| `doctor_workplace_checkup` | Service eligibility at a specific workplace |
| `doctor_working_windows` | Queryable per-workplace schedules/reservation windows; replaces availability JSON |
| `reservation_schedule_changes` | Preserves reschedule actor/reason/before/after history |
| `reservation_payment_summaries` | One canonical reservation payment state/result |
| `payment_attempts` | Retriable provider attempts within the one-hour hold |
| `payment_provider_events` | Verified/idempotent callback evidence and reconciliation |
| `payment_adjustments` | Audited refund/void/manual adjustment records |
| `setting_definitions` / `setting_values` | Typed/scoped settings without plaintext secrets |
| `features` | Stable feature-key registry |
| `outbox_events` | Reliable queued integration/notification dispatch |
| `tenant_instances` | Minimal future tenant registry distinct from marketplace hospital directory |
| `tenant_feature_overrides` | Minimal subscription/feature contract foundation |
| `tenant_health_snapshots` | Sanitized heartbeat/schema/health contract; no tenant operational data |

## Key Target Constraints

### Identity and authority

- Unique user public ID/email/phone/NID according to finalized nullable/required role rules.
- `doctor_profiles.user_id` unique.
- No `users.role` and no `users.tenant_id`.
- Account state limited to `active`, `suspended`, `closed`; reservation/listing-request pending states are separate.
- Marketplace has no hospital-admin role or tenant membership authorization table.

### Marketplace hospital/workplace filtering

- Unique hospital slug; indexes for active/location/filter fields.
- Unique active doctor/hospital workplace association.
- Unique doctor/specialty and workplace/checkup pairs.
- Working-window indexes by workplace/day/effective range/start/end.
- Application/service validation rejects overlapping active windows for one doctor across workplaces.

### Reservations and holds

- Reservation belongs to patient, doctor workplace, and checkup using retention-safe FKs.
- Index doctor/workplace plus start/end/status/hold expiry for availability and expiry jobs.
- `pending` hold blocks only while `hold_expires_at` is in the future.
- Immutable marketplace hospital/doctor/checkup/category/price/currency/duration snapshots are non-null once booking succeeds.
- Per-user/device/IP limits and idempotency keys prevent hold abuse; repeated payment attempts cannot extend `hold_expires_at`.

### Payments

- One unique payment summary per reservation.
- Many attempts per summary/reservation.
- Provider reference and idempotency uniqueness scoped appropriately to provider/account.
- One nullable unique successful-attempt reference on the summary provides the canonical success contract.
- Provider events append-only and uniquely identified.

### Retention

- User/doctor/workplace/checkup/questionnaire physical deletes are restricted when historical rows exist.
- Category deletion sets nullable category references to null while snapshots retain labels.
- Notes/files/payments/submissions do not disappear through ordinary parent archive.
- Audit/outbox/medical rows follow explicit retention, never generic CRUD cascades.

## Factory and Seeder Replacement Map

Marketplace foundation requires factories for:

- user roles/account states
- hospital directory/listing request
- doctor profile/specialties/workplaces/services/windows
- checkup/category
- reservation/hold/schedule history
- payment summary/attempt/event
- questionnaire tree/submission/lead
- notes/private-file metadata
- rating options/audit/settings/features/outbox

Marketplace demo seeding includes root-admin, admin, doctors, patient, several hospital directory profiles, per-workplace services/schedules, questionnaire, rating options, and payment fixtures. Known credentials remain local/testing guarded.

Minimal tenant seeding includes tenant installation, singleton hospital profile, local admin authority bootstrap, base feature entitlement snapshot, settings, and no full tenant domain demo.

## Verification Map Before Old Migrations Are Removed

Planning is complete only; implementation must satisfy these gates group by group:

1. Add a focused schema test for the target group before removing its old migration equivalent.
2. Fresh-migrate and rollback marketplace SQLite after every group.
3. Fresh-migrate and rollback minimal tenant SQLite independently through its explicit path.
4. Run affected feature tests after each marketplace domain group.
5. Run disposable MySQL apply/rollback/reapply after all marketplace groups and again for the minimal tenant path.
6. Assert FK delete actions, unique/index constraints, soft/archive fields, and absence of legacy `role`/`tenant_id`.
7. Assert tenant foundation contains no marketplace hospital/workplace or operational product tables.
8. Run full backend tests, Pint, route list, and seeder checks before Current Task item 6 can be considered complete.

## Implementation Checkpoint

Current Task item 6 was approved and completed on 2026-07-12. The migration baseline now contains 24 marketplace migrations and a separate 6-file minimal tenant path. Marketplace and tenant SQLite/MySQL apply, rollback, and reapply checks pass. Factories and seeders are intentionally handled by Current Task item 7; broader security/ownership verification remains item 8. Detailed code review: `docs/audits/foundation-baseline-code-review-2026-07-12.md`.
