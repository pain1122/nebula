# Project Map - Checkupino (Nebula)

Snapshot date: 2026-06-14

## Fast Context For Agents

Always remember:
- Laravel 12 + Docker.
- Blade is still active runtime.
- React admin is target but not canonical yet.
- `frontend/` is a parked Velzon Vite workspace with working Sanctum session auth.
- Spatie roles are the only authority source.
- `users.role` does not exist anymore.
- Current runtime roles: admin, doctor, patient.
- Booking domain still needs pivot eligibility, generated-slot enforcement, and shared service consolidation.
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
- Current `frontend/` folder is a Vite-powered Velzon React-TS admin shell with working Sanctum session auth, but route ownership and demo-toolbox isolation are not complete yet.

Core implemented domains:
- Auth + roles: Breeze + Sanctum + Spatie Permission.
- First-party browser SPA auth: Sanctum session/cookie flow is wired in `frontend/`.
- Role authority: Spatie only. `users.role` has been removed from the active schema.
- Patient/lead model: unknown public submitters become `leads`; registered patients are users with the `patient` Spatie role.
- Booking: checkups, doctors, reservations, payments, and the `checkup_doctor` pivot foundation.
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
- `specialties`
- `doctor_profiles`
- `checkup_categories`
- `checkups`
- `checkup_doctor`
- `reservations`
- `reservation_notes`
- `reservation_files`
- `payments`

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

As of 2026-06-14:
- `php artisan test` passes with 25 tests and 61 assertions.
- `tests/TestCase.php` disables Vite and seeds core roles during feature tests.
- Production route list excludes `/debug/res-last`.
- Roles table contains `admin`, `doctor`, and `patient`.
- Migrated `users` schema has no `role` column.
- `/healthz` exists for container health checks.
- Backend Sanctum session-cookie smoke test passed: `/sanctum/csrf-cookie` -> JSON `POST /login` -> `/api/auth/me`.
- Frontend Vite migration is pushed as `6267c1b chore: migrate frontend template to vite`.
- `cd frontend && npm run build` succeeds.
- `cd frontend && npm start` runs Vite on `localhost:3000`; template renders and redirects to `/login`.
- Active frontend env migration is verified and committed.
- Frontend session-auth flow is browser-tested: login, dashboard refresh, profile dropdown, `/profile`, logout, and logged-out dashboard redirect.
- Auth-specific Firebase/JWT/fake backend files have been removed from the frontend runtime.
- Known frontend warnings: large chunks from full Velzon demo inventory; stale Browserslist/baseline data; Tailwind content warning is not an admin blocker yet.

## 10) Immediate Next Work

1. Finish Phase 3 documentation/commit:
- Commit the session-auth cleanup, auth helper removals, CORS config, i18n/theme updates, and docs together if the working tree scope is accepted.
- Do not include generated `frontend/dist` output unless deliberately changing deployment strategy.

2. Start Phase 3.5 root-admin/developer toolbox:
- Add `root_admin` to role taxonomy and seeders.
- Decide whether root-admin receives admin role too or is treated as admin-equivalent in policies.
- Split product admin routes from Velzon utility/demo routes.
- Lazy-load root-admin demo/toolbox pages so normal admin does not pay the bundle cost.

3. Keep fake/demo data boundary explicit:
- `fakebackend_helper.ts` still supports Velzon demo data slices.
- Do not treat demo helpers as product API infrastructure.
- Move them behind root-admin/devtool boundaries before trimming the full Velzon inventory.

## 11) Current Open Risks

1. Booking eligibility source:
- `checkup_doctor` exists, but runtime booking still needs to enforce it consistently.

2. Slot validity:
- Reservation creation checks conflicts, but must also prove the requested slot came from generated availability.

3. Domain duplication:
- Web and API booking controllers still need shared booking decision logic.

4. Reservation/payment lifecycle:
- Payment callbacks and deterministic status transitions are not finished.

5. API response contracts:
- API envelope consistency still needs tests and cleanup, especially questionnaire public responses.

6. Frontend boundary:
- React admin/client boundaries, route ownership, root-admin utilities, and CSS separation are planned but not complete.
- The active browser auth path is session-cookie based, but mobile/external bearer-token policy still needs hardening.

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
