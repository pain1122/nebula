# Repository Technical Audit - 2026-07-08

Review-only audit captured for later strict analysis.

Source state: current dirty worktree in `C:\Users\abbas\Desktop\work\checkupino\nebula`.

No source changes were made during the original audit.

## 1. Executive Summary

Checkupino is a Laravel medical checkup platform foundation: patients can register, browse checkups, select verified doctors, create/cancel reservations, and submit public questionnaires that can generate leads. Admins can manage users, reservations, questionnaires, doctors, specialties, checkup categories, and checkups through a mix of API and Blade surfaces.

Current maturity: functional backend MVP / product foundation, not a production candidate. The strongest implemented differentiators beyond ordinary booking CRUD are configurable questionnaire scoring with lead capture, role-based patient/doctor/admin boundaries, doctor availability, and the new high-authority admin-user audit plus step-up slice. The biggest gaps are payment verification, booking race safety, medical-result/report workflows, and production readiness.

## 2. Verified Technology Inventory

Actively used:

| Tech | Verified version/source |
|---|---|
| Laravel | `12.36.1`, `composer show --locked --direct` |
| PHP host CLI | `8.2.0`, `php -v` |
| PHP-FPM Docker | `8.3-fpm`, `docker/php/Dockerfile`; `8.3-fpm-alpine`, `docker/prod/Dockerfile` |
| Sanctum | `4.2.0`, `composer.lock` |
| Spatie Permission | `6.23.0`, `composer.lock` |
| Breeze | `2.3.8`, web auth controllers/routes |
| MySQL | `mysql:8.0`, Compose files |
| Redis | `redis:7-alpine`, Compose files |
| Nginx | `nginx:alpine` local, `nginx:1.27-alpine` prod |
| Blade/Tailwind/Vite | root `resources/*`, `tailwind.config.js`, Vite `7.1.12` |
| React admin workspace | React `18.3.1`, TypeScript `5.6.3`, Vite `8.0.16`, Bootstrap `5.3.3`, React Router `6.30.4`, Redux Toolkit `2.2.8`, Axios `1.17.0` |

Installed but not meaningfully product-used:

- `frontend` Velzon demo inventory.
- Many demo Redux slices using `fakebackend_helper.ts`.
- Root `@tailwindcss/vite`.
- Template API helper pointing at Themesbrand.

Legacy/migration-related:

- Blade admin remains active while React admin is being migrated.
- `users.role` was added then dropped.
- `frontend` still contains large template/demo pages.

Planned only:

- Payment provider callbacks.
- Medical report/result workflows.
- Notifications.
- Production deployment process.
- Hospital/clinic tenancy.

## 3. Architecture Map

Laravel is conventional controller/model/request/service architecture, not strict domain modules.

Major boundaries:

- Web/Blade: `routes/web.php`, `routes/admin.php`, `routes/doctor.php`, `resources/views`.
- API: `routes/api.php`, `app/Http/Controllers/Api/*`.
- Shared-ish domain logic: `app/Services/SchedulingService.php`, `app/Services/AuditLogger.php`.
- Auth/roles: Breeze session auth, Sanctum API auth, Spatie roles via `UserRole`.
- React admin: separate `frontend/` Vite app with session-cookie auth shell, protected routes, root-admin dev toolbox split.
- DB: MySQL target, SQLite in tests.
- Redis: configured for sessions/cache but product jobs/events are not used.
- External integrations: none production-real; Stripe appears only as placeholder string in `payments.provider`.

## 4. Status Matrix

| Area or feature | Status | Evidence | Current limitations | Resume-safe claim |
|---|---|---|---|---|
| Authentication | Implemented | `AuthController`, Breeze auth controllers, `routes/auth.php`, `routes/api.php` | API login creates bearer tokens; SPA uses web login separately | Session and Sanctum auth implemented |
| Authorization and roles | Implemented | `UserRole`, `RolesSeeder`, Spatie middleware | Mostly role-level, few policies | Spatie role-based access |
| Root-admin functionality | Partial | `root-admin` enum/seed, React toolbox roles | Few root-only backend actions | Root-admin role boundary started |
| Admin functionality | Partial | API admin routes, Blade CRUD | Missing full UI/audit on most mutations | Admin APIs and Blade catalog CRUD |
| Doctor functionality | Partial | doctor routes/controllers | No report/result workflow | Doctor profile, services, reservations |
| Patient functionality | Partial | booking/profile routes | No medical outcomes | Patient booking/profile foundation |
| Specialties | Implemented | `SpecialtyController`, migration/model | Broken migration `down()` | Specialty CRUD |
| Checkup categories | Implemented | `CheckupCategoryController` | Cascade deletes risky | Category CRUD |
| Checkups/services | Implemented | `CheckupController`, `Checkup` | Cascades; pivot ignored by booking | Checkup catalog CRUD |
| Doctor profiles | Implemented | `DoctorProfileController`, `Doctor\ProfileController` | `user_id` not unique | Doctor profile management |
| Doctor service selection | Partial | `Doctor\ServicesController`, `checkup_doctor` | Booking ignores pivot | Service selection scaffolded/partial |
| Patient booking | Partial | `BookingApiController`, `BookingController` | No slot provenance/past-date/race safety | Basic reservation creation |
| Reservation creation | Partial | `storeReservation`, web `store` | Conflict check only app-level | Creates reservation + unpaid payment row |
| Reservation cancellation | Implemented | `cancelReservation` | Patient-only API; policy unused | Patient cancellation with ownership |
| Reservation listing | Implemented | patient/admin/doctor list endpoints | No broad tests | Role-specific listing |
| Reservation status lifecycle | Partial | `ReservationStatus`, admin/doctor status updates | No transition state machine | Basic status updates |
| Booking-slot validation | Partial | `SchedulingService` | Requested slot need not be generated slot | Availability/conflict helper |
| Questionnaires | Implemented | admin/public controllers, migrations | Updates delete/recreate nested rows | Configurable questionnaire CRUD |
| Questionnaire scoring | Partial | `PublicQuestionnaireController@submit` | Duplicate/missing answers can skew score | Score-based recommendations |
| Lead capture | Implemented | `Lead`, public submit `updateOrCreate` | No admin lead UI | Questionnaire guest leads |
| Payments | Scaffolded | `Payment`, migration, unpaid row create | No provider flow | Payment rows modeled |
| Payment callbacks/webhooks | Not found | route/search | None | Must not claim |
| Medical-result uploads | Scaffolded | `ReservationFile` model/migration | No upload routes | Schema only |
| Doctor analysis/reports | Not found | search | None | Must not claim |
| Prescriptions/medication | Not found | search | None | Must not claim |
| Hospital/clinic support | Planned | `tenant_id` only | No tenancy model | Future only |
| Notifications | Scaffolded | Breeze email verification/reset | No product notifications | Auth notifications only |
| Audit logging | Partial | `AuditEvent`, `AuditLogger`, tests | Only admin user create/update | High-authority audit slice |
| File/media handling | Scaffolded | filesystem config, `ReservationFile` | No secure workflow | Storage configured only |
| Blade admin | Implemented | admin Blade routes/views/controllers | Limited to catalog/dashboard | Active Blade CRUD |
| React admin | Scaffolded | `frontend/src/panel`, `session_api.ts` | Shell/template, few real pages | Session-auth admin shell |
| Docker/local infra | Partial | `docker-compose.yml` | Manual bootstrap, no healthchecks | Local Docker stack |
| Production deployment | Scaffolded | `docker-compose.prod.yml`, prod Dockerfile | Skeleton, no CI/TLS/backups | Production Docker skeleton |
| Automated tests | Partial | 42 tests pass | Missing booking/payment/security flows | Focused backend tests |

## 5. Auth And Authorization Audit

Sanctum mode is hybrid. First-party browser SPA uses session cookies: `frontend/src/helpers/session_api.ts` calls `/sanctum/csrf-cookie`, JSON `POST /login`, then `/api/auth/me`. API/mobile clients use bearer tokens from `/api/auth/login`; refresh requires current bearer token.

CSRF handling: session login uses web routes and CSRF cookie; CORS supports credentials for local frontend origins. `bootstrap/app.php` calls `statefulApi()`.

Role matrix:

| Role | Allowed surfaces |
|---|---|
| `root-admin` | API admin group, Blade admin group, React root-admin dev toolbox |
| `admin` | API admin group, Blade admin group, React product admin routes |
| `doctor` | Doctor web/API profile, services, reservation listing/detail/complete |
| `patient` | Profile, booking, own reservations/cancel |
| guest | registration/login, public questionnaire list/show/submit |

Risks:

- Admin user create/update is step-up + audit protected, but doctor verification, reservation status updates, questionnaires, and Blade catalog mutations are not.
- Normal admins can create/update `admin` users, though not `root-admin`.
- No disabled-user field or session invalidation workflow exists.
- Ownership is handled manually in patient cancel and doctor show/complete.
- `ReservationPolicy` exists but is not consistently used by controllers.

## 6. Booking And Reservation Workflow

Implemented path:

1. Patient fetches checkups via `GET /api/checkups` or Blade `/book`.
2. Doctor selection uses `BookingApiController@doctorsForCheckup` and Blade `chooseDoctor`.
3. Availability uses `DoctorProfile.availability` JSON and `SchedulingService::buildSlots`.
4. Reservation creation uses `BookingApiController@storeReservation` or `Front\BookingController@store`.
5. A `payments` row is created with `status=unpaid`, `currency=IRR`, provider placeholder.
6. Patient/admin/doctor list reservations through API endpoints.
7. Patient can cancel; doctor can mark done after appointment time; admin can set any enum status.

Lifecycle gaps:

- Booking uses `doctor_profiles.specialty_id === checkups.checkup_category_id`, a cross-table ID comparison.
- The `checkup_doctor` pivot exists but is ignored.
- No validation that submitted `starts_at` is one of the generated availability slots.
- No past-date rejection on create.
- No DB lock/unique constraint for doctor time ranges, so double booking is race-prone.
- No payment confirmation before reservation can be marked `paid`.
- Status transitions are permissive, especially admin `updateStatus`.

## 7. Questionnaire And Lead Capture

Questionnaires are configurable: admin payload creates title/slug/status/content, nested questions, choices with scores, and score-range recommendations. Public submit calculates `total_score`, snapshots answers/result, and creates a `Lead` for guests.

Limits:

- Public submit has no throttle/CAPTCHA.
- It does not enforce exactly one answer per question.
- It permits duplicate question answers.
- It returns/admin-stores HTML fields that require careful frontend sanitization.
- It is connected to users optionally and leads, but not to reservations/checkups/doctors.

## 8. Payment Architecture

Actual payment functionality is scaffolded only. `payments` has `reservation_id`, `provider`, `provider_ref`, `amount`, `currency`, `status`. Reservation creation inserts an unpaid row with provider string `stripe`.

No payment controller, callback route, webhook, SDK, idempotency key, signature verification, retry, reconciliation, or refund logic exists. Admin can set reservation status to `paid` without verified payment, and payment row status is independent.

## 9. Medical Workflow Analysis

| Workflow | Level |
|---|---|
| Medical profile/history basics | Partial: `user_profiles` and `/api/auth/profile` |
| Doctor-requested tests | Not present |
| Patient result uploads | Schema/model only: `reservation_files` |
| Doctor result review | Not present |
| Doctor notes | Schema/model only: `reservation_notes` |
| Structured reports/analysis | Not present |
| Prescriptions/medications | Not present |
| Follow-up/outcomes | Not present |
| Admin access to outcomes | Not present |

Smallest meaningful vertical slice:

- Reservation-attached result upload.
- Private download authorization.
- Doctor review note/report.
- Patient outcome view.
- Audit events for medical file/report actions.

## 10. File And Sensitive-Data Security

No upload/download workflow is implemented. `ReservationFile` stores `path` and `label`; filesystem config has local private and public disks; production Nginx exposes `/storage/` public files.

There are no MIME/extension/size checks, malware scanning, signed URLs, ownership-gated downloads, deletion policy, or audit trail. Current implementation is fine for development placeholders, not real medical files.

## 11. Data Model Review

Strong choices:

- Spatie role tables as authority.
- Lead/user split.
- Questionnaire submission snapshots.
- Audit event table with actor/subject/action/before/after.
- Unique user email/phone/NID.

Risks:

- `doctor_profiles.user_id` lacks unique constraint despite `User::doctorProfile()` hasOne.
- `payments.reservation_id` lacks unique constraint despite `Reservation::payment()` hasOne.
- Reservation time ranges have no conflict-enforcing index/lock.
- Catalog cascades can delete reservation/payment history through checkup/category deletes.
- `specialties` migration `down()` does not drop the table.
- `reservation.status` values mix old `canceled` comment with implemented `cancelled`.
- `tenant_id` exists on users but no tenant model/policies.

## 12. Blade Admin And React Admin Migration

Blade admin:

- Working dashboard plus CRUD for specialties, checkup categories, checkups under `/admin/*`.
- Protected by `auth`, `verified`, and admin/root-admin role middleware.
- Strength: simple active runtime.
- Weakness: no audit/step-up on catalog deletes/pricing.

React admin:

- Vite app with protected routes, Redux store, session-cookie login/logout/current-user, product-admin dashboard/profile routes, root-admin-only dev toolbox.
- It is not yet a product admin: most pages are Velzon demo/template pages, and many slices still use fake backend helpers.

Migration strategy:

- Blade and React can coexist if React remains admin shell and Blade remains legacy runtime.
- Complete first: users, reservations, doctors, questionnaires, checkups/categories.
- Keep bearer tokens out of browser admin.
- Keep product routes separate from `/panel/dev`.

## 13. Infrastructure And Deployment

Local Compose:

- app
- nginx
- MySQL 8
- Redis 7

It likely needs manual dependency install, key generation, migration, and root Vite dev/build; no local healthchecks.

Production skeleton:

- Multi-stage app/nginx images.
- Named storage/db/redis volumes.
- Healthchecks.
- Optional queue/scheduler profiles.

Not staging-ready because TLS, backups, CI image build/smoke tests, env validation, migration release strategy, and React admin deployment are unfinished.

## 14. Testing And Quality

Commands run:

| Command | Result |
|---|---|
| `php -v` | Passed, PHP 8.2.0 host |
| `composer show --locked --direct` | Passed |
| `php artisan about --only=environment` | Passed |
| `php artisan route:list --except-vendor` | Passed, 91 routes |
| `php artisan test` | Passed, 42 tests / 136 assertions |
| `composer validate --no-check-publish` | Passed |
| `vendor\bin\pint --test` | Passed |
| `npm run build -- --outDir $env:TEMP\checkupino-root-build` | Passed with stale browser data warning |
| `frontend: npm run build -- --outDir $env:TEMP\checkupino-frontend-build` | Passed with Tailwind/chunk warnings |
| `frontend: npx tsc --noEmit` | Failed: `ForgetPassword.tsx` imports missing `./reducer` |
| `.github` direct check | No CI directory found |

Highest-value missing tests:

- Booking create rejects past slot.
- Booking requires generated slot.
- Booking race/double-submit.
- Pivot eligibility.
- Patient cannot cancel others' reservations.
- Doctor cannot complete others' reservations.
- Admin status transition rules.
- Payment callback/idempotency once built.
- Questionnaire duplicate-answer rejection.
- File upload/download authorization.
- Catalog delete safety.
- Root-admin exclusion.
- CORS/session auth smoke.
- React auth route guard.
- Production Docker smoke.

## 15. Security Risk Register

| Risk | Severity | Evidence | Impact | Mitigation |
|---|---|---|---|---|
| Booking race condition | High | `SchedulingService::hasConflict` only | Double bookings | DB locking/transaction strategy |
| Payment spoofing/status drift | High | admin `updateStatus`, no webhook | False paid reservations | Verified payment state machine |
| Sensitive file exposure | High | public disk/Nginx storage, no auth downloads | Medical data leak if uploads added | Private disk + signed/authorized downloads |
| Authorization bypass via IDs | Medium | manual ownership checks | Missed controller can leak data | Use policies consistently |
| Excessive admin power | Medium | admin can create admin users | Privilege escalation within admin tier | root-admin-only admin role assignment |
| Missing audit trail | Medium | only admin user slice audited | Weak investigation | Expand audit/step-up |
| CSRF/CORS drift | Medium | credentialed CORS | SPA auth breaks/leaks if misconfigured | env validation + tests |
| Mass assignment | Medium | broad fillables incl. `tenant_id` | Future privilege/tenancy risk | DTOs/form requests, guard tenant |
| Questionnaire abuse | Medium | public submit no throttle | spam/lead pollution | throttle/CAPTCHA/rate limits |
| Data leakage in API | Medium | admin submissions return full rows | PII overexposure | response resources/redaction |
| Unsafe logs/secrets | Low/Med | no audit log policy | accidental sensitive payloads | logging policy/filtering |
| Production secrets/deployment | Medium | prod skeleton only | unsafe launch | secrets/CI/TLS/backups |

## 16. Strongest Engineering Work

1. High-authority user audit/step-up: `AuditEvent`, `AuditLogger`, `EnsureRecentPasswordConfirmation`, tests. Explain fail-closed transaction tradeoff.
2. Spatie role source of truth: `UserRole`, dropped `users.role`, role middleware. Explain avoiding split-brain auth.
3. Sanctum browser/mobile split: `session_api.ts`, web login, API token refresh tests. Explain cookie vs bearer tradeoff.
4. Questionnaire scoring + lead capture: nested configurable schema and public submit. Explain snapshotting and limitations.
5. Docker/prod skeleton: local/prod Compose, multi-stage Dockerfile. Explain skeleton vs deployment guarantee honestly.

## 17. Weaknesses And Unfinished Areas

Urgent blockers:

- Booking race safety.
- Payment verification.
- Private medical file handling.
- Broader audit/step-up.
- Admin status transition rules.

Later improvements:

- API response resources.
- React product pages.
- CI.
- Migration cleanup.
- Notification strategy.
- Hospital/tenant modeling.

## 18. Recommended Golden Demo Flow

Strongest demo today:

Admin logs in, manages checkups/categories/specialties in Blade, doctor profile/service exists, patient books a checkup with a verified doctor, patient/doctor/admin view reservation, doctor marks done, public questionnaire submission creates scored recommendation and lead.

Next target flow:

Patient books service -> doctor sees reservation: mostly exists.

Doctor requests test -> patient uploads result -> doctor reviews -> doctor submits report -> patient receives outcome: must be built almost entirely, except reservation/files/notes schema foundations.

## 19. Prioritized Roadmap

P0:

- Enforce booking generated-slot/past-date/race safety.
- Add payment state rules.
- Add private file authorization.
- Audit reservation/catalog mutations.
- Complexity: medium-large.
- Unlocks correctness/security claims.

P1:

- One medical vertical slice: result upload, doctor report, patient outcome, audit.
- Complexity: large.
- Unlocks healthcare workflow claim.

P2:

- React admin product pages: users, reservations, doctors, questionnaires, checkups.
- Complexity: medium-large.
- Unlocks React admin claim.

P3:

- CI, staging Docker smoke, demo seed data, screenshots/video, docs.
- Complexity: medium.
- Unlocks portfolio-ready claim.

P4:

- Hospitals/clinics, prescriptions, notifications, analytics.
- Complexity: large.
- Expansion only.

## 20. Truthful Resume Package

One-line:

Built a Laravel 12 medical checkup platform foundation with Sanctum auth, Spatie roles, booking, questionnaires, lead capture, Docker infrastructure, and a React admin migration shell.

Summary:

Checkupino is a Laravel 12 healthcare platform prototype/back-end MVP supporting role-based patients, doctors, admins, checkup booking, doctor profiles, questionnaire scoring, lead capture, and admin operations. It uses Sanctum, Spatie Permission, Blade, Docker, MySQL/Redis, and a React/TypeScript admin workspace under migration.

Safe bullets:

- Implemented Laravel Sanctum authentication with separate session-cookie browser flow and bearer-token API flow.
- Modeled role-based access for root-admin, admin, doctor, and patient using Spatie Permission.
- Built checkup, doctor profile, availability, reservation, and cancellation APIs with Blade booking screens.
- Added configurable questionnaire scoring with public submissions and lead capture.
- Implemented fail-closed audit logging and session-backed step-up for admin user create/update.
- Created Docker local/prod skeletons with PHP-FPM, Nginx, MySQL, Redis, queue/scheduler profiles.
- Migrated a React/TypeScript admin template toward a Sanctum session-auth shell.

Do not claim yet:

- production-grade
- HIPAA/medical compliance
- real payments
- complete medical records
- prescriptions
- hospital SaaS
- deployed/staging-ready
- race-safe booking

## 21. Interview Prep

Likely questions:

1. Why Sanctum cookies for SPA and bearer tokens for mobile?
2. How does Spatie role authority avoid `users.role` drift?
3. What does the audit logger guarantee and not guarantee?
4. How would you fix double booking?
5. Why is the current payment system scaffolded?
6. How does questionnaire scoring work?
7. What are the privacy risks with medical uploads?
8. Why is the React admin not canonical yet?
9. What tests matter before launch?
10. How would you introduce reports/results without overbuilding?

Hard follow-ups:

- Transaction isolation for slot locking.
- Idempotent payment callbacks.
- Policy-based ownership checks.
- Private file serving.
- Status state machines.
- XSS handling for stored HTML.
- CI/staging readiness.

## 22. Final Truth Map

Project:
Checkupino / Nebula

Purpose:
Medical checkup booking, doctor profiles, questionnaires, and lead capture foundation.

Verified current stack:
Laravel 12.36.1, PHP 8.2 host / PHP 8.3 Docker, Sanctum 4.2, Spatie Permission 6.23, MySQL 8, Redis 7, Nginx, Blade/Tailwind/Vite, React 18/TypeScript/Vite admin workspace.

Current maturity:
Functional backend MVP / product foundation, not production candidate.

Already working:
Auth, roles, Blade catalog CRUD, basic booking/reservations, doctor profile/services, questionnaire scoring/lead capture, admin user audit/step-up slice, Docker skeleton.

Partially working:
React admin, reservation lifecycle, doctor workflows, payments, audit coverage, local/prod infrastructure.

Scaffolded:
Reservation files/notes, payment provider fields, production deployment, notifications beyond auth.

Planned only:
Hospitals/clinics, prescriptions, real medical reports, payment callbacks, full React admin product.

Not found:
Payment webhooks, verified payment flow, medical-result upload routes, prescriptions, hospital/clinic models, CI.

Live/local status:
Backend tests and route list verified locally; no long-running server was started.

Repository:
`C:\Users\abbas\Desktop\work\checkupino\nebula`

Strongest subsystem:
Auth/role boundary plus high-authority admin user audit/step-up.

Strongest complete workflow:
Questionnaire public submission to scored result and guest lead capture.

Biggest technical weakness:
Booking/payment lifecycle correctness.

Biggest product weakness:
No end-to-end medical result/report workflow.

Most urgent security concern:
Race-prone booking and unverified paid status transitions.

Next milestone:
Complete one secure booking-to-result-review medical vertical slice.

What it truthfully proves on a resume:
Ability to build a serious Laravel healthcare-platform foundation with auth, roles, booking, questionnaires, Docker, tests, and a React admin migration, while recognizing production gaps.

## Evidence Appendix

| Claim | File path(s) | Relevant class/function/route/test | Confidence |
|---|---|---|---|
| Laravel/Sanctum/Spatie stack | `composer.json`, `composer.lock` | direct package versions | High |
| Roles include root-admin/admin/doctor/patient | `app/Enums/UserRole.php`, `RolesSeeder.php` | `UserRole`, `Role::firstOrCreate` | High |
| Session SPA auth exists | `frontend/src/helpers/session_api.ts`, `AuthenticatedSessionController.php` | `getCsrfCookie`, `loginWithSession`, `store` | High |
| Bearer token API exists | `AuthController.php`, `AuthTokenTest.php` | `login`, `refresh`, `logout` | High |
| Admin user audit/step-up implemented | `AuditLogger.php`, `AuditEvent.php`, `EnsureRecentPasswordConfirmation.php`, tests | admin user create/update | High |
| Booking creates reservation/payment | `BookingApiController.php`, `BookingController.php` | `storeReservation`, `store` | High |
| Booking conflict is app-level only | `SchedulingService.php`, reservation migration | `hasConflict`, no DB exclusion | High |
| Pivot exists but booking ignores it | `2026_02_22...checkup_doctor`, `BookingApiController.php` | `checkup_doctor`, specialty/category comparison | High |
| Payment is scaffolded | `Payment.php`, payments migration, routes search | no callback/webhook route | High |
| Questionnaire scoring/lead capture works | `PublicQuestionnaireController.php`, questionnaire migrations, `Lead.php` | `submit`, `Lead::updateOrCreate` | High |
| File workflow is schema-only | `ReservationFile.php`, migration, route search | no upload/download controller | High |
| React admin is shell/template | `frontend/src/panel/*`, `frontend/src/devtools/*`, `fakebackend_helper.ts` | protected product routes + toolbox | High |
| Production Docker is skeleton | `docker-compose.prod.yml`, `docker/prod/Dockerfile`, docs | app/nginx/db/redis/workers | High |
| Tests pass but coverage narrow | `tests/Feature/Api/*`, `php artisan test` | 42 tests / 136 assertions | High |
| TypeScript check fails | `frontend/src/pages/Authentication/ForgetPassword.tsx` | missing `./reducer` import | High |
