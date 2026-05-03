# TODO - Architecture Sync Roadmap (Decision Locked)

Date locked: 2026-05-03

## Locked Decisions
- [x] Admin panel UI stack: React + Bootstrap
- [x] Client/public UI stack: React + Tailwind
- [x] Role source of truth: Spatie roles/permissions (sole authority)
- [x] First-party web SPA/PWA auth: Sanctum Session/Cookie
- [x] Mobile/external auth: Bearer tokens (TTL/rotation/revocation)

## Working Principles
- One business rule path per domain behavior. No duplicated controller logic.
- One authoritative data source per concept. No split-brain fields.
- One canonical API response contract across all API controllers.
- No debug or privileged endpoints exposed publicly.
- CI green is mandatory before merge.

## Phase 1 - Foundation and Security Baseline (Blocker)
1. [ ] Remove or strictly local-guard `/debug/res-last`.
Done when: endpoint is unreachable in non-local environments.

2. [ ] Publish architecture docs:
Files: `docs/adr/ADR-0001-ui-auth-role-architecture.md` and `docs/architecture/boundaries.md`.
Done when: boundaries are explicit for routes, stacks, and auth modes.

3. [ ] Resolve local environment contract drift for frontend API target.
Evidence: React defaults/proxy target `127.0.0.1:8000` while Docker app uses `localhost:8080`.
Done when: one documented local API base strategy works for `frontend/` and backend.

4. [ ] Fix test bootstrap so feature tests do not require built Vite assets.
Evidence: `php artisan test` fails with `ViteManifestNotFoundException`.
Done when: tests pass on clean clone with `php artisan test` only.

## Phase 2 - Auth and Authorization Rebase
1. [ ] Remove `users.role` from runtime authority flow.
Scope:
- Stop writing `role` in registration/profile/admin controllers.
- Stop reading `user.role` as authoritative response data.
Done when: authorization decisions rely on Spatie roles only.

2. [ ] Normalize Spatie role guard strategy across web and sanctum contexts.
Done when: web admin + API admin role checks are consistent and documented.

3. [ ] Ensure web registration assigns deterministic Spatie role.
Done when: new web users have expected role rows in Spatie tables.

4. [ ] Align role taxonomy across seeders, validation, and admin APIs.
Evidence: `patient` exists in seeders but is blocked in admin user API validation.
Done when: allowed roles are consistent everywhere.

## Phase 3 - Session/Cookie First-Party SPA Integration
1. [ ] Implement first-party SPA auth flow using Sanctum cookies.
Scope:
- CSRF bootstrap endpoint usage.
- Session-based login/logout/me flow for browser SPA.
Done when: admin SPA operates without bearer token storage in localStorage.

2. [ ] Keep bearer token flow for mobile/external clients only.
Scope:
- Token abilities/scopes.
- Explicit TTL/rotation/revocation policy.
Done when: docs and code separate first-party vs external auth paths.

3. [ ] Add high-authority action controls.
Scope:
- Re-auth/step-up for sensitive admin actions.
- Audit logging for privileged mutations.
Done when: privileged write paths have policy + traceability.

## Phase 4 - Admin and Client UI Boundary Execution
1. [ ] Declare React admin route namespace and ownership.
Proposal: `/panel/*` is canonical admin UI surface.
Done when: non-canonical admin UI paths are deprecated or redirected by policy.

2. [ ] Define CSS boundary contract:
- Admin React uses Bootstrap.
- Client/public React uses Tailwind.
Done when: no cross-surface style leakage and build docs are clear.

3. [ ] Consolidate shared frontend API client utilities.
Evidence: repeated `API_BASE`/token header patterns across pages.
Done when: one typed API client is used by admin and client React apps.

4. [ ] Fix React route/auth path drift.
Evidence: `/panel/*` routes coexist with redirects to `/login` and `/`.
Done when: all redirects and links resolve inside the canonical route map.

## Phase 5 - Booking Domain Consistency
1. [ ] Enforce `checkup_doctor` pivot as doctor/checkup eligibility source.
Evidence: runtime still relies on `specialty_id == checkup_category_id` in booking paths.
Done when: both web and API booking use pivot relation checks.

2. [ ] Enforce slot validity during reservation creation.
Evidence: conflict check exists, submitted slot validity is not fully enforced.
Done when: `starts_at + duration` must match generated available slots.

3. [ ] Consolidate booking decision logic into a domain service.
Done when: web/API controllers call shared service, not duplicated inline rules.

4. [ ] Define payment status transitions and callback handling.
Done when: reservation/payment lifecycle is deterministic and test-covered.

## Phase 6 - Data Model Completeness
1. [ ] Add missing `user_profiles` migration and verify endpoints on fresh DB.
Done when: profile CRUD works after `migrate --seed` on clean environment.

2. [ ] Implement reservation notes/files route/controller workflows.
Done when: doctor/admin create/list/update flows exist and are authorized.

## Phase 7 - Contract and Regression Test Expansion
1. [ ] Add feature tests for booking-critical flows:
- pivot eligibility
- slot enforcement
- cancel/complete transitions
Done when: regressions are blocked by tests.

2. [ ] Add auth-mode tests:
- first-party session/cookie SPA flow
- external bearer token flow
Done when: both modes are validated and isolated.

3. [ ] Add API contract tests for envelope consistency.
Done when: controller response shapes are uniform and verified.

## Phase 8 - Cleanup and Enforcement
1. [ ] Remove dead code paths and stale docs after migration steps complete.
Done when: README, project map, and runtime behavior match reality.

2. [ ] Add PR checklist gates:
- no duplicated domain logic
- no new split-brain fields
- tests updated for behavior changes
Done when: governance is enforced at review time.

