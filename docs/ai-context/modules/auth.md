## Verification Status

Last verified against code: 2026-06-15
Verification method:
- repo inspection
- route list
- tests
- database check where relevant

If this file conflicts with source code, source code wins.
Update this module after verification.

# Auth And Authority Context

Use this module for auth, roles, Sanctum, login/logout, `/api/auth/me`, user profile authority, `root_admin`, or route/menu authorization.

Do not load payment, booking, doctor-reporting, or notification modules for a pure role-taxonomy task.

## Current State

- Auth stack: Laravel Breeze web auth plus Sanctum API/session support.
- First-party browser admin auth uses Sanctum session cookies through `frontend/src/helpers/session_api.ts`.
- Mobile/external style endpoints still return bearer tokens from API login/register/refresh.
- Spatie roles are the only authorization source of truth.
- `users.role` has been removed from the active schema.
- Current role enum values are `admin`, `doctor`, and `patient`.
- `root_admin` is planned but not implemented yet.
- `/api/auth/me` currently returns `id`, `name`, `email`, `roles`, and optional `doctor_profile`.
- Browser admin auth must not store bearer tokens in `localStorage` or `sessionStorage`.

## Open First

- `app/Enums/UserRole.php`
- `database/seeders/RolesSeeder.php`
- `database/seeders/LocalUsersSeeder.php`
- `app/Http/Controllers/Api/ApiController.php`
- `app/Http/Controllers/Api/MeController.php`
- `app/Http/Controllers/Api/AuthController.php`
- `routes/api.php`
- `routes/admin.php`
- `routes/doctor.php`
- `app/Models/User.php`

Frontend authority consumers:

- `frontend/src/helpers/session_api.ts`
- `frontend/src/types/auth.ts`
- `frontend/src/Components/Hooks/UserHooks.ts`
- `frontend/src/Routes/AuthProtected.tsx`
- `frontend/src/Components/Common/ProfileDropdown.tsx`
- `frontend/src/pages/Authentication/user-profile.tsx`

## Guardrails

- Do not reintroduce `users.role`.
- Do not infer authority from frontend local state.
- Keep role names centralized in `App\Enums\UserRole`.
- API role middleware should specify the `sanctum` guard where needed.
- Prefer explicit derived authority flags from the backend if frontend menus need them.
- Decide root-admin behavior before code: separate role treated as admin-equivalent, or root-admin also receives `admin`.

## Current Root-Admin Task Questions

- Should `root_admin` also receive the `admin` role?
- Or should `root_admin` be separate and treated as admin-equivalent in policies/middleware?
- Should `/api/auth/me` expose derived flags such as `is_admin`, `is_root_admin`, and `can_access_devtools`?
- Which frontend menus/routes will consume those flags?

## Verification

Use Docker by default:

```bash
docker compose exec app php artisan test
docker compose exec app php artisan route:list --except-vendor
docker compose exec db mysql -ucheckupino -pcheckupino_pass checkupino -e "SELECT id, name, guard_name FROM roles ORDER BY name;"
```

If frontend authority data changes:

```bash
cd frontend
npm run build
```

## Update After Changes

- `CURRENT_TASK.md` for active root-admin decision and status.
- `CURRENT_SPRINT.md` if sprint queue/status changes.
- This module for durable auth/authority facts.
- ADR or `docs/architecture/boundaries.md` only for durable architecture decisions.
