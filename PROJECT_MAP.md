# Project Map - Checkupino (Nebula)

Snapshot date: 2026-06-07

## 1) Project Reality

Checkupino is currently a Laravel 12 medical platform with a stable backend foundation and a frontend transition in progress.

Current primary runtime:
- Blade + Laravel Vite for server-rendered web pages.
- Sanctum API routes for auth, booking, profiles, admin, doctor, and questionnaires.
- Docker local environment with Nginx, PHP-FPM, MySQL, and Redis.

Target UI direction:
- Admin web app: React + Bootstrap under `/panel/*`.
- Client/public web app: React + Tailwind.
- Current `frontend/` folder is a parked Vite-powered Velzon React-TS template, not the canonical production UI yet.

Core implemented domains:
- Auth + roles: Breeze + Sanctum + Spatie Permission.
- Role authority: Spatie only. `users.role` has been removed from the active schema.
- Patient/lead model: unknown public submitters become `leads`; registered patients are users with the `patient` Spatie role.
- Booking: checkups, doctors, reservations, payments, and the `checkup_doctor` pivot foundation.
- Admin CRUD: specialties, checkup categories, checkups, users, reservations, questionnaires.
- Doctor profile/services.
- Medical user profile via `user_profiles`.
- Questionnaire API + public submission + lead capture.

## 2) High-Signal Paths (Load First)

- `CODEX_RULES.md`
- `TODO.md`
- `README.md`
- `PROJECT_MAP.md`
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
- It is Bootstrap/template-heavy and still contains default template API/auth assumptions.
- Local Laravel backend is `http://localhost:8080`; API routes live under `http://localhost:8080/api`.
- Vite config currently has a temporary compatibility bridge for CRA-style `process.env.REACT_APP_*` and `process.env.PUBLIC_URL`.
- Phase 2.5 Step 4 remains open: convert active frontend env usage to `import.meta.env.VITE_*`.
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

As of 2026-06-07:
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
- Known frontend warnings: large chunks from full Velzon demo inventory; stale Browserslist/baseline data; Tailwind content warning is not an admin blocker yet.

## 10) Immediate Next Work

1. Finish frontend env cleanup or consciously carry the bridge:
- Replace active `process.env.REACT_APP_*` with `import.meta.env.VITE_*`.
- Replace active `process.env.PUBLIC_URL` with `import.meta.env.BASE_URL` or a small helper.
- Remove the temporary `define` bridge from `frontend/vite.config.ts` only after the search is clean.

2. Wire Phase 3 frontend auth:
- Create/use an Axios client with `withCredentials: true` and `Accept: application/json`.
- Browser login flow should call `/sanctum/csrf-cookie`, JSON `POST /login`, then `/api/auth/me`.
- Logout should call JSON `POST /logout`.
- Protected routes should trust `/api/auth/me`, not `sessionStorage` or bearer tokens.
- Keep `/api/auth/login` bearer-token flow for mobile/external clients only.

3. Keep fake/demo cleanup separate:
- `fakeBackend()` still exists and many template pages depend on demo data.
- Do not remove fake backend, demo routes, or menus in the same commit as session auth unless the scope is explicit.

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
- React admin/client boundaries, route ownership, CSS separation, and cookie/session auth are planned but not complete.

## 12) Recommended Scan Order (Future Sessions)

1. Read `CODEX_RULES.md`, `TODO.md`, `README.md`, and this `PROJECT_MAP.md`.
2. Read ADR/boundary docs under `docs/`.
3. Read route files in `routes/`.
4. Read controllers directly referenced by the target routes.
5. Read related models, policies, services, migrations, and seeders.
6. Read tests relevant to the target behavior.
7. Open `resources/views` or `frontend/src` only when the task is UI-specific.
8. Avoid `frontend/public/assets`, `vendor`, and `node_modules` unless explicitly needed.
