# Project Map - Checkupino (Nebula)

Snapshot date: 2026-02-20

## 1) Project Reality

Checkupino is currently a Laravel 12 monolith with two UI tracks:
- Primary runtime: Blade + Vite (`resources/views`, `resources/js`, `resources/css`)
- Secondary workspace: React + Vite (`frontend/`), partially integrated and still risky to build

Core implemented domains:
- Auth + roles (Breeze + Sanctum + Spatie Permission)
- Booking (checkups, doctors, reservations, payments)
- Admin CRUD (specialties, checkup categories, checkups)
- Doctor profile/services
- Questionnaire API + React questionnaire pages

## 2) High-Signal Paths (Load First)

- `routes/web.php`
- `routes/api.php`
- `routes/admin.php`
- `routes/doctor.php`
- `app/Http/Controllers/`
- `app/Models/`
- `app/Services/SchedulingService.php`
- `database/migrations/`
- `database/seeders/`
- `resources/views/`
- `docker-compose.yml`
- `docker/php/Dockerfile`
- `docker/nginx/default.conf`
- `composer.json`
- `package.json`

## 3) Low-Signal / Heavy Paths (Skip by Default)

These are the main context-window sinks:
- `frontend/public/assets/` (~134 MB, thousands of vendored/static files)
- `frontend/public/` overall (~145 MB)
- `vendor/` (~54 MB)
- `node_modules/` (~63 MB)
- Generated caches/builds (`public/build`, `storage/framework/*`, etc.)

Unless debugging static asset issues, avoid loading these first.

## 4) Route Surface

Web (session auth):
- Public root: `/`
- User profile/dashboard: `/dashboard`, `/profile`
- Booking pages: `/book*`, `/my/reservations`
- Admin Blade panel: `/admin/*` (middleware `auth`, `verified`, `role:admin`)
- Doctor Blade panel: `/doctor/*` (middleware `auth`, `verified`, `role:doctor`)

API (Sanctum):
- `/api/auth/*` login/logout/profile/me
- `/api/checkups*`, `/api/reservations*`
- `/api/doctor/*` doctor-side reservation/profile endpoints
- `/api/admin/*` users, doctors verify, reservations, questionnaires, submissions
- Public questionnaire endpoints: `/api/questionnaires*`

## 5) Data Model Clusters

Identity and auth:
- `users` + Spatie permission tables + `personal_access_tokens`
- `user_profiles`

Medical booking:
- `specialties`
- `doctor_profiles`
- `checkup_categories`
- `checkups`
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

## 6) Local Runtime Topology

Defined in `docker-compose.yml`:
- `app` (PHP-FPM, code mounted at `/var/www`)
- `nginx` (host `8080` -> container `80`)
- `db` MySQL (host `3307` -> container `3306`)
- `redis` (host `6380` -> container `6379`)

Important env defaults in `.env.example`:
- `DB_HOST=db`
- `DB_PORT=3306`
- `REDIS_HOST=redis`
- `APP_URL=http://localhost:8080`

## 7) Known Breakpoints (Current)

1. Route-method mismatch:
- `routes/api.php` references `AuthController@registerPatient` and `AuthController@refresh`
- `app/Http/Controllers/Api/AuthController.php` does not implement those methods

2. Missing booking Blade views:
- `Front\BookingController` returns `front.booking.*`
- `resources/views/front/booking/*` does not exist

3. Doctor services view in wrong path:
- Present: `app/Http/Controllers/Doctor/services/edit.blade.php`
- Expected: `resources/views/doctor/services/edit.blade.php`

4. Seeder mismatch:
- `LocalUsersSeeder` creates `doctor@checkupino.test`
- `DoctorProfileSeeder` / `DoctorServicesSeeder` search for `doc@checkupino.local`

5. Tests failing:
- `users` table has new NOT NULL profile fields
- `database/factories/UserFactory.php` still uses Breeze default fields

6. Frontend build hazard:
- `frontend/vite.config.ts` outputs to `../public` with `emptyOutDir: true`
- Running `frontend` build can delete Laravel public entry files

## 8) Recommended Scan Order (Future Sessions)

1. Read `README.md` and this `PROJECT_MAP.md`
2. Read route files (`routes/*.php`)
3. Read controllers directly referenced by those routes
4. Read related models + service classes
5. Read migrations/seeders for schema and local credentials
6. Only then open `resources/views` or `frontend/src` based on the target task
7. Avoid `frontend/public/assets`, `vendor`, and `node_modules` unless explicitly needed
