# Project Map - Checkupino (Nebula)

Snapshot date: 2026-07-19

## Fast Context For Agents

Always remember:
- Laravel 12 + Docker.
- Blade is still active runtime.
- React admin is target but not canonical yet.
- `frontend/` is a parked Velzon Vite workspace with working Sanctum session auth.
- Spatie roles are the only authority source.
- `users.role` does not exist anymore.
- Current runtime roles: `root-admin`, `admin`, `doctor`, and `patient`.
- Booking uses workplace-scoped service eligibility, generated future slots, shared services, and locked conflict rechecks; duration, rescheduling, and hold-expiration work remains.
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
- Booking: marketplace hospitals, doctor workplaces, workplace-scoped services/windows, reservations, schedule history, payment summaries, and provider attempts.
- Platform foundation: settings/features, audit/outbox, monitoring-only tenant instances, and a separate minimal tenant schema/profile/authority/entitlement foundation.
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
- `/api/checkups*`, `/api/reservations*`, `/api/my/reservations`.
- `/api/doctor/*` for doctor profile and reservation workflows.
- `/api/admin/*` for users, doctor verification, reservations, questionnaires, and submissions.
- Public questionnaire endpoints: `/api/questionnaires*`.

Role middleware strategy:
- Role names come from `App\Enums\UserRole`.
- API role checks specify the `sanctum` guard.
- Spatie roles are seeded as `admin`, `doctor`, and `patient`.

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

As of 2026-07-19:
- Full backend suite passes on SQLite and disposable MySQL: 121 tests, 640 assertions.
- Marketplace 24-migration and isolated tenant 6-migration paths pass fresh apply, rollback, reapply, and repeat seeding.
- MySQL unique indexes, historical-record foreign-key rules, and marketplace/tenant table separation are inspected and verified.
- Security regressions cover root-admin-only admin identity management, reservation IDOR/ownership injection, response privacy, account/token/session revocation, audit redaction, and Sanctum CSRF/CORS behavior.
- Touched PHP files pass Pint; repository-wide Pint still reports 65 pre-existing style issues.
- Route loading passes with 99 non-vendor routes.
- Detailed evidence: `docs/audits/foundation-verification-gate-2026-07-19.md`.

## 10) Immediate Next Work

1. Finish Phase 1 booking correctness: allowed/default duration, audited conflict-checked rescheduling, pending-hold expiration/release, and concurrency coverage.
2. Finish payment callbacks/overrides, questionnaire anti-automation/content safety, private medical file/report workflows, and remaining high-authority audit/step-up policies.
3. Complete runtime behavior for settings/media/API/integration primitives beyond the verified foundation schemas and contracts.
4. Start Phase 2 reusable Vite admin work only after the remaining Phase 1 gate is intentionally closed.

## 11) Current Open Risks

1. Booking lifecycle: rescheduling, allowed duration, explicit pending-hold expiration/release, and concurrent overlap acceptance remain unfinished.
2. Payment lifecycle: provider callbacks, deterministic transition service, refunds/voids, and audited overrides remain unfinished.
3. Medical files/reports: schema and retention metadata exist, but authorized upload/download/review/report workflows do not.
4. Shared primitives: settings, media, API, notification/integration, and outbox schemas/contracts need complete runtime services and policies.
5. High authority: doctor verification, catalog pricing/update, questionnaire administration, reservation/payment overrides, and future bulk actions need complete policy/step-up/audit coverage.
6. Frontend boundary: the React workspace remains a parked template until the Phase 2 type/build/API/core portability gate.

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
