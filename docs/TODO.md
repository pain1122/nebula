# TODO - Architecture Sync Roadmap (Assessment Synced)

Date locked: 2026-05-03
Last assessed: 2026-06-14
Assessment basis: repo inspection, `php artisan route:list --except-vendor` in local and production envs, `php artisan test`, database role/schema checks, production Compose config validation, Sanctum session smoke testing, frontend Vite build/dev verification, frontend env migration audit, CORS/preflight audit, and admin shell i18n/theme inspection.

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
- [x] Old frontend Vite workspace was replaced by the Velzon React-TS template, then migrated from CRA/react-scripts back to Vite.
- [x] Production Docker skeleton exists via `docker-compose.prod.yml`, `docker/prod/Dockerfile`, and `docs/deployment/docker-production.md`.
- [x] Backend session-cookie auth contract works for first-party SPA calls: `/sanctum/csrf-cookie` -> JSON `POST /login` -> `/api/auth/me`.
- [x] `frontend/` Vite dev server and production build are green.
- [x] Active frontend env usage now uses Vite env access; the CRA `process.env.REACT_APP_*` compatibility bridge has been removed.
- [x] Frontend session auth helper exists and uses Sanctum cookies with `withCredentials`.
- [x] `/api/auth/me` frontend reads avoid unnecessary JSON/XSRF headers and dedupe duplicate in-flight requests.
- [x] CORS now supports credentialed SPA requests and caches preflight responses with `CORS_MAX_AGE`.
- [x] Persian locale is registered as `fa`, set as the default language, and uses a key shape compatible with the current Velzon template.
- [x] Iran flag is wired into the language dropdown through `ir.svg`.
- [x] Admin panel is RTL-first for now; the runtime LTR/RTL toggle is deferred because the template RTL partials are global, not safely scoped.
- [x] Local Persian-friendly fonts are registered and selected when `html[lang="fa"]` is active.
- [x] CDN/Google font imports were removed from the active SCSS stack.
- [x] Theme customizer settings persist through `localStorage` under `nebula.layout.settings`.
- [x] Active admin SPA auth now uses Sanctum session cookies instead of browser-stored bearer tokens.
- [x] Header/profile display reads the Laravel session user from `/api/auth/me`.
- [x] Firebase auth helpers, fake JWT auth backend, and JWT token-access helpers were removed from the frontend runtime.
- [x] `api_helper.ts` no longer reads `sessionStorage authUser` or attaches global `Authorization: Bearer` headers.

## Known Current Constraints
- [ ] The Velzon demo/template pages are still statically imported by `frontend/src/Routes/allRoutes.tsx`, so hidden pages still inflate the initial JS bundle.
- [ ] `frontend/src/helpers/fakebackend_helper.ts` still exists for Velzon demo data slices. It is no longer browser-admin auth authority, but it should be isolated under the future root-admin/developer toolbox.
- [ ] `root_admin` is not currently present in `App\Enums\UserRole`; current role taxonomy is `admin`, `doctor`, and `patient`.
- [ ] Normal admin UX should not pay for root-admin/demo utilities. Developer/root-admin can tolerate heavier lazy-loaded pages.

## Working Principles
- One business rule path per domain behavior. No duplicated controller logic.
- One authoritative data source per concept. No split-brain fields.
- One canonical API response contract across all API controllers.
- No debug or privileged endpoints exposed publicly.
- CI green is mandatory before merge.

## Deployment Contract - Ongoing
- [x] Keep local Docker and future production Docker separate.
- [x] Add immutable production image skeleton with no project bind-mount.
- [x] Document required production runtime env file through `.env.production.example`.
- [x] Add container health route: `/healthz`.
- [x] Define named volumes for DB, Redis, and Laravel storage.
- [x] Add optional queue/scheduler worker profile.
- [ ] Build the production images in CI.
- [ ] Add smoke test for `docker compose -f docker-compose.prod.yml up`.
- [ ] Decide release-time migration policy: manual step vs `RUN_MIGRATIONS=true`.
- [ ] Define backup/restore process for DB and uploaded files.
- [ ] Finalize TLS/reverse-proxy strategy.

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
Evidence: The active Docker backend is exposed through Nginx at `http://localhost:8080`; the Vite frontend workspace declares `VITE_BACKEND_URL=http://localhost:8080` and `VITE_API_BASE_URL=http://localhost:8080/api`.
Done when: one documented local API base strategy works for frontend and backend.
Status: Documented in `README.md` and `docs/PROJECT_MAP.md`. Host-side PHP must not use Docker-only `DB_HOST=db`; run Artisan inside Docker or use host DB port `3307`.

4. [x] Fix test bootstrap so feature tests do not require built Vite assets.
Evidence: `tests/TestCase.php` calls `$this->withoutVite()` and seeds `RolesSeeder` when the roles table exists.
Done when: tests pass on a clean clone with `php artisan test` only.
Status: Current suite passes: 25 tests, 61 assertions.

5. [x] Sync high-signal docs to current runtime reality.
Evidence: `README.md`, `docs/PROJECT_MAP.md`, `docs/TODO.md`, ADR, and architecture boundaries were refreshed on 2026-06-03.
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

## Phase 2.5 - Frontend Tooling Rebase: CRA to Vite
Reason: `frontend/` was imported as the Velzon React-TS Create React App template. Create React App is deprecated for new React work, and Phase 3 auth will touch env variables, routing, and Axios. Migrating to Vite first avoids wiring Sanctum auth against a toolchain we already intended to replace.

Guardrail: migrate tooling only. Do not redesign pages, trim menus, or rewrite auth logic in this phase except for mechanical env/build compatibility.

1. [x] Capture current frontend baseline before touching files.
Scope: run `cd frontend && npm install` if dependencies are missing.
Scope: run the current CRA dev/build command enough to know the starting failure/success state.
Why: a migration is easier to debug when the pre-migration template state is known.
Done when: current `frontend/` start/build status is written in notes or commit message.
Status: CRA baseline build succeeds. Warnings confirm stale CRA/Babel/TypeScript toolchain; main JS bundle is ~3.03 MB gzip. `npm install` normalized `frontend/package-lock.json` to the current package metadata.


2. [x] Replace CRA package scripts with Vite scripts.
Scope: remove `react-scripts`.
Scope: add `vite`, `@vitejs/plugin-react`, and likely `vite-tsconfig-paths`.
Scope: change scripts to `dev`, `start`, `build`, and `preview` using Vite.
Why: Vite becomes the frontend build/dev server, while `start` remains convenient muscle memory.
Done when: `frontend/package.json` no longer depends on `react-scripts`.
Status: `react-scripts` removed; Vite and React plugin installed.


3. [x] Move the HTML entry contract to Vite.
Scope: create `frontend/index.html` with `<script type="module" src="/src/index.tsx"></script>`.
Scope: preserve required template metadata/assets from CRA `public/index.html` only if still needed.
Why: CRA serves `public/index.html`; Vite expects the app HTML entry at the project root.
Done when: Vite can find `src/index.tsx` from `frontend/index.html`.
Status: `frontend/index.html` is the Vite entry and loads `/src/index.tsx`.


4. [x] Convert CRA environment variable usage to Vite.
Scope: replace active `process.env.REACT_APP_*` usage with `import.meta.env.VITE_*`.
Scope: replace active `process.env.PUBLIC_URL` usage with `import.meta.env.BASE_URL` or a small compatibility helper.
Scope: rename frontend env keys from `REACT_APP_*` to `VITE_*`.
Why: CRA and Vite expose env variables differently; leaving this mixed causes runtime `process is not defined` errors.
Done when: `rg "process\\.env|REACT_APP_|PUBLIC_URL" frontend/src` has only comments or intentionally deferred template code.
Status: Declaration: `frontend/.env.example` documents `VITE_BACKEND_URL`, `VITE_API_BASE_URL`, and `VITE_DEFAULT_AUTH`. Implementation: active CRA env reads were replaced with `import.meta.env`; public image paths use `VITE_BACKEND_URL`, API checks use `VITE_API_BASE_URL`, and routing base path uses `import.meta.env.BASE_URL`. Validation: build and dev server pass after removing the CRA compatibility bridge from `frontend/vite.config.ts`. Remaining `process.env.REACT_APP_*` hits are commented Firebase template notes only.


5. [x] Preserve TypeScript path resolution.
Scope: keep `baseUrl: "./src"` behavior or replace it with explicit Vite aliases.
Scope: support template imports such as `pages/...`, `common/...`, and other absolute-from-src paths if present.
Why: CRA tolerated the template's absolute imports through TypeScript config; Vite needs matching resolver behavior.
Done when: Vite dev/build resolves existing imports without path alias errors.
Status: Vite native `resolve.tsconfigPaths` handles existing absolute-from-src imports.


6. [x] Add Vite type declarations.
Scope: replace CRA-specific `react-app-env.d.ts` usage with `vite-env.d.ts` if needed.
Scope: ensure TypeScript recognizes `import.meta.env`.
Why: TypeScript needs Vite's client types for env access and asset imports.
Done when: TypeScript no longer complains about `import.meta.env`.
Status: `src/vite-env.d.ts` added and CRA `react-app-env.d.ts` removed.


7. [x] Keep the fake backend untouched during tooling migration.
Scope: leave `fakeBackend()` behavior in place until Vite boot/build is green.
Why: removing fake data and changing auth at the same time would mix two migrations and make failures ambiguous.
Done when: demo pages behave at least as well as they did before migration.
Status: Completed during tooling migration. Later Phase 3 auth cleanup removed the global `fakeBackend()` activation and deleted the fake JWT auth backend.


8. [x] Verify Vite dev server.
Scope: run `cd frontend && npm run dev` or `npm start`.
Scope: open the Vite local URL and confirm the template renders.
Why: this proves the dev experience works before testing production build.
Done when: the app renders without a blank page or console-breaking module errors.
Status: `npm start` runs Vite on `localhost:3000`; app renders and redirects to `/login`.


9. [x] Verify Vite production build.
Scope: run `cd frontend && npm run build`.
Scope: inspect output directory and confirm assets are generated.
Why: deployment work depends on a repeatable production build, not just the dev server.
Done when: Vite build completes successfully.
Status: `npm run build` succeeds. Remaining warning: large chunks from template/demo inventory.


10. [x] Update docs after migration.
Scope: update `README.md`, `docs/PROJECT_MAP.md`, and this TODO section.
Scope: mention that `frontend/` is now Velzon React-TS on Vite, still parked for Phase 3 auth wiring.
Why: docs must say how to run the actual frontend toolchain.
Done when: frontend commands in docs use Vite, not CRA.
Status: Root README, project map, frontend README, and this TODO now describe `frontend/` as Vite-powered.

11. [x] Commit the env cleanup separately before Phase 3.
Scope: do not combine with Sanctum auth, route namespace, or UI cleanup.
Why: a clean checkpoint makes later frontend auth bugs easier to isolate.
Done when: Git history has a dedicated Vite env cleanup commit after the CRA-to-Vite base migration.
Status: CRA-to-Vite base migration was pushed as `6267c1b chore: migrate frontend template to vite`; Vite env cleanup was pushed separately as `4d8d742 chore: finish vite env migration`.

## Phase 3 - Session/Cookie First-Party SPA Integration
1. [x] Implement first-party SPA auth flow using Sanctum cookies.
Scope: CSRF bootstrap endpoint usage.
Scope: session-based login/logout/me flow for browser SPA.
Done when: admin SPA operates without bearer token storage in localStorage.
Status: Backend contract is ready and browser-tested. Frontend `session_api.ts` calls `/sanctum/csrf-cookie`, JSON `POST /login`, `/api/auth/me`, and `POST /logout` with credentials.

2. [x] Remove browser-admin dependence on bearer tokens stored in browser storage.
Evidence: Active login, route guard, profile dropdown, and profile page use the Sanctum session user instead of `sessionStorage authUser` or bearer tokens.
Done when: `/panel/*` authenticated calls use cookie/session auth.
Status: Active admin runtime is session-first. `api_helper.ts` no longer attaches global bearer headers. Firebase auth helpers, fake JWT auth backend, and JWT token-access helpers were removed. Remaining `fakebackend_helper.ts` is demo-data plumbing only and belongs to Phase 3.5/4 isolation.

3. [ ] Keep bearer token flow for mobile/external clients only.
Scope: token abilities/scopes.
Scope: explicit TTL, rotation, and revocation policy.
Done when: docs and code separate first-party vs external auth paths.

4. [ ] Add high-authority action controls.
Scope: re-auth/step-up for sensitive admin actions.
Scope: audit logging for privileged mutations.
Done when: privileged write paths have policy plus traceability.

5. [x] Optimize `/api/auth/me` for first-party SPA reads.
Scope: avoid unnecessary preflight for read-only current-user requests.
Scope: dedupe duplicate in-flight `/me` calls on SPA boot/navigation.
Done when: `GET /api/auth/me` does not send JSON/XSRF headers and repeated components reuse the same request.
Status: `session_api.ts` uses a read-only Axios client for `/auth/me`; CORS preflight cache is configured through `CORS_MAX_AGE`.

6. [x] Replace template profile/session display code with real session user data.
Evidence: `ProfileDropdown` and `user-profile` display data from `/api/auth/me` through `useProfile`.
Done when: header/profile display comes from the session-auth user state, not Velzon fake-auth storage.
Status: Browser-tested: login, dashboard refresh, profile dropdown, `/profile`, logout, and logged-out dashboard redirect all behave as expected.

## Phase 3.5 - Admin Shell, Localization, and Root-Admin Developer Toolbox
Reason: Phase 4 becomes much cleaner if the admin shell is already clear about language, RTL, persisted theme settings, and which Velzon template pages are real product pages versus root-admin utilities.

1. [x] Register Persian as a first-class admin locale.
Scope: add `fa.json` to `i18n.ts`.
Scope: add Persian to the language dropdown with the Iran flag.
Scope: normalize `fa.json` keys to match the current `en.json`/template key format.
Done when: selecting/defaulting to `fa` translates the current menu labels instead of falling back to English.

2. [x] Make the admin panel RTL-first for the current product direction.
Scope: keep RTL partials active.
Scope: avoid investing in runtime LTR/RTL switching until styles can be properly scoped.
Done when: Persian admin UX is the default supported direction.
Status: Runtime direction radio remains a future cleanup risk because Velzon RTL styles are global.

3. [x] Move admin typography to local fonts.
Scope: register local Persian-friendly fonts.
Scope: remove Google/CDN font imports from active SCSS.
Scope: use Persian stack when `html[lang="fa"]` is active.
Done when: active SCSS has no `fonts.googleapis`, `Poppins`, or `Outfit` dependency.

4. [x] Persist theme customizer settings.
Scope: store validated layout settings in localStorage.
Scope: reload Redux layout state from storage on app boot.
Done when: customizer settings survive browser refresh.
Status: Stored under `nebula.layout.settings`; reset by removing that localStorage key.

5. [ ] Add `root_admin` to the role taxonomy.
Scope: add `RootAdmin = 'root_admin'` to `App\Enums\UserRole`.
Scope: seed the role through `RolesSeeder`.
Scope: decide whether root-admin also receives `admin` or whether policy checks should treat root-admin as admin-equivalent.
Done when: root-admin exists in DB and can be assigned deterministically.

6. [ ] Return frontend-friendly authority data from `/api/auth/me`.
Scope: include roles and, if useful, derived flags such as `is_root_admin`.
Scope: eventually include permissions if we choose permission-based UI gates.
Done when: frontend route/menu filters do not guess authority from hard-coded local state.

7. [ ] Split product admin routes from Velzon utility/demo routes.
Scope: keep real product routes in a panel/admin route group.
Scope: move Velzon UI/forms/charts/tables/icons/maps/template pages into a root-admin developer toolbox route group.
Done when: normal admin routes and root-admin utility routes are visibly separate in source.

8. [ ] Lazy-load root-admin utility/demo routes.
Scope: convert demo/toolbox page imports from static imports to `React.lazy`.
Scope: wrap route rendering in `Suspense` with a small loader.
Done when: normal admin initial bundle does not include charts/maps/icons/forms/template-demo pages.

9. [ ] Hide root-admin toolbox from normal users.
Scope: role-specific menu filtering.
Scope: route guard for `/panel/dev/*` or chosen toolbox namespace.
Done when: non-root-admin cannot see or manually navigate to developer utility pages.

10. [ ] Organize source files so the toybox does not pollute product browsing.
Proposal: `frontend/src/panel/` for product/admin code and `frontend/src/devtools/` for root-admin utilities.
Done when: filemanager/source browsing clearly separates product pages from Velzon reference/demo inventory.

## Phase 4 - Admin and Client UI Boundary Execution
1. [ ] Declare React admin route namespace and ownership.
Proposal: `/panel/*` is canonical admin UI surface.
Evidence: Blade `/admin/*` remains active while the React admin surface is parked for rebuild.
Done when: non-canonical admin UI paths are deprecated, redirected, or explicitly legacy.

2. [ ] Fix React route/auth path drift.
Evidence: The current `frontend/` is a Velzon React-TS Vite template and still contains template routing/auth assumptions, including public auth demo pages and root-level template paths.
Done when: all redirects and links resolve inside the canonical route map.

3. [ ] Consolidate shared frontend API client utilities.
Evidence: `session_api.ts` exists for session auth, while legacy `api_helper`/fake/JWT helpers still remain from the template.
Done when: one typed API client is used by admin and client React apps.

4. [ ] Enforce CSS boundary contract.
Evidence: Locked direction is admin React + Bootstrap, public/client React + Tailwind; admin now has local fonts/RTL foundation, but public/client React is not rebuilt yet.
Done when: admin React uses Bootstrap conventions and public/client React uses Tailwind conventions without leakage.

5. [ ] Make normal admin experience lean.
Scope: keep product admin routes smooth and low-bundle.
Scope: ensure root-admin utilities are lazy-loaded and not part of the normal admin startup path.
Done when: non-root-admin initial load excludes the Velzon developer toolbox.

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
