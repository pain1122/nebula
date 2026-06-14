# Checkupino (Nebula)

Laravel 12 medical checkup and consultation platform.

Current primary runtime:
- Laravel Blade web UI with root Vite assets.
- Sanctum-backed API for auth, booking, admin, doctor, profile, and questionnaire flows.
- Docker local stack with Nginx, PHP-FPM, MySQL, and Redis.

Parked frontend workspace:
- `frontend/` currently contains a Velzon React-TS template migrated from Create React App to Vite.
- It is not the canonical production admin/client surface yet.
- Treat it as a future rebuild workspace until the `/panel/*` SPA boundary and auth flow are wired intentionally.

## Current Scope

Implemented backend/domain foundations:
- Authentication: Laravel Breeze web auth plus Sanctum API token auth.
- Roles/permissions: Spatie Permission with `admin`, `doctor`, and `patient` roles.
- Role source of truth: Spatie role tables only. The legacy `users.role` column has been migrated out.
- User classification: public/free-form captures live in `leads`; authenticated users with the patient role are patients.
- Patient lifecycle flag: nullable `users.patient_status` for values such as `free`, `trial`, `active`, `expired`, and `suspended`.
- Booking domain: checkup categories, checkups, doctor profiles, reservations, payments, and the `checkup_doctor` eligibility pivot.
- Admin Blade panel: specialties, checkup categories, checkups.
- Doctor Blade panel: dashboard, profile edit, service selection.
- Medical profile API: `user_profiles` table plus `/api/auth/profile` endpoints.
- Questionnaire domain: questionnaire CRUD, public submission, admin submissions, and lead creation for unknown submitters.

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
- `frontend/` separate parked Velzon React-TS Vite workspace
- `docs/` architecture notes and ADRs
- `docker/` Dockerfiles and Nginx config

## Local Installation

This project is designed for Docker-based local development.

### 1) Requirements

- Docker Desktop with Compose v2
- Node.js 20.19+ for the root Vite toolchain
- Git

### 2) Clone

```bash
git clone https://github.com/pain1122/checkupino.git
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
- `admin@checkupino.test` / `Password123!`
- `doctor@checkupino.test` / `Password123!`
- `patient@checkupino.test` / `Password123!`

Seeded roles:
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

### 10) Optional: run the parked React workspace

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
- It uses Bootstrap-oriented Velzon assets and template auth assumptions.
- It may still reference demo/default API configuration until adapted.
- Vite dev server runs at `http://localhost:3000`.
- Laravel backend target for future local integration is `http://localhost:8080`; Laravel API routes are under `http://localhost:8080/api`.
- Frontend env declarations use Vite keys: `VITE_BACKEND_URL`, `VITE_API_BASE_URL`, and temporary `VITE_DEFAULT_AUTH`.
- Active frontend env reads use `import.meta.env`; the old CRA `process.env.REACT_APP_*` compatibility bridge has been removed.
- Do not treat `frontend/` as the canonical admin surface until the `/panel/*` route, API client, and Sanctum session/cookie auth contract are implemented.

## Production Docker Skeleton

The repository includes an early production packaging path:

- `docker-compose.prod.yml`
- `docker/prod/Dockerfile`
- `docker/prod/app/entrypoint.sh`
- `docker/prod/nginx/default.conf`
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
- The parked `frontend/` Vite template is excluded from the production image for now.
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

As of 2026-06-14:
- Backend tests pass: 25 tests, 61 assertions.
- Runtime roles are `admin`, `doctor`, and `patient`.
- `users.role` is not present in the migrated schema.
- `/debug/res-last` is local-only and excluded from production route lists.
- Backend Sanctum session-cookie smoke test passes for CSRF, JSON login, and `/api/auth/me`.
- `frontend/` has been migrated from CRA/react-scripts to Vite and builds successfully.
- `frontend` dev server runs at `http://localhost:3000`.
- Active frontend env usage has been converted to Vite env access; only commented Firebase template notes still mention old CRA env names.

## Known Gaps

Next technical gaps are architectural/product work, not boot blockers:
- First-party browser SPA auth still needs Sanctum session/cookie implementation.
- Parked React admin/client workspace still needs route ownership, API client consolidation, and auth cleanup.
- Booking runtime still needs full `checkup_doctor` pivot enforcement.
- Reservation creation still needs generated-slot enforcement.
- Web/API booking rules should be consolidated into a shared domain service.
- Reservation/payment lifecycle and callbacks need deterministic status transitions.
- API response envelopes are not fully uniform yet, especially around public questionnaire endpoints.
- Reservation policy behavior needs enum-safe tests.
