# Checkupino (Nebula)

Laravel 12 medical checkup and consultation platform with:
- Blade + Vite web UI (current primary runtime)
- Sanctum-based API for auth, booking, admin, and questionnaires
- Optional React workspace in `frontend/` for panel/public questionnaire UIs

## Current Scope (Implemented)

- Authentication: Laravel Breeze (web) + Sanctum token auth (API)
- Roles/permissions: Spatie Permission (`admin`, `doctor`, `user`, `patient`)
- Booking domain: checkup categories, checkups, doctor profiles, reservations, payments
- Admin panel (Blade): specialties, checkup categories, checkups
- Doctor panel (Blade): dashboard, profile edit, service selection
- Questionnaire domain (API + React pages): questionnaire CRUD, public submission, admin submissions

## Stack

- Backend: PHP 8.3, Laravel 12
- Database: MySQL 8
- Cache/queue infra: Redis 7
- Web server: Nginx + PHP-FPM (Docker)
- Frontend (root): Blade + Tailwind + Vite
- Frontend (optional workspace): React 19 + TypeScript + Vite

## Repository Layout

- `app/` domain models, controllers, requests, services
- `routes/` web + api + admin + doctor route groups
- `database/migrations/` schema
- `database/seeders/` local roles/users/domain seed data
- `resources/views/` Blade UI
- `resources/js` and `resources/css` Vite entrypoints
- `docker/` Dockerfiles and Nginx config
- `frontend/` separate React app workspace

## 🚀 Local Installation

This project is designed for Docker-based local development.

### 1) Requirements

- Docker Desktop (with Compose v2)
- Node.js 20.19+ (recommended for Vite 7)
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

Verify these values in `.env`:

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

### 4) Start containers

```bash
docker compose up -d --build
docker compose ps
```

Expected exposed ports:
- App (nginx): `8080`
- MySQL: `3307` (host) -> `3306` (container)
- Redis: `6380` (host) -> `6379` (container)

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

### 7) Install and run Vite (root Blade frontend)

```bash
npm install
npm run dev
```

If you prefer production assets:

```bash
npm run build
```

If you see `Vite manifest not found at public/build/manifest.json`, run `npm run dev` or `npm run build`.

### 8) Access URLs

- App: `http://localhost:8080`
- Login: `http://localhost:8080/login`
- Dashboard: `http://localhost:8080/dashboard`
- Admin panel: `http://localhost:8080/admin` (admin role)
- Doctor panel: `http://localhost:8080/doctor` (doctor role)
- API base: `http://localhost:8080/api`

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

### 10) Optional: run the separate React workspace (`frontend/`)

Use this only if you are actively working on the React app:

```bash
cd frontend
npm install
npm run dev
```

Important warning:
- `frontend/vite.config.ts` currently builds into `../public` with `emptyOutDir: true`.
- Running `npm run build` inside `frontend/` can wipe Laravel `public/` files (including `index.php`).
- Do not run `frontend` build until this output strategy is adjusted.

## Troubleshooting

- `Please provide a valid cache path`:
  ```bash
  docker compose exec app bash -lc "mkdir -p storage/framework/{cache,sessions,views} bootstrap/cache"
  ```

- Database not ready yet:
  ```bash
  docker compose logs -f db
  ```
  Then rerun migration command when MySQL is healthy.

- Port conflicts (8080/3307/6380):
  - Stop conflicting local services or change host ports in `docker-compose.yml`.

- Tests currently failing out of the box:
  - `php artisan test` fails because `users` now requires `first_name`, `last_name`, `phone`, `birth_date`, and `NID`, while `database/factories/UserFactory.php` is still Breeze-default.

## Useful Commands

```bash
# app shell
docker compose exec app bash

# routes
docker compose exec app php artisan route:list

# tests
docker compose exec app php artisan test

# stop
docker compose down

# full reset (containers + DB volume)
docker compose down -v
```

## Known Gaps (Workspace Snapshot)

- API routes reference `AuthController@registerPatient` and `AuthController@refresh`, but those methods are not present in `app/Http/Controllers/Api/AuthController.php`.
- Blade views for booking (`front.booking.*`) are referenced by routes/controllers but are missing under `resources/views/front/booking/`.
- `doctor.services.edit` view file exists in the wrong location: `app/Http/Controllers/Doctor/services/edit.blade.php` instead of `resources/views/doctor/services/edit.blade.php`.
- `DoctorProfileSeeder` and `DoctorServicesSeeder` target `doc@checkupino.local`, but `LocalUsersSeeder` creates `doctor@checkupino.test`.


