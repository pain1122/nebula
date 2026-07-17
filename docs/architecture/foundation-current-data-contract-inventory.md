# Foundation Current Data Contract Inventory

Snapshot date: 2026-07-12

Purpose: capture the schema and runtime data contract that must be preserved, corrected, or intentionally replaced before historical migrations are consolidated.

## Inspection Scope

Inspected:

- all 31 files in `database/migrations/`
- all 19 files in `app/Models/`
- `app/Enums/UserRole.php`
- all factories and seeders
- all policies
- schema-sensitive feature tests
- persistence and serialization paths in API, auth, profile, booking, admin, doctor, and questionnaire controllers
- booking, scheduling, audit, and query-sorting services
- role, session, Sanctum, CORS, and filesystem configuration relevant to the data contract

This is a static source inventory. It does not claim that the normal development database matches the migrations, and it does not replace the disposable SQLite/MySQL migration verification required later.

## Current Schema Summary

The migration chain declares 27 literal table names plus 5 Spatie Permission tables resolved through configuration, for 32 tables total. Spatie teams are disabled, so roles and permissions are currently global rather than tenant-scoped.

### Identity, framework, and authorization tables

| Table | Current contract | Constraints and retention | Reset concern |
| --- | --- | --- | --- |
| `users` | Central account identity; core name/email plus required first/last name, phone, birth date, NID; optional address/bio; nullable `patient_status` and inert `tenant_id` | Unique email/phone/NID; `tenant_id` is only indexed and has no FK; no account state or soft delete | `tenant_id` is mass assignable; hard account deletion cascades into doctor/reservation history; `patient_status=suspended` is not an authentication disable state |
| `password_reset_tokens` | Password-reset token keyed by email | Email primary key; no FK to users | Decide whether reset tokens must be purged during suspension/closure |
| `sessions` | Laravel database-session shape | `user_id` is nullable/indexed but not constrained | Runtime defaults to Redis sessions, so DB session rows are not the only revocation target |
| `personal_access_tokens` | Sanctum bearer tokens with abilities and expiry | Morph key/index; unique token; no user FK | Account suspension must revoke all tokens explicitly; abilities are currently issued as `['*']` |
| `permissions` | Spatie permissions | Unique name + guard | No permissions are seeded yet |
| `roles` | Spatie roles | Unique name + guard; teams disabled | Current `root-admin`, `admin`, `doctor`, `patient` roles are global |
| `model_has_permissions` | Direct model permissions | Composite primary key; permission cascade | No tenant/team dimension |
| `model_has_roles` | Model-role assignments | Composite primary key; role cascade | No tenant/team dimension |
| `role_has_permissions` | Role-permission assignments | Composite primary key; role/permission cascades | Permission matrix is not implemented |
| `cache` | Laravel database cache | String primary key | Framework table; preserve only if database cache remains supported |
| `cache_locks` | Laravel atomic cache locks | String primary key | Framework table |
| `jobs` | Queued jobs | Queue index | No product job contract yet |
| `job_batches` | Queue batch state | String primary key | Framework table |
| `failed_jobs` | Failed queue payloads/exceptions | Unique UUID | Payload/exception retention and secret/PII filtering are undefined |

### Clinical catalog and booking tables

| Table | Current ownership and relations | Constraints and retention | Reset concern |
| --- | --- | --- | --- |
| `specialties` | Platform-global self-referencing specialty tree | Unique name/slug; parent becomes null on delete | Current migration `down()` does not drop the table; stored `level` can drift from the parent tree |
| `doctor_profiles` | One intended profile per doctor user; optional specialty | User delete cascades; specialty delete sets null; `user_id` is not unique | Model declares `hasOne`, but DB permits many profiles; hard user deletion can erase doctor identity and then reservations |
| `checkup_categories` | Platform-global catalog category | Unique slug; soft deletes | Physical deletion sets child checkup category to null after later migration |
| `checkups` | Platform-global service/checkup; optional category; integer price | Unique slug; soft deletes; category delete sets null | No duration, currency, immutable price/title snapshot, tenant ownership, or price history |
| `checkup_doctor` | Many-to-many doctor eligibility | Unique checkup/doctor pair; both FKs cascade on physical delete | Application archive preserves pivot; physical doctor/checkup deletion removes eligibility history |
| `reservations` | Patient user + doctor profile + checkup + start/end + status | User and doctor FKs cascade; checkup FK now restricts; no compound schedule index or immutable snapshots | Deleting a user or doctor can erase reservations and all dependent history; no tenant; status is free string in DB |
| `reservation_notes` | Reservation note with optional author user | Reservation delete cascades; author delete sets null | No note type, visibility, tenant, author snapshot, archive, or audit metadata |
| `reservation_files` | Reservation-attached path/label | Reservation delete cascades | No uploader, disk, MIME, size, hash, scan state, visibility, retention, or soft delete |
| `payments` | Payment row related to reservation; provider/ref/amount/currency/status | Reservation delete cascades; `reservation_id` and `provider_ref` are not unique | Model declares `hasOne` but DB permits many; design cannot distinguish attempts/transactions; signed integer amount and free-string states |
| `reservation_rating_options` | Platform-global pro/con labels | Unique type + slug; active/sort indexes; soft deletes | No tenant/localization ownership; API returns raw model shapes |

### Questionnaire, lead, profile, and audit tables

| Table | Current ownership and relations | Constraints and retention | Reset concern |
| --- | --- | --- | --- |
| `questionnaires` | Platform-global questionnaire definition | Unique slug; draft/published string; soft delete | HTML is unsanitized; no tenant/locale/author/publication timestamps |
| `questionnaire_questions` | Child question | Questionnaire physical delete cascades; questionnaire/sort index | Admin update deletes/recreates children, so IDs and edit history are unstable |
| `questionnaire_choices` | Child choice with score | Question physical delete cascades; question/sort index | Public show currently exposes `score`, enabling answer gaming |
| `questionnaire_recommendations` | Score-range recommendation | Questionnaire physical delete cascades; score-range index | Overlap constraints are not enforced; HTML and arbitrary JSON conditions are unsanitized/unversioned |
| `questionnaire_submissions` | Snapshot of questionnaire, submitter, answers, score, and recommendation result | Questionnaire physical delete cascades; user delete sets null; soft delete | Force-deleting a questionnaire erases submissions despite snapshots; raw admin responses expose phone/token/answers/result/meta |
| `leads` | Guest/marketing lead linked optionally to a submission and converted user | Links set null; unique phone + source + source key | Status/source are free strings; meta may contain sensitive questionnaire information; no tenant/consent/retention fields |
| `user_profiles` | Intended one-to-one patient medical profile | Unique user FK; user delete cascades | Hard account delete erases allergies/chronic disease history; no tenant/visibility/audit/retention metadata |
| `audit_events` | Append-style actor/action/subject/before/after record | Actor delete sets null; polymorphic subject has no FK; indexed batch/actor/action/risk/time/subject | No tenant/context/reason/outcome; only top-level blocked keys are filtered; nested secrets, medical fields, NID, phone, and other PII are not generically redacted |

## Model Contract Matrix

| Model family | Current relation/cast contract | Mass-assignment or serialization concern |
| --- | --- | --- |
| `User` | `hasOne` doctor profile, `hasOne` user profile, `hasMany` reservations; Spatie roles; Sanctum tokens | `tenant_id` is fillable without a tenant model/FK; hidden fields cover only password/remember token; raw user responses can include tenant and lifecycle fields |
| `DoctorProfile` | Belongs to user/specialty; has many reservations; belongs to many checkups; availability array; verified bool | `user_id` and `verified` are fillable; APIs sometimes return the raw model, including availability, phone, ownership IDs, and timestamps |
| `CheckupCategory` / `Checkup` | Soft deletes; category/checkup/reservation/doctor relations | Ownership/category IDs and price are fillable; public checkup listing returns a raw paginator rather than an explicit resource |
| `Reservation` | Dates cast to datetime; status cast to `ReservationStatus`; belongs to patient/doctor/checkup; has notes/files and intended one payment | All ownership IDs and status are fillable; create response returns raw reservation/payment; no point-in-time catalog snapshots |
| `Payment` | Belongs to reservation | Reservation ID, provider reference, amount, currency, and status are all fillable; no enum/casts or protected transition method |
| `ReservationNote` / `ReservationFile` | Belong to reservation; note author belongs to user | Ownership/path fields are fillable; file metadata is insufficient for private medical data |
| `Questionnaire`, `QuestionnaireQuestion`, `QuestionnaireChoice`, `QuestionnaireRecommendation` | Nested questionnaire/question/choice/recommendation relations; questionnaire soft deletes; conditions array | Parent IDs, scores, HTML, and status are fillable; no sanitizer/version policy |
| `QuestionnaireSubmission` | Soft deletes; answers array; no declared relationships despite FK columns | Guest token/phone, submitter PII, answers, result HTML, and ownership IDs are fillable; `meta` exists in schema but is omitted from fillable/casts |
| `Lead` | Belongs optionally to submission and converted user; meta array | Link IDs, status/source, and meta are fillable; no tenant or consent boundary |
| `AuditEvent` | Actor relation; before/after arrays; no updated timestamp | Entire audit payload is fillable through the logger; redaction is shallow and key-name based |
| `ReservationRatingOption` | Soft deletes; bool/integer casts | Global raw model response; no localized/tenant scope |
| `Specialty` | Self-referencing tree | Parent and stored level are independently fillable |

## Status and Vocabulary Inventory

| Concept | Current values/source | Conflict |
| --- | --- | --- |
| User role | `root-admin`, `admin`, `doctor`, `patient` in `UserRole` and Spatie | `UserRole::adminAssignableValues()` lets normal admin APIs assign `admin`; authority decision remains open |
| Patient lifecycle | `free`, `trial`, `active`, `expired`, `suspended` accepted by admin user controller | Lives only on patients and is not checked by authentication; it must not be reused implicitly as the platform account state |
| Reservation | `pending`, `paid`, `done`, `cancelled` in enum | Original migration comment and `ReservationPolicy` use `canceled`; controller compatibility checks also mention `completed`. Target decision (2026-07-12): normalize the replacement contract and runtime to `cancelled` during Current Task item 6. |
| Payment | Comments/use show `unpaid`, `paid`, `refunded`, `failed` | No enum, DB check, transition owner, provider callback, attempt model, or reconciliation state |
| Questionnaire | `draft`, `published` | Free string in DB; publication/version policy absent |
| Rating option | `pro`, `con` constants | Free string in DB |
| Lead | Default `new`; source defaults to `manual` and questionnaire uses `questionnaire` | No enums or lifecycle owner |
| Audit risk | Current code writes values such as `critical` | No enum or documented allowed set |

## Foreign-Key Retention Truth

Current physical-delete paths are not uniformly history-safe:

- Category physical delete preserves checkups by setting `checkup_category_id` null.
- Checkup physical delete is restricted when reservation history exists.
- User physical delete cascades doctor profiles, reservations, user profiles, and Spatie assignments. A patient account deletion can therefore erase reservation/payment/note/file history; a doctor account deletion can cascade through the doctor profile into reservations.
- Reservation physical delete cascades notes, files, and payments.
- Questionnaire physical delete cascades its questions, choices, recommendations, and submissions.
- Actor/author/lead-user references generally set null, which preserves rows but loses identity unless snapshots are added.

This conflicts with the locked roadmap rule that historical business/medical records survive account or catalog archival. The migration baseline must not copy the current user/doctor/reservation cascades blindly.

## Authorization Contract

Current policies:

- `CheckupPolicy::archive()` and `CheckupCategoryPolicy::archive()` allow admin-panel roles.
- `ReservationPolicy` defines view/update/cancel/reschedule, but controllers generally use manual ownership checks instead.
- `ReservationPolicy` compares an enum-cast status to strings and uses `canceled`, so its terminal-state checks do not match the active `cancelled` enum contract.
- No policies exist for users, doctor verification, questionnaires/submissions, rating options, notes, files, payments, leads, audits, tenants, or settings.

Route middleware provides broad role gates, but it does not replace per-record ownership or tenant policy checks.

## API Exposure Inventory

No `app/Http/Resources/` layer exists. Response shapes are a mixture of explicit arrays, raw models, raw paginators, and two different envelope styles.

| Surface | Current exposure | Contract risk |
| --- | --- | --- |
| `/api/auth/me` and token auth responses | Explicit limited user/role/doctor summary | Best current response boundary; token abilities are still wildcard |
| `/api/auth/profile` | Owner receives identity, NID, contact data, patient status, and medical profile | Legitimate owner scope, but update returns raw `UserProfile` and needs an explicit resource/privacy contract |
| Admin users | Index/show explicitly return broad PII including NID, phone, address, and bio; store/update return raw `User` | No field-level permission/redaction; raw responses can include tenant/lifecycle/timestamps |
| Doctor APIs | Public doctor selection is explicit; doctor/admin profile endpoints often return raw `DoctorProfile` | Raw shape includes ownership IDs, phone, availability, verification, and timestamps |
| Checkup APIs | Authenticated checkup list returns raw models/paginator | Exposes schema shape directly and couples clients to migration columns |
| Reservation APIs | List/detail formats are mostly explicit; reservation creation returns raw reservation and payment | Different endpoints expose different shapes; provider/internal fields can leak as schema evolves |
| Admin questionnaires | Raw questionnaire models and nested relations | Exposes stored HTML, scores, conditions, timestamps, and schema shape |
| Public questionnaire | Explicit output, but includes every choice `score` and unsanitized stored HTML | Users can infer/game scoring; stored XSS risk depends on clients rendering HTML safely |
| Admin questionnaire submissions | Raw paginated items and raw detail model | Exposes guest token, phone, submitter data, answer snapshots, result HTML, score, and meta without explicit redaction |
| Rating options | Raw models/paginators | Low sensitivity but inconsistent envelope/resource conventions |

## Factories and Seeders

- Only `UserFactory` exists. It assumes required identity fields and defaults `patient_status` to `free`, even when tests later assign a non-patient role.
- `DatabaseSeeder` always calls local user seeders; it is not environment-guarded inside the seeder.
- `LocalUsersSeeder` creates deterministic root-admin/admin/doctor/patient accounts with known passwords. Safe use therefore depends on never running it in production.
- Roles are seeded, but permissions are not.
- No tenant/site/settings/feature, questionnaire, reservation, payment-attempt, note, file, lead, rating, or audit factories exist.
- Category/checkup seeders use ordinary `updateOrCreate`; archived rows are excluded by the soft-delete scope, so rerunning after archival can collide with unique slugs.
- `DoctorProfileSeeder::firstOrCreate()` assumes one profile per user without a DB unique constraint.
- Doctor API registration can explicitly insert `experience_years = null` even though the column is non-null with a default, creating a controller/schema mismatch when the optional input is omitted.

## Schema-Sensitive Test Contract

Existing high-value coverage:

- all feature tests use `RefreshDatabase`; core roles are seeded when the roles table exists
- catalog archive tests prove soft archive, category detach/reassignment, checkup FK restriction, history preservation, recent-password step-up, policy denial, and fail-closed audit transactions
- booking/payment risk tests cover pivot eligibility, generated/past slot rejection, and unpaid-to-paid denial
- audit tests cover transactional rollback and top-level password omission
- token tests cover expiry, refresh rotation, bearer-only refresh, logout revocation, and expiry denial
- questionnaire tests cover application soft deletes preserving nested rows
- listing and rating-option tests depend on current sort/index/model fields
- registration/profile tests depend on generated required identity fields and currently expect physical account deletion

Important missing coverage for the baseline:

- one doctor profile per user and chosen payment cardinality
- account suspension plus Redis/database session and bearer-token revocation
- account/archive retention of reservations, payments, notes, files, reports, submissions, and audit history
- patient/doctor/admin ownership-policy denial tests
- tenant assignment/mass-assignment/isolation tests
- payment callback signature/idempotency/reconciliation/override tests
- concurrent booking beyond the current application-lock path
- questionnaire duplicate/missing answers, score secrecy, HTML sanitization, throttling/anti-automation, and force-delete retention
- medical upload/download validation and authorization
- API resource/redaction tests for NID, phones, guest tokens, answers, medical data, and raw model leakage
- nested audit/log secret and PII filtering
- specialty rollback and complete fresh/rollback/re-apply schema assertions

`ProfileTest::test_user_can_delete_their_account()` explicitly expects a physical user deletion. That test and the current controller conflict with the roadmap's history-retention direction and require an approved account-closure rule before the baseline is rebuilt.

## Confirmed Baseline Conflicts

1. Tenant ownership is not implemented: `users.tenant_id` has no FK/model/policy and is mass assignable; Spatie teams are disabled.
2. Physical user/doctor deletion can erase reservation and dependent history.
3. `User::doctorProfile()` and `Reservation::payment()` declare has-one relations without matching unique constraints.
4. Reservation status vocabulary is inconsistent and policy comparisons are enum-unsafe.
5. Payment storage cannot yet express multiple attempts safely or enforce one canonical successful result.
6. Reservation rows do not snapshot booked title/category/price/currency/duration.
7. Public questionnaire output exposes scores and stored HTML is unsanitized.
8. Questionnaire physical deletion can erase historical submissions despite their snapshots.
9. Medical file rows are insufficient for private, validated, scanned, retained records.
10. API serialization is not a stable or privacy-reviewed contract.
11. Audit redaction is shallow and audit rows lack tenant/reason/outcome context.
12. Local demo accounts are not guarded inside `DatabaseSeeder`.
13. Specialty rollback is broken.
14. Domain factories and clean demo data are incomplete.

## Approved Direction After Inventory Review

The user resolved the product decisions on 2026-07-12. The detailed target is `docs/architecture/foundation-target-domain-and-ownership-contract.md`.

1. The main marketplace and tenant hospital websites are separate operational products/databases; identities and operational records are not shared automatically.
2. Marketplace hospital profiles are admin-curated directory/category records without hospital admins. Marketplace doctors attach existing hospitals as workplaces or request missing directory entries, then configure services/schedules per workplace.
3. A tenant website is one implicit hospital with entirely local admins, doctors, patients, services, schedules, reservations, payments, and medical data. Tenant doctors default to the local hospital and do not use marketplace workplace selection.
4. Root-admin alone manages marketplace admin authority. Marketplace admins manage marketplace hospital directory/product records; tenant admins exist only locally. Marketplace monitoring of tenant health/subscription does not grant operational access.
5. A reservation may have repeated payment attempts after errors, but only during a one-hour reservation hold and with at most one canonical success.
6. Appointment start/duration may change through an authorized, conflict-checked, audited schedule-change workflow that preserves prior values.
7. Account states are `active`, `suspended`, and `closed`; suspension and closure revoke sessions and bearer tokens while preserving records. `pending` is the unpaid one-hour reservation hold or another explicit domain review state, not an account state.

The engineering safety direction also remains: explicit API resources replace raw model responses, public questionnaire choice scores are hidden, and sensitive/medical data is redacted from central audit/log payloads.
