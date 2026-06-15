# CURRENT_SPRINT.md

Snapshot date: 2026-06-15

## Parent Task

`CURRENT_TASK.md`: Establish the Phase 3/3.5 authority and admin-shell foundation before product admin and root-admin toolbox separation.

## Sprint

Finish backend `root-admin` authority hardening and verification.

## Why This Sprint Exists

The project is about to split normal product admin access from root-admin developer/toolbox access. That split is only safe if backend authority is already clear:

- who can access normal admin features
- who can access root-admin/devtool features
- who can manage users
- which role names are allowed through admin user-management APIs

## Current Focus

Complete the backend authority slice before any frontend route/menu/toolbox work.

## Decisions For This Sprint

- Stored role value is `root-admin`.
- `root-admin` is separate from `admin`.
- `root-admin` is admin-equivalent through helpers/gates, not through double role assignment.
- Normal admin user management must not manage root-admin users.
- `/api/auth/me` remains role-name-only for now.
- Do not add frontend authority booleans in this sprint.

## In Scope

- `app/Enums/UserRole.php`
- `database/seeders/RolesSeeder.php`
- `database/seeders/LocalUsersSeeder.php`
- `app/Models/User.php`
- `routes/api.php`
- `routes/admin.php`
- `app/Http/Requests/Admin/*`
- `app/Policies/ReservationPolicy.php`
- `app/Http/Controllers/Api/Admin/UserController.php`
- `frontend/src/types/auth.ts`
- smallest relevant docs after verification

## Out Of Scope

- Velzon route/menu split
- demo page deletion
- lazy-loading route implementation
- payment, booking, reports, public questionnaires
- production Docker
- public/client React rebuild

## Current Known State To Verify

- `UserRole` should include `RootAdmin = 'root-admin'`.
- `UserRole` should expose product-admin role values and admin-assignable values.
- `RolesSeeder` should seed all enum values with `guard_name = sanctum`.
- `LocalUsersSeeder` should create a deterministic root-admin user without unique `phone` or `NID` collisions.
- `User` should expose `isRootAdmin()`, `canAccessAdminPanel()`, and `canAccessDevtools()`.
- Admin route middleware should allow `admin|root-admin`.
- API admin route middleware should allow `admin|root-admin` and specify the `sanctum` guard.
- Admin form requests should use `canAccessAdminPanel()`.
- `ReservationPolicy` should consistently use `canAccessAdminPanel()` for admin-equivalent checks.
- `UserController@store` and `UserController@update` should reject assigning `root-admin`.
- `UserController@index` should hide root-admin users and reject `?role=root-admin`.
- `UserController@show` should reject root-admin users.
- `UserController@update` should reject direct updates to existing root-admin users by ID.
- `frontend/src/types/auth.ts` should allow the `root-admin` role name.
- `/api/auth/me` should still return role names only.

## Sprint Checklist

- [ ] Inspect current code against the known-state list above.
- [ ] Fix any remaining root-admin user-management exposure.
- [ ] Make `ReservationPolicy` use the centralized admin-equivalent helper consistently.
- [ ] Run PHP syntax checks for touched PHP files.
- [ ] Run backend tests.
- [ ] Run route-list verification.
- [ ] Verify seeded roles include `root-admin` with `guard_name = sanctum`.
- [ ] Manually verify normal admin cannot create/list/filter/show/update root-admin users.
- [ ] Update `CURRENT_SPRINT.md` with verification results.
- [ ] Update `CURRENT_TASK.md` status if the sprint completes.
- [ ] Update `docs/TODO.md` only after verified behavior is real.

## Verification Commands

Use Docker by default:

```bash
docker compose exec app php artisan test
docker compose exec app php artisan route:list --except-vendor
docker compose exec db mysql -ucheckupino -pcheckupino_pass checkupino -e "SELECT id, name, guard_name FROM roles ORDER BY name;"
```

Manual API checks after login/session setup:

```bash
GET /api/admin/users
GET /api/admin/users?role=root-admin
GET /api/admin/users/{root_admin_user_id}
PUT /api/admin/users/{root_admin_user_id}
POST /api/admin/users with role=root-admin
```

Expected result:

- normal list excludes root-admin users
- `role=root-admin` filter is rejected
- show root-admin user is rejected
- update root-admin user is rejected
- creating a root-admin user is rejected

## Next Sprint Candidate

After this sprint is verified:

- define React product-admin route/menu group
- define root-admin developer toolbox route/menu group
- keep Velzon demo pages but move them behind the root-admin boundary
- plan lazy loading before moving large demo inventories
