# Project Map - Checkupino (Nebula)

Snapshot date: 2026-08-03

## Fast Context For Agents

Always remember:
- Laravel 12 + Docker.
- Blade is still active runtime.
- React admin is target but not canonical yet.
- `frontend/` is a parked Velzon Vite workspace with working Sanctum session auth.
- Spatie roles are the only authority source.
- `users.role` does not exist anymore.
- Current runtime roles: `root-admin`, `admin`, `doctor`, and `patient`.
- Booking uses workplace-scoped service eligibility, generated future slots, locked conflict rechecks, throttled active-hold caps, and scheduled/synchronous hold expiry; history-preserving rescheduling remains Phase 1E.
- Phase 1C backend primitives are verified complete. Phase 1D is closed as a contract-only extension gate; Phase 1E and Phase 2 remain open.
- Do not load `frontend/public/assets`, `vendor`, or `node_modules`.

## 1) Project Reality

Checkupino is currently a Laravel 12 medical platform with a stable backend foundation and a frontend transition in progress.

Current primary runtime:
- Blade + Laravel Vite for server-rendered web pages.
- Sanctum API routes for auth, booking, profiles, admin, doctor, and questionnaires.
- Docker local environment with Nginx, PHP-FPM, MySQL, and Redis.

Target UI direction:
- Admin web app: React + Bootstrap under `/panel/*`.
- Client/public web app: React + Tailwind.
- Current `frontend/` folder is a Vite-powered Velzon React-TS admin shell with working Sanctum session auth and root-admin developer routes isolated under `/panel/dev/*`; it is not yet the canonical production admin.

Core implemented domains:
- Auth + roles: Breeze + Sanctum + Spatie Permission.
- First-party browser SPA auth: Sanctum session/cookie flow is wired in `frontend/`.
- Role authority: Spatie only. `users.role` has been removed from the active schema.
- Patient/lead model: unknown public submitters become `leads`; registered patients are users with the `patient` Spatie role.
- Booking/payment: marketplace hospitals, doctor workplaces, workplace-scoped services/windows, reservations, schedule history, one payment summary with repeated attempts, verified callback decisions, adjustments, canonical-success locking, reconciliation, and expiring holds.
- Platform foundation: typed scoped settings, signed entitlements, audited marketplace tenant controls, signed sanitized heartbeats, provider-neutral integrations, recoverable outbox dispatch, monitoring-only tenant instances, and a separate minimal tenant schema/profile/authority/entitlement foundation.
- Storage/API foundation: separated public media and private quarantined reservation files, explicit API resources/form requests, version/correlation metadata, capped pagination, and PII-safe representative contracts.
- Admin CRUD: specialties, checkup categories, checkups, users, reservations, questionnaires.
- Doctor profile/services.
- Medical user profile via `user_profiles`.
- Questionnaire API + public submission + lead capture.

## 2) High-Signal Paths (Load First)

- `AI_BOOT.md`
- `CODEX_RULES.md`
- `CURRENT_TASK.md`
- `docs/ai-context/modules/*.md` for the active domain only
- `docs/TODO.md`
- `README.md`
- `docs/PROJECT_MAP.md`
- `docs/adr/ADR-0001-ui-auth-role-architecture.md`
- `docs/architecture/boundaries.md`
- `docs/architecture/phase-1d-future-feature-extension-contract.md` when later content, commerce, mobile, tenant-site, report/file, or notification boundaries are relevant
- `docs/deployment/docker-production.md`
- `routes/web.php`
- `routes/api.php`
- `routes/admin.php`
- `routes/doctor.php`
- `app/Enums/UserRole.php`
- `app/Http/Controllers/`
- `app/Models/`
- `app/Policies/`
- `app/Services/SchedulingService.php`
- `database/migrations/`
- `database/seeders/`
- `tests/TestCase.php`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `docker/prod/Dockerfile`

## 3) Low-Signal / Heavy Paths (Skip by Default)

These are the main context-window sinks:
- `frontend/public/assets/` and other vendored template assets.
- `frontend/src/pages/` when not working on the frontend rebuild.
- `vendor/`.
- `node_modules/`.
- Generated caches/builds such as `public/build` and `storage/framework/*`.

Unless debugging static assets or template migration issues, avoid loading these first.

## 4) Route Surface

Web routes using session auth:
- Public root: `/`.
- User dashboard/profile: `/dashboard`, `/profile`.
- Booking pages: `/book*`, `/my/reservations`.
- Admin Blade panel: `/admin/*` with `auth`, `verified`, and enum-backed admin role middleware.
- Doctor Blade panel: `/doctor/*` with `auth`, `verified`, and enum-backed doctor role middleware.
- Local debug: `/debug/res-last`, registered only in local env.

API routes using Sanctum:
- `/api/auth/*` for register, doctor register, login, refresh, logout, profile, and me.
- `/api/tenant-heartbeats/{tenantInstance}` for signed, throttled, sanitized monitoring input.
- `/api/checkups*`, `/api/reservations*`, `/api/my/reservations`.
- `/api/doctor/*` for doctor profile and reservation workflows.
- `/api/admin/*` for users, doctor verification, reservations, questionnaires/submissions, tenant registry/feature controls, and scoped marketplace settings.
- Public questionnaire endpoints: `/api/questionnaires*`.

Role middleware strategy:
- Role names come from `App\Enums\UserRole`.
- API role checks specify the `sanctum` guard.
- Spatie roles are seeded as `root-admin`, `admin`, `doctor`, and `patient`.

## 5) Data Model Clusters

Identity and auth:
- `users`
- `user_profiles`
- `leads`
- Spatie permission tables
- `personal_access_tokens`

User classification:
- `leads`: anonymous/free-form public captures and unconverted prospects.
- `users` + `patient` role: authenticated patient accounts.
- `users.patient_status`: nullable patient lifecycle/capability flag.
- No active `users.role` column.

Medical booking:
- `marketplace_hospitals`
- `hospital_listing_requests`
- `specialties`
- `doctor_profiles`
- `doctor_specialty`
- `doctor_workplaces`
- `doctor_workplace_checkup`
- `doctor_working_windows`
- `checkup_categories`
- `checkups`
- `reservations`
- `reservation_schedule_changes`
- `reservation_notes`
- `reservation_files`
- `reservation_payment_summaries`
- `payment_attempts`
- `payment_provider_events`
- `payment_adjustments`

Shared platform primitives:
- `audit_events`
- `setting_definitions`
- `setting_values`
- `features`
- `outbox_events`
- `tenant_instances`
- `tenant_feature_overrides`
- `tenant_health_snapshots`

Isolated tenant foundation:
- Six migrations under `database/migrations/tenant/` create one local hospital profile, local identities/roles/sessions, settings/entitlements, audit, and outbox without marketplace operational tables.

Questionnaires:
- `questionnaires`
- `questionnaire_questions`
- `questionnaire_choices`
- `questionnaire_recommendations`
- `questionnaire_submissions`
- `leads` linked to questionnaire submissions when submitters are not registered users

## 6) Local Runtime Topology

Defined in `docker-compose.yml`:
- `app`: PHP-FPM, code mounted at `/var/www`.
- `nginx`: host `8080` -> container `80`.
- `db`: MySQL host `3307` -> container `3306`.
- `redis`: host `6380` -> container `6379`.

Important env defaults for Docker-run Laravel:
- `APP_URL=http://localhost:8080`
- `DB_HOST=db`
- `DB_PORT=3306`
- `REDIS_HOST=redis`

Important host-side caveat:
- `db` is a Docker network hostname.
- If running PHP directly on Windows, use `127.0.0.1:3307` for MySQL instead.

## 7) Frontend State

Root frontend:
- Active for Blade pages.
- Uses Laravel Vite from root `package.json`.
- Root build output is Laravel's normal `public/build`.

`frontend/` workspace:
- Current source is Velzon React-TS migrated from Create React App to Vite.
- Scripts are Vite-backed: `npm start`/`npm run dev` for dev, `npm run build` for production build.
- Dev server runs at `http://localhost:3000`.
- It is Bootstrap/template-heavy.
- Active browser auth uses Sanctum session cookies through `frontend/src/helpers/session_api.ts`.
- Login calls `/sanctum/csrf-cookie`, JSON `POST /login`, then `/api/auth/me`.
- Logout calls JSON `POST /logout`.
- Header/profile display uses the current session user from `/api/auth/me`.
- Browser admin auth no longer stores bearer tokens in browser storage.
- Firebase auth helpers, fake JWT auth backend, and JWT token-access helpers have been removed.
- `frontend/src/helpers/api_helper.ts` no longer attaches global bearer headers.
- `frontend/src/helpers/fakebackend_helper.ts` remains for Velzon demo data slices only and should be isolated behind the root-admin/developer toolbox split.
- Local Laravel backend is `http://localhost:8080`; API routes live under `http://localhost:8080/api`.
- Frontend env declarations use Vite keys: `VITE_BACKEND_URL`, `VITE_API_BASE_URL`, and temporary `VITE_DEFAULT_AUTH`.
- Active frontend env reads use `import.meta.env`; the old CRA `process.env.REACT_APP_*` compatibility bridge has been removed.
- Remaining old CRA env mentions are commented Firebase template notes only.
- Do not use this folder as the source of architectural truth until Phase 3/4 work reconnects it intentionally.

## 8) Production Docker Skeleton

Production packaging exists as an early skeleton, not a final deployment guarantee.

Key files:
- `docker-compose.prod.yml`
- `docker/prod/Dockerfile`
- `docker/prod/app/entrypoint.sh`
- `docker/prod/nginx/default.conf`
- `.env.production.example`
- `docs/deployment/docker-production.md`

Target shape:
- immutable app image with Laravel code, Composer dependencies, and built root Vite assets
- separate Nginx image serving copied `public/` assets
- named storage, MySQL, and Redis volumes
- no whole-project bind mount
- optional queue/scheduler services under the `workers` profile

The parked `frontend/` Vite-powered Velzon React-TS template is excluded from the production build context until it becomes a canonical built frontend surface.

## 9) Current Verification Snapshot

As of 2026-08-03:
- The final Phase 1C checkout passes SQLite 186 tests/950 assertions with one expected MySQL-only skip and disposable MySQL 187 tests/961 assertions, including production outbox integration and concurrent payment success.
- Marketplace and isolated tenant paths pass fresh migration, repeat seed, rollback, reapply, and reseed. Verified disposable schemas contain 50 marketplace tables and 22 isolated tenant tables.
- Entitlement, monitoring, settings, file, audit/step-up, API-resource, outbox, payment, hold-expiration, and MySQL-locking regressions pass.
- Tenant isolation retains one local installation/profile/user/role/entitlement and excludes inspected marketplace, booking, payment, questionnaire, and medical-file tables.
- Touched PHP files pass Pint; route loading passes with 104 non-vendor routes.
- Detailed evidence: `docs/audits/phase-1c-verification-gate-2026-08-03.md`.
- Phase 1D's six future-domain baselines are reconciled in `docs/architecture/phase-1d-future-feature-extension-contract.md`; it intentionally adds no speculative runtime code or schema.
- The code-level Phase 1C learning reference is `docs/reports/phase-1c-code-learning-report-2026-08-03.md`.

## 10) Immediate Next Work

1. Blueprint and implement the bounded Phase 1E item 16 booking-correctness slice in `CURRENT_TASK.md` without reopening completed Phase 1C primitives.
2. Then address Phase 1E payment/reservation completion, questionnaire anti-automation/content safety, the minimum medical report workflow, and remaining high-authority paths in roadmap order.
3. Start Phase 2 reusable Vite admin work only after the remaining Phase 1 gate is intentionally closed.

## 11) Current Open Risks

1. Booking lifecycle: history-preserving rescheduling and concurrent overlap acceptance remain Phase 1E work.
2. Payment lifecycle: no provider SDK/HTTP webhook adapter, executed refund/void integration, appointment-completion workflow, or rating trigger exists; Phase 1C provides the provider-neutral and state-safety foundations only.
3. Medical files/reports: private upload/download/quarantine primitives exist, but the doctor-request/patient-upload/review/report workflow does not.
4. Questionnaire product safety: throttling plus CAPTCHA/anti-automation and stored-HTML policy remain open.
5. Future bulk/high-authority endpoints must adopt the completed policy/step-up/reason/fail-closed-audit pattern when introduced.
6. Frontend boundary: the React workspace remains a parked template until the remaining Phase 1 gate and Phase 2 type/build/API/core portability gates.

## 12) Recommended Scan Order (Future Sessions)

### Normal task sessions

1. Read `AI_BOOT.md`.
2. Read `CODEX_RULES.md`.
3. Read `CURRENT_TASK.md`.
4. Read only the relevant `docs/ai-context/modules/*.md` file if the task maps to a domain.
5. Read only the files directly named by the current task or module.
6. Read routes/controllers/models/policies/services only when the task requires them.
7. Read tests relevant to the behavior being changed.
8. Do not read full `README.md`, `docs/TODO.md`, `docs/PROJECT_MAP.md`, ADRs, or architecture docs unless the session is explicitly planning/architecture review.

### Planning or architecture review sessions

1. Read `AI_BOOT.md`.
2. Read `CODEX_RULES.md`.
3. Read `docs/PROJECT_MAP.md`.
4. Read `docs/TODO.md`.
5. Read relevant ADR/boundary docs.
6. Then create/update `CURRENT_TASK.md`; keep the ordered roadmap in `docs/TODO.md`.

### Avoid by default

- `frontend/public/assets/`
- `vendor/`
- `node_modules/`
- generated caches/builds
- broad `frontend/src/pages/` scans unless working on frontend route/toolbox isolation
