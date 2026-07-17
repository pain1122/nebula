## Verification Status

Last verified against code: 2026-07-10
Verification method:
- repo inspection
- PHP syntax checks for touched PHP files
- route list verification: 91 routes
- database role check confirmed `root-admin`, `admin`, `doctor`, and `patient` with `guard_name = sanctum`
- manual normal-admin API checks confirmed `root-admin` users cannot be listed, filtered, shown, updated, or created through admin user management
- API admin user audit tests passed: 3 tests, 27 assertions
- API admin user step-up tests passed: 7 tests, 18 assertions
- API admin questionnaire soft-delete tests passed: 2 tests, 15 assertions
- Catalog archive safety tests passed: 17 tests, 154 assertions
- API bearer-token policy tests passed: 5 tests, 15 assertions
- full backend tests passed: 67 tests, 320 assertions
- Manual browser smoke for the admin step-up flow is still a follow-up worry, especially once the frontend password-confirmation prompt/modal is wired.

If this file conflicts with source code, source code wins.
Update this module after verification.

# Auth And Authority Context

Use this module for auth, roles, Sanctum, login/logout, `/api/auth/me`, user profile authority, `root-admin`, or route/menu authorization.

Do not load payment, booking, doctor-reporting, or notification modules for a pure role-taxonomy task.

## Current State

- Auth stack: Laravel Breeze web auth plus Sanctum API/session support.
- First-party browser admin auth uses Sanctum session cookies through `frontend/src/helpers/session_api.ts`.
- Mobile/external style endpoints return bearer tokens from API login/register/refresh.
- API bearer tokens expire using server time through `SANCTUM_TOKEN_EXPIRATION_MINUTES`.
- API token responses include `expires_at`; client-provided timestamps are not trusted for token lifetime decisions.
- `/api/auth/refresh` requires a real bearer token and cannot mint a token from a first-party browser session.
- API logout revokes the current bearer token.
- Spatie roles are the only authorization source of truth.
- `users.role` has been removed from the active schema.
- Current role enum values are `root-admin`, `admin`, `doctor`, and `patient`.
- `root-admin` is implemented as a distinct Spatie role.
- `root-admin` is admin-equivalent through backend helpers, route middleware, and policies, not through double role assignment.
- Normal admin user-management APIs must not create, assign, list, show, or update `root-admin` users.
- API admin user create/update writes fail-closed audit rows to one shared DB-backed `audit_events` table in the same transaction as the user mutation.
- `audit_events.batch_id` is nullable and reserved for future bulk-action grouping; single-record audit events leave it null.
- Audit events are written from Laravel application code, not DB triggers.
- The first audit slice records successful admin user create/update only; denied/failed attempts and other privileged mutation families are deferred.
- API admin user create/update requires recent session-backed password confirmation through `/api/auth/confirm-password`.
- Step-up state is stored in the Laravel session as `auth.password_confirmed_at`.
- The high-authority step-up timeout is `AUTH_HIGH_AUTHORITY_PASSWORD_TIMEOUT`, default 900 seconds.
- `password.confirmed.recent` returns JSON `423` when confirmation is missing or expired.
- Bearer-token callers cannot satisfy high-authority step-up because confirmation must be session-backed.
- API routes only receive a Laravel session for Sanctum stateful first-party requests; token-authenticated Sanctum requests do not have session state.
- Questionnaire and questionnaire-submission admin deletes now soft-delete and should be lower priority than catalog/pricing and reservation-status hardening.
- Future bulk admin/root-admin role upgrades should be rejected outright; future bulk deletes require soft-delete behavior, step-up, and per-subject audit rows sharing one `batch_id`.
- Checkup/checkup-category archive is the second privileged family covered by policy, recent session password confirmation, and fail-closed audit. Category child detach/reassignment writes one event per child plus the category event under one shared `batch_id`.
- HTML catalog step-up uses named safe GET confirmation routes so password confirmation never tries to replay a destructive request as GET; API step-up continues returning JSON `423` even without an explicit Accept header.
- `/api/auth/me` currently returns `id`, `name`, `email`, `roles`, and optional `doctor_profile`.
- `/api/auth/me` should remain role-name-only for this slice; derived authority booleans wait for a concrete frontend route/menu contract.
- Browser admin auth must not store bearer tokens in `localStorage` or `sessionStorage`.
- Marketplace users now have public ULIDs and an authentication-level `active`/`suspended`/`closed` state separate from patient lifecycle state.
- Web/API login rejects inactive users. Authenticated routes apply `account.active`; it revokes Sanctum tokens and invalidates the current browser session for suspended/closed users.
- Proactive mutation-time deletion of every remote Redis session still requires a stable session index/service before the Phase 1 gate can claim that stronger behavior.

## Open First

- `app/Enums/UserRole.php`
- `database/seeders/RolesSeeder.php`
- `database/seeders/LocalUsersSeeder.php`
- `app/Http/Controllers/Api/ApiController.php`
- `app/Http/Controllers/Api/MeController.php`
- `app/Http/Controllers/Api/AuthController.php`
- `app/Http/Controllers/Api/PasswordConfirmationController.php`
- `app/Http/Controllers/Api/Admin/UserController.php`
- `app/Http/Middleware/EnsureRecentPasswordConfirmation.php`
- `app/Models/AuditEvent.php`
- `app/Services/AuditLogger.php`
- `config/auth.php`
- `bootstrap/app.php`
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
- Do not derive request/token timespans from the user's machine; compare token lifetimes using server time.
- Keep role names centralized in `App\Enums\UserRole`.
- API role middleware should specify the `sanctum` guard where needed.
- Step-up for first-party admin writes must remain session-backed; do not satisfy it from bearer-token storage.
- HTML destructive flows must return through a safe GET confirmation route; never store a DELETE/PATCH URL as the post-password intended GET destination.
- Tests for session-backed API behavior should use the default web guard with stateful `Origin`/`Referer` headers plus `withSession(...)`; reserve `actingAs($user, 'sanctum')` for bearer-token style behavior.
- `routes/api.php` contains existing encoded/mojibake comments. Patch routes with minimal import/route context and avoid reflowing or rewriting those comments unless doing a deliberate encoding cleanup.
- Prefer explicit derived authority flags from the backend if frontend menus need them.
- Keep `root-admin` separate from `admin`; do not double-assign `admin` just to inherit access.
- Keep normal admin user-management APIs isolated from `root-admin` users.

## Root-Admin Decisions

- Stored role value is `root-admin`.
- `root-admin` is separate from `admin`.
- Product-admin equivalence is expressed through helpers such as `canAccessAdminPanel()`.
- Devtool/toolbox authority is expressed through `canAccessDevtools()`.
- Do not add frontend authority booleans until frontend route/menu isolation defines the contract.

## Verification

Use Docker by default:

```bash
docker compose exec app php artisan test
docker compose exec app php artisan route:list --except-vendor
docker compose exec db mysql -ucheckupino -pcheckupino_pass checkupino -e "SELECT id, name, guard_name FROM roles ORDER BY name;"
```

Focused local checks for the audit and step-up slice:

```bash
php artisan test --filter=AdminUserAuditTest
php artisan test --filter=AdminUserStepUpTest
php artisan test --filter=AdminQuestionnaireSoftDeleteTest
php artisan test --filter=AuthTokenTest
php artisan test --filter=CatalogDestructiveDataSafetyTest
```

Manual follow-up worry for the step-up UX:

```text
1. Log in as an admin through the browser session.
2. Try a protected admin user create/update without password confirmation and expect 423.
3. Confirm the current password through /api/auth/confirm-password.
4. Retry the protected mutation and expect success plus an audit_events row.
5. Verify expiry returns 423 again.
```

If frontend authority data changes:

```bash
cd frontend
npm run build
```

## Update After Changes

- `CURRENT_TASK.md` for active root-admin decision and status.
- `docs/TODO.md` only if the roadmap order or phase gate changes.
- This module for durable auth/authority facts.
- ADR or `docs/architecture/boundaries.md` only for durable architecture decisions.
