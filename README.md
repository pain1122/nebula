# Checkupino (Nebula)

Laravel 12 medical checkup and consultation platform.

Current primary runtime:
- Laravel Blade web UI with root Vite assets.
- Sanctum-backed API for auth, booking, admin, doctor, profile, and questionnaire flows.
- Docker local stack with Nginx, PHP-FPM, MySQL, and Redis.

Active frontend workspace:
- `frontend/` contains the Velzon React-TS/Vite admin with a real API-backed `/panel/users` directory and paired English/Farsi labels.
- It is not the canonical production admin/client surface yet.
- It has working Sanctum session-cookie admin auth, canonical `/panel` product routes, manifest-driven product navigation, and lazy root-admin toolbox routes under `/panel/dev/*`. F28's inert root-system extension slot is complete without a dead route; full asset isolation, deployment, CI, and portability remain Phase 2 work.

## Current Scope

Implemented backend/domain foundations:
- Authentication: Laravel Breeze web auth plus Sanctum session-cookie and expiring/refreshable bearer-token APIs.
- Roles/permissions: Spatie Permission with `root-admin`, `admin`, `doctor`, and `patient` roles.
- Role source of truth: Spatie role tables only. The legacy `users.role` column has been migrated out.
- User classification: public/free-form captures live in `leads`; authenticated users with the patient role are patients.
- Patient lifecycle flag: nullable `users.patient_status` for values such as `free`, `trial`, `active`, `expired`, and `suspended`.
- Booking domain: marketplace hospitals, doctor workplaces/services, recurring working rules and breaks, persistent public-ID visit slots, reservations, schedule history, holds, payment summaries/attempts/adjustments, and lifecycle services.
- Service eligibility: active `doctor_workplace_checkup` records; the old global `checkup_doctor` pivot is not part of the active schema.
- Admin surfaces/APIs: specialties, categories/checkups, users/account state, doctor verification, reservations, questionnaires/submissions, marketplace tenant controls/settings, and payment-adjustment requests.
- Doctor Blade panel: dashboard, profile edit, service selection.
- Medical profile API: `user_profiles` table plus `/api/auth/profile` endpoints.
- Questionnaire domain: sanitized/versioned definitions, server-owned answer validation/scoring/recommendations, throttled public submission, admin submissions, and lead creation for unknown submitters.
- Medical workflow: doctor request/review, patient private quarantined upload, internal scan status, immutable report publication/amendment, and authorized patient outcome/file reads.
- Platform foundation: audit/step-up, outbox, typed settings/features, marketplace tenant registry/health/entitlements, and an isolated minimal tenant schema.

## Stack

- Backend: PHP 8.2+, Laravel 12
- Database: MySQL 8
- Cache/queue infra: Redis 7
- Web server: Nginx + PHP-FPM through Docker
- Root frontend: Blade + Tailwind + Laravel Vite
- Optional frontend workspace: React 18 + TypeScript + Bootstrap + Vite via Velzon template
- Auth packages: Laravel Sanctum, Laravel Breeze, Spatie Laravel Permission

## Repository Layout

- `app/Enums/` role enums and other explicit value sets
- `app/Http/Controllers/` web and API controllers
- `app/Http/Requests/` form request validation
- `app/Models/` Eloquent models
- `app/Policies/` authorization policies
- `app/Services/` shared domain services
- `routes/` web, API, admin, and doctor routes
- `database/migrations/` schema migrations
- `database/seeders/` local roles, users, and domain seed data
- `resources/views/` Blade UI
- `resources/js/` and `resources/css/` root Vite entrypoints
- `frontend/` separate active Velzon React-TS Vite workspace
- `docs/` architecture notes and ADRs
- `docker/` Dockerfiles and Nginx config

## AI/Codex Context

For AI-assisted work, start with the small routing packet instead of loading the full roadmap:

- `AI_BOOT.md`
- `CODEX_RULES.md`
- `CURRENT_TASK.md`
- `docs/ai-context/modules/*.md` only for the active domain

Use `docs/PROJECT_MAP.md` for architecture orientation and `docs/TODO.md` for full roadmap/history.

## Local Installation

This project is designed for Docker-based local development.

For continuing the existing demo on another PC, first use the [Windows transfer readiness checklist](docs/deployment/windows10-transfer-readiness-2026-10-31.md). A clone does not include local images, dependencies, database/files or encryption keys; the fresh-install steps below do not preserve an existing demo database.

### 1) Requirements

- Docker Desktop with Compose v2
- Node.js 20.19+ for the root Vite toolchain
- Node.js 24.19.0 and npm 11.17.0 for `frontend/` development and tests, as required by its package manifest
- Git

### 2) Clone

```bash
git clone https://github.com/pain1122/nebula.git checkupino
cd checkupino
```

### 3) Configure environment

```bash
cp .env.example .env
```

Verify these values in `.env` for Docker-based Laravel commands:

```env
APP_URL=http://localhost:8080

DB_CONNECTION=mysql
DB_HOST=db
DB_PORT=3306
DB_DATABASE=checkupino
DB_USERNAME=checkupino
DB_PASSWORD=checkupino_pass

REDIS_HOST=redis
REDIS_PORT=6379

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=database
```

Important local rule:
- `DB_HOST=db` only resolves inside the Docker network.
- Prefer `docker compose exec app php artisan ...` for Artisan commands.
- If you run host-side PHP directly from Windows, use `DB_HOST=127.0.0.1` and `DB_PORT=3307` for that host process.

### 4) Start containers

```bash
docker compose up -d --build
docker compose ps
```

Expected exposed ports:
- App through Nginx: `http://localhost:8080`
- MySQL host port: `3307` -> container `3306`
- Redis host port: `6380` -> container `6379`

### 5) Install backend dependencies and bootstrap Laravel

```bash
docker compose exec app bash -lc "composer install"
docker compose exec app php artisan key:generate
docker compose exec app php artisan storage:link
docker compose exec app php artisan optimize:clear
```

### 6) Run migrations and seed demo data

```bash
docker compose exec app php artisan migrate --seed
```

Seeded local users:
- `rootadmin@checkupino.test` / `Password123!`
- `admin@checkupino.test` / `Password123!`
- `doctor@checkupino.test` / `Password123!`
- `patient@checkupino.test` / `Password123!`

`Password123!` is the `.env.example` local default for `DEMO_SEED_PASSWORD`. Known-credential users are guarded to local/testing seed execution and must never be treated as production accounts.

Seeded roles:
- `root-admin`
- `admin`
- `doctor`
- `patient`

### 7) Install and run root Vite assets

```bash
npm install
npm run dev
```

If you prefer production assets:

```bash
npm run build
```

If you see `Vite manifest not found at public/build/manifest.json`, run `npm run dev` or `npm run build` from the repository root.

### 8) Access URLs

- App: `http://localhost:8080`
- Login: `http://localhost:8080/login`
- Dashboard: `http://localhost:8080/dashboard`
- Admin Blade panel: `http://localhost:8080/admin` with admin role
- Doctor Blade panel: `http://localhost:8080/doctor` with doctor role
- API base: `http://localhost:8080/api`

Local-only debug route:
- `/debug/res-last` is registered only when `APP_ENV=local`.
- It must not appear in production route lists.

### 9) API quick smoke test

Login and capture a token:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@checkupino.test","password":"Password123!","device_name":"local"}'
```

Then call an authenticated endpoint:

```bash
curl http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 10) Optional: run the React development workspace

Use this only if you are actively exploring or rebuilding the Velzon React admin/client workspace:

```bash
cd frontend
npm install
npm start
# optional production build check
npm run build
```

Current frontend workspace facts:
- It is Vite-powered; the CRA/react-scripts toolchain has been removed.
- It uses Bootstrap-oriented Velzon assets.
- Active login/logout/current-user flow uses Laravel Sanctum session cookies through `frontend/src/helpers/session_api.ts`.
- Browser admin auth does not store bearer tokens in `localStorage` or `sessionStorage`.
- Firebase auth helpers, fake JWT auth backend, and JWT token-access helpers have been removed.
- `frontend/src/helpers/fakebackend_helper.ts` remains for Velzon demo data slices routed through the root-admin developer toolbox; Phase 2 must prove the complete import graph before deletion or stronger quarantine.
- Vite dev server runs at `http://localhost:3000`.
- Laravel backend target for future local integration is `http://localhost:8080`; Laravel API routes are under `http://localhost:8080/api`.
- Active frontend env declarations use Vite keys `VITE_BACKEND_URL` and `VITE_API_BASE_URL`; no active fake-auth environment switch remains.
- Active frontend env reads use `import.meta.env`; the old CRA `process.env.REACT_APP_*` compatibility bridge has been removed.
- `frontend/` now has an implemented standalone Nginx admin image and `/panel/*` history-fallback contract. The build rejects the reserved example API origin instead of emitting an unusable artifact. F29 remains open for the user-run rebuilt-image/deployed-origin smoke and deferred F27I disposition; full asset isolation, CI, and portability remain approval-gated. F28 navigation is complete.

## Production Docker Skeleton

The repository includes an early production packaging path:

- `docker-compose.prod.yml`
- `docker/prod/Dockerfile`
- `docker/prod/app/entrypoint.sh`
- `docker/prod/nginx/default.conf`
- `frontend/Dockerfile`
- `frontend/nginx/default.conf`
- `frontend/.env.production.example`
- `.env.production.example`
- `docs/deployment/docker-production.md`

Goal:

```bash
cp .env.production.example .env.production
# edit secrets, APP_KEY, URLs, and passwords
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

This is a skeleton, not the final production release process.

Important differences from local Docker:
- No whole-project bind mount.
- Laravel code, Composer dependencies, and root Vite assets are baked into images.
- MySQL, Redis, and Laravel storage use named volumes.
- The React admin builds into its own Nginx image, serves only `/panel/*`, and calls the separate Laravel origin through the existing API/Sanctum client.
- Queue and scheduler containers are available through the optional `workers` profile.

Health endpoint:
- `/healthz` returns a simple JSON status and is used by the Nginx health check.

Read the full contract before using it for staging:
- `docs/deployment/docker-production.md`

## Useful Commands

```bash
# app shell
docker compose exec app bash

# routes
docker compose exec app php artisan route:list --except-vendor

# production route sanity check
docker compose exec app php artisan route:list --except-vendor --env=production

# tests
docker compose exec app php artisan test

# production image skeleton
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# production skeleton with queue/scheduler profile
docker compose --env-file .env.production -f docker-compose.prod.yml --profile workers up -d

# role/schema check
docker compose exec db mysql -ucheckupino -pcheckupino_pass checkupino -e "SELECT id, name, guard_name FROM roles ORDER BY name; SHOW COLUMNS FROM users LIKE 'role';"

# stop containers
docker compose down

# full reset, including DB volume
docker compose down -v
```

## Troubleshooting

- `php_network_getaddresses: getaddrinfo for db failed` from host PHP:
  - You ran Artisan on the host while `.env` points to Docker-only `DB_HOST=db`.
  - Run `docker compose exec app php artisan ...`, or temporarily use host DB settings: `DB_HOST=127.0.0.1`, `DB_PORT=3307`.

- `Please provide a valid cache path`:
  ```bash
  docker compose exec app bash -lc "mkdir -p storage/framework/{cache,sessions,views} bootstrap/cache"
  ```

- Database not ready yet:
  ```bash
  docker compose logs -f db
  ```
  Then rerun migration command when MySQL is healthy.

- Port conflicts on `8080`, `3307`, or `6380`:
  - Stop conflicting local services or change host ports in `docker-compose.yml`.

- Missing Vite manifest:
  - Run `npm run dev` or `npm run build` from the repository root, not from `frontend/`.

## Current Verification Snapshot

As of 2026-08-16:
- Phase 1A-1E is complete and documented.
- Full SQLite baseline: 304 tests, 1,796 assertions, with three intentional MySQL-only concurrency skips.
- User-confirmed disposable-MySQL baseline: 307 tests, 1,816 assertions.
- Current route discovery: 121 non-vendor routes, including 68 API routes.
- Composer audit: no advisories or abandoned packages.
- Agreed touched-file Pint scopes and `git diff --check` pass.
- Runtime roles are `root-admin`, `admin`, `doctor`, and `patient`; `users.role` and the former shared temporary-admin-password path are absent.
- Marketplace and isolated minimal-tenant migration/seed/rollback/reapply gates pass; deterministic MySQL booking/payment lock tests pass.
- Detailed evidence: `docs/audits/phase-1-verification-gate-2026-08-16.md`.

Frontend checkpoint reconciled 2026-09-11: F27A-F27H are complete with user-confirmed chart, landing, toolbox-style, typography, icon, and console checks. Retained demo styles load through the lazy root-only toolbox entry. Active font declarations ship WOFF2 only, reducing emitted fonts from 34 files/8,375,625 bytes to 11/1,135,684; only `en` and `fa` enter the locale graph. Current quality passes 42 files/196 tests; the 7.30-second build keeps toolbox CSS out of initial HTML and reduces initial CSS to 1,002,953/158,135 gzip. The unchanged lock retains zero production audit findings. See `CURRENT_TASK.md` and `frontend/README.md` for feature evidence and remaining gates.

The first combined live matrix exposed `/panel/dev/apps-chat` reaching the obsolete Themesbrand API and crashing on failed message data. It now uses direct cloned local fixtures and local demo mutations; its built route closure excludes the fake helper/external thunk barrel, and the separate Reactstrap timeout warning is fixed. Automated regression/artifact checks and the user-confirmed live repair pass.

## Known Gaps

The active gaps begin in Phase 2 and later roadmap phases:
- Preserve the passing local frontend quality/build gates; approve and implement CI only through F32A/F32.
- Verify F29 deployed static-host history fallback for the approved `/panel/*` routing and separate admin origin while preserving the active Blade runtime.
- Prove the implemented internal core/module and typed API/auth/query/form/navigation contracts through the later minimal-manifest portability gate.
- F27I page/image allowlisting and quarantine resume on 2026-09-21 after the demo. F28 navigation is complete; F29 remains a separate deployment-topology decision.
- Prove portability through a minimal module manifest and documented extraction/configuration contract.
- Payment-provider execution, product notifications, rating submission, medical UI/scanner integration, content/commerce/mobile, and complete tenant products remain their explicitly later phases.
