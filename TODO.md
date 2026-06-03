# TODO - Architecture Sync Roadmap (Assessment Synced)

Date locked: 2026-05-03
Last assessed: 2026-06-03
Assessment basis: repo inspection, `php artisan route:list --except-vendor` in local and production envs, `php artisan test`, and database role/schema checks.

## Locked Decisions
- [x] Admin panel UI stack: React + Bootstrap
- [x] Client/public UI stack: React + Tailwind
- [x] Role source of truth: Spatie roles/permissions (sole authority)
- [x] First-party web SPA/PWA auth: Sanctum Session/Cookie
- [x] Mobile/external auth: Bearer tokens (TTL/rotation/revocation)

## Resolved Since Prior Snapshot
- [x] `AuthController@registerPatient` and `AuthController@refresh` exist.
- [x] Booking Blade views exist under `resources/views/front/booking/`.
- [x] Doctor services Blade view exists under `resources/views/doctor/services/`.
- [x] `user_profiles` migration exists and backs `UserProfileController`.
- [x] Lead capture foundation exists via `leads`, `Lead`, and questionnaire submission linkage.
- [x] `patient_status` exists as a nullable patient lifecycle/capability flag.
- [x] `users.role` has been migrated out of the active schema.
- [x] Role taxonomy is centralized in `App\Enums\UserRole` with `admin`, `doctor`, and `patient`.
- [x] Test bootstrap disables Vite asset requirements and seeds core roles.
- [x] `/debug/res-last` is local-only.
- [x] Architecture docs exist under `docs/adr/` and `docs/architecture/`.
- [x] `checkup_doctor` pivot migration and model relationships exist.
- [x] Old frontend Vite workspace was replaced by the Velzon React-TS CRA template and is parked until the frontend rebuild phase.

## Working Principles
- One business rule path per domain behavior. No duplicated controller logic.
- One authoritative data source per concept. No split-brain fields.
- One canonical API response contract across all API controllers.
- No debug or privileged endpoints exposed publicly.
- CI green is mandatory before merge.

## Phase 1 - Foundation and Security Baseline (Complete)
1. [x] Remove or strictly local-guard `/debug/res-last`.
Evidence: `routes/web.php` wraps `/debug/res-last` in `app()->environment('local')`.
Done when: endpoint is unreachable in non-local environments.
Status: Production route list excludes the endpoint.

2. [x] Add the missing `user_profiles` migration before relying on profile API.
Evidence: `database/migrations/2026_06_03_095153_create_user_profiles_table.php` exists.
Done when: `/api/auth/profile` works after `migrate --seed` on a clean DB.
Status: Migration and API routes are present.

3. [x] Resolve local environment contract drift for frontend API target.
Evidence: The active Docker backend is exposed through Nginx at `http://localhost:8080`; the parked CRA frontend should target `http://localhost:8080/api` when it is reconnected.
Done when: one documented local API base strategy works for frontend and backend.
Status: Documented in `README.md` and `PROJECT_MAP.md`. Host-side PHP must not use Docker-only `DB_HOST=db`; run Artisan inside Docker or use host DB port `3307`.

4. [x] Fix test bootstrap so feature tests do not require built Vite assets.
Evidence: `tests/TestCase.php` calls `$this->withoutVite()` and seeds `RolesSeeder` when the roles table exists.
Done when: tests pass on a clean clone with `php artisan test` only.
Status: Current suite passes: 25 tests, 61 assertions.

5. [x] Sync high-signal docs to current runtime reality.
Evidence: `README.md`, `PROJECT_MAP.md`, `TODO.md`, ADR, and architecture boundaries were refreshed on 2026-06-03.
Done when: known gaps in docs match the actual codebase.

## Phase 2 - Auth and Authorization Rebase (Complete)
1. [x] Remove `users.role` from runtime authority flow.
Scope: stop writing `role` in registration/admin user flows.
Scope: stop returning `user.role` as authoritative profile data.
Done when: authorization decisions and API role data rely on Spatie roles only.
Status: `users.role` column is dropped. API payload keys named `role` are computed from `$user->roles`, not from a users table column.

2. [x] Ensure web registration assigns deterministic Spatie role.
Evidence: `RegisteredUserController` assigns the patient role through Spatie.
Done when: new web users have expected rows in Spatie role tables.

3. [x] Normalize Spatie role guard strategy across web and sanctum contexts.
Evidence: route middleware uses `App\Enums\UserRole`; API routes specify the `sanctum` guard; `User` is configured with the Sanctum Spatie guard name.
Done when: web admin, web doctor, API admin, and API doctor checks are consistent and documented.

4. [x] Align role taxonomy across seeders, validation, and admin APIs.
Evidence: `RolesSeeder`, API routes, admin user validation, registration flows, and policies use `UserRole` values.
Done when: allowed roles are consistent everywhere.
Status: Database roles contain `admin`, `doctor`, and `patient`; old `user` role is gone.

## Phase 3 - Session/Cookie First-Party SPA Integration
1. [ ] Implement first-party SPA auth flow using Sanctum cookies.
Scope: CSRF bootstrap endpoint usage.
Scope: session-based login/logout/me flow for browser SPA.
Done when: admin SPA operates without bearer token storage in localStorage.

2. [ ] Remove browser-admin dependence on bearer tokens stored in browser storage.
Evidence: The parked Velzon CRA template still carries template auth/localStorage patterns and is not yet wired to the Laravel session-first contract.
Done when: `/panel/*` authenticated calls use cookie/session auth.

3. [ ] Keep bearer token flow for mobile/external clients only.
Scope: token abilities/scopes.
Scope: explicit TTL, rotation, and revocation policy.
Done when: docs and code separate first-party vs external auth paths.

4. [ ] Add high-authority action controls.
Scope: re-auth/step-up for sensitive admin actions.
Scope: audit logging for privileged mutations.
Done when: privileged write paths have policy plus traceability.

## Phase 4 - Admin and Client UI Boundary Execution
1. [ ] Declare React admin route namespace and ownership.
Proposal: `/panel/*` is canonical admin UI surface.
Evidence: Blade `/admin/*` remains active while the React admin surface is parked for rebuild.
Done when: non-canonical admin UI paths are deprecated, redirected, or explicitly legacy.

2. [ ] Fix React route/auth path drift.
Evidence: The current `frontend/` is a Velzon React-TS CRA template and still contains template routing/auth assumptions.
Done when: all redirects and links resolve inside the canonical route map.

3. [ ] Consolidate shared frontend API client utilities.
Evidence: The current frontend template still needs project-specific API client work.
Done when: one typed API client is used by admin and client React apps.

4. [ ] Enforce CSS boundary contract.
Evidence: Locked direction is admin React + Bootstrap, public/client React + Tailwind; implementation is not complete while the frontend rebuild is parked.
Done when: admin React uses Bootstrap conventions and public/client React uses Tailwind conventions without leakage.

## Phase 5 - Booking and Reservation Domain Consistency
1. [ ] Enforce `checkup_doctor` pivot as doctor/checkup eligibility source.
Evidence: runtime still relies on `specialty_id == checkup_category_id` in web and API booking paths.
Done when: both web and API booking use pivot relation checks.

2. [ ] Enforce slot validity during reservation creation.
Evidence: conflict check exists, but submitted `starts_at + duration` is not proven to match generated available slots.
Done when: reservation creation only accepts generated available slots.

3. [ ] Consolidate booking decision logic into a domain service.
Evidence: web and API booking controllers duplicate eligibility, conflict, reservation, and payment creation rules.
Done when: web/API controllers call shared service methods for booking decisions.

4. [ ] Fix enum/string mismatches in reservation policies.
Evidence: `Reservation.status` is cast to `ReservationStatus`, while `ReservationPolicy` compares it to string values.
Done when: policy checks use enum-safe comparisons and have regression coverage.

5. [ ] Define payment status transitions and callback handling.
Evidence: reservations create `stripe`/`unpaid` payment rows, but lifecycle/callback behavior is not defined.
Done when: reservation/payment lifecycle is deterministic and test-covered.

## Phase 6 - Data Model Completeness
1. [ ] Implement reservation notes/files route/controller workflows.
Done when: doctor/admin create/list/update flows exist and are authorized.

2. [x] Decide whether `users.role` remains as inert legacy data or gets migrated out.
Done when: schema, model fillable fields, API payloads, and docs agree.
Status: Migrated out. Roles live in Spatie tables only.

3. [x] Decide whether profile medical fields live in `user_profiles` or directly on `users`.
Evidence: identity/contact/core account fields live on `users`; medical profile fields live in `user_profiles`; patient lifecycle state lives in nullable `users.patient_status`.
Done when: profile boundaries are documented and schema-backed.

## Phase 7 - Contract and Regression Test Expansion
1. [ ] Add feature tests for booking-critical flows.
Scope: pivot eligibility.
Scope: slot enforcement.
Scope: cancel/complete transitions.
Done when: regressions are blocked by tests.

2. [ ] Add auth-mode tests.
Scope: first-party session/cookie SPA flow.
Scope: external bearer token flow.
Done when: both modes are validated and isolated.

3. [ ] Add API contract tests for envelope consistency.
Evidence: most API controllers use `successResponse`, while questionnaire endpoints return raw JSON/paginators.
Done when: controller response shapes are uniform and verified.

4. [ ] Add policy tests for reservation authorization.
Scope: patient ownership.
Scope: doctor ownership.
Scope: admin override.
Scope: enum status restrictions.
Done when: `ReservationPolicy` behavior is covered.

## Phase 8 - Cleanup and Enforcement
1. [ ] Remove stale tracked paths and dead code after migration steps complete.
Evidence: old `app/Http/Controllers/Doctor/services/edit.blade.php` is deleted while replacement views exist in `resources/views/doctor/services/`.
Done when: obsolete paths are removed from the repository and docs.

2. [ ] Keep docs synchronized after future implementation phases.
Done when: README, project map, TODO, and runtime behavior match after each phase lands.

3. [ ] Add PR checklist gates.
Scope: no duplicated domain logic.
Scope: no new split-brain fields.
Scope: tests updated for behavior changes.
Done when: governance is enforced at review time.
