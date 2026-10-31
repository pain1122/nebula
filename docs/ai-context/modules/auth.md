## Verification Status

October18 approved clinical onboarding/location slice is deployed on healthy c1173c97/70 assets, retained checkupino-admin:clinical-onboarding-accepted-2026-10-18; c3458981 is the static rollback. Admin/root get role-fixed doctors/new, patients/new and hospitals list/new/public-ULID detail pages, entered from existing directories/grouped People navigation; Staff stays root-only. Labels say Hospitals/Clinics, with numeric filters explicitly identifying doctor-location associations. Manual doctor creation now creates a real profile/specialty and pending verification unless the creating admin/root explicitly verifies it. Identity/password inputs are never returned or available for support editing. Doctors select active hospitals/clinics and personally offered services/prices on their existing profile, then maintain separate days/shifts/rest per location. Organization records have no price; new-slot fallback is doctor shift/service price then profile fee. Existing slots/bookings/money stay unchanged. Ownership/revision/reason/confirmation/password/atomic audit, exact price before-after snapshots and uncertain/session guards remain. Full UI76/790 plus final transport-related179/PHP18/164+legacy31/385+audit9/75 pass. Same-image20-cohort ENFA1440/390 acceptance combines eight passed admin groups with the13-group doctor/patient delta:293 tracked requests/56 captures; all current/protected hashes/two jobs preserved. Prior helper query-path bug and harness failures are retained and superseded. Nine services run; helpers/scanner remain stopped. No live onboarding/profile/schedule save, credential replacement, dependency/schema/env change or backend Compose. Read ../../deployment/clinical-onboarding-locations-2026-10-18.md and immutable clinical-onboarding acceptance. Live positive saves, new-writer MySQL concurrency/lifecycle and current scanner/media gates remain separate.

October18 doctor/booking usability follow-up is deployed on healthy b1fae6ee/66 assets, retained checkupino-admin:doctor-panel-accepted-2026-10-18. Doctors get the retained calendar for their own CONFIRMED canonical-paid appointments only (explicit user choice; completed/pending/cancelled/expired excluded), plus visible own professional/weekly-workplace controls on existing /panel/profile and its care submenu. Active specialties/experience/bio/profile fee and day/service/window/break/effective-date/price rules use current ownership/revision/password/reason/confirmation/atomic-audit safeguards; booked slots/money and verification decisions are preserved. Existing /panel/book is a four-stage service/description -> real doctor cards -> locations -> times wizard, with filters, Back/Next/breadcrumbs/summary and unchanged idempotent booking. Active menus have an obvious primary background. Customizer introduction is once per account/browser, then manual knob (mobile/keyboard too); cross-device persistence remains separate. Photo initials/unavailable ratings are honest placeholders, with avatar/rating publication deferred. Full source74/759 and final affected80/PHP8/83 plus targeted canonical/calendar/privacy deltas, 20-cohort functional matrix and eight-cohort visual delta pass. Current/protected hashes and two pending medical-scan jobs are unchanged; nine services run and helpers/scanner remain stopped. No live business save, password confirmation, download, backend Compose, dependency/schema/credential change or completed replay. Read ../../deployment/doctor-panel-booking-wizard-2026-10-18.md and its immutable acceptance for the corrected registry adapter, retained failures, validation and rollback.

October18 user-requested patient questionnaire history and grouped navigation are deployed on healthy a3f0286a/65 assets, retained checkupino-admin:questionnaire-history-accepted-2026-10-18. Existing /panel/my/questionnaire uses Available/My submissions tabs and public-ULID query-selected saved answers/version/score/result; owner-only fresh-authority GET readers exclude contacts/tokens/other accounts, preserve snapshots after definition changes/archive and enforce answer retention/no-store/current-session identity. Existing Velzon submenus group related appointments/questionnaires/people/catalog/root settings; active detail/query leaves, mobile controls and root-only Staff/settings boundaries remain. Full frontend72/746, final affected23, isolated PHP7/78/Pint3 and four-role16-cohort native matrix plus final patient direction delta pass. All current business/finance/schedule/catalog/protected/audit/outbox hashes stay unchanged, including two pending medical-scan jobs. Nine services run; scanner/parser/checker/worker stay stopped. No new panel URL/dependency/schema/backend Compose or business save. Live profile/admin saves, current engine/continuous processing and thumbnail publication remain separate. Read ../../deployment/questionnaire-history-navigation-2026-10-18.md and its immutable acceptance binding.

Latest October17: patient/doctor login/fallback now lands at existing `/panel/`, where role dispatch renders only that account's clinical dashboard. Admin/root reports and all other administrative routes retain their existing guards. Display-name editing uses the shared modal; password confirmation temporarily replaces it and cancellation preserves the form draft. Names-only payload/revision/reason/password/session/uncertain-delivery safeguards remain. Full72/740/current83/layout19 and four-role ENFA desktop/mobile acceptance pass; existing index/history/gateway/session authority unchanged. [Current evidence](../../deployment/clinical-experience-2026-10-17.md). Successful live profile saving remains personally deferred.

October17 session-history privacy correction accepted: app entry installs modules/checkupino/auth/history.ts. Persisted pagehide hides the app root before retention; persisted pageshow keeps it hidden and reloads through ordinary server-session bootstrap. Fresh loads and normal navigation remain visible. No authority/gateway/role/credential/cookie/backend rule change. Five lifecycle plus retained authority/query-cache tests pass22 checks; full71/733/current5 and remaining quality gates pass. Finalc6 native24 access groups/78 requests observe an actual persisted medical restore with rootHidden=true, then login/server401; final16 ENFA/role/width smoke cohorts pass. [Proof and rollback limits](../../deployment/panel-release-rehearsal-2026-10-17.md). Use fresh panel tabs after deployment; pre-guard cached documents/images are outside this privacy acceptance. Live/profile saves remain deferred; no business write or protected login.

Historical full backend baseline verified: 2026-08-16
Verification method:
- repo inspection
- full SQLite backend suite: 304 tests, 1,796 assertions with three expected MySQL-only skips
- focused item-20 identity tests: 19 tests, 106 assertions
- combined named high-authority regressions: 124 tests, 780 assertions
- route contract: 21 named mutations plus the no-bulk assertion, 22 tests and 127 assertions
- item-20 touched-file Pint and `git diff --check`
- user-confirmed full disposable-MySQL Phase 1 suite: 307 tests, 1,816 assertions
- Admin create/edit browser step-up is verified on 2026-10-02: cancellation, wrong-password rejection, successful confirmation/retry, privileged reasons, safe resources and audit records. Evidence: `docs/deployment/demo-user-mutations-acceptance-2026-10-01.md`; this does not rerun the historical full backend audit.

If this file conflicts with source code, source code wins.
Update this module after verification.

# Auth And Authority Context

Use this module for auth, roles, Sanctum, login/logout, `/api/auth/me`, user profile authority, `root-admin`, or route/menu authorization.

Do not load payment, booking, doctor-reporting, or notification modules for a pure role-taxonomy task.

## Current State

- October16 user reserves `/panel/users` for staff and explicitly defers the content-manager role/permissions. The existing page/sidebar is root-only and uses new `GET /api/admin/staff`: current active root before/after reads, admin-only rows, mixed clinical/root exclusion, role-override refusal and private/no-store metadata. Clinical directories retain their existing `/api/admin/users?role=patient|doctor` API and authorized metadata support profiles at `/panel/users/:userId`; profile Back resolves their internal clinical directory. Staff create UI restricts the existing guarded identity form to admin, with no live save, new role, migration or permission assignment. Isolated32/341/Pint3 and frontend full70/728/all quality pass; served/native scope and rollback: [staff directory](../../deployment/staff-directory-2026-10-16.md). Earlier general-directory UI notes are historical; existing clinical API authority is preserved.

- October13 owner/support profiles deployed/accepted on healthyf6a0de92/50 assets, retained as checkupino-admin:user-profile-accepted-2026-10-13; priora5b45485/RTL/demo rollback preserved. Exact /panel/profile and /panel/users/:userId public-ULID URLs explicitly approved. Directory Edit opens the shared owner card/grid; header opens self; inline names-only edit keeps fresh revision/reason/password/under-lock authority/fail-closed audit/cancel/uncertain/session guards. Support returns only status/date/count/activity metadata; identity/credentials/clinical contents hidden. Legacy user and related doctor/reservation/questionnaire contact read/search/sort/update bypasses closed; root safe lifecycle/role ownership preserved. PHP43/343 plus related30/442, frontend60/492/focused16+9/all quality/unchanged ratchets/Pint/readiness14 pass.50 assets/11 role groups/21 actual-pointer groups98 requests/desktop-390px mirror/current activity-contact captures3 groups20 requests pass; medical upload events map compatibly to the attachment category. Twelve services/idle worker/jobs0/both sockets/completed-protected fingerprints preserved; no live profile/business write or scanner operation. Positive live admin writes remain a separate guarded checkpoint. Read ../../deployment/user-profile-acceptance-2026-10-13.md and immutable proof; rollback override quiet-valid, not executed.

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
- Normal admins also cannot list, show, create, assign, or update `admin` identities; root-admin alone manages marketplace admins through the current admin-user API.
- Admin identity creation/promotion/update/demotion is root-admin-only through `UserPolicy` and `AdminIdentityService`; it requires recent session password confirmation, a non-empty reason, transaction ownership, and fail-closed audit.
- Admin-created identities require a confirmed 15-64 character password and reject a local baseline of common/account-derived choices. There is no fallback password, generated credential response, plaintext resource/audit field, or general user-update password path.
- The delivered admin create popup generates a multi-word suggestion locally with a cryptographically secure RNG, permits override, and submits only the final confirmed value. Passwords stay outside Redux/cache/storage; edit never sends password fields. No backend suggestion endpoint, invitation provider, clipboard behavior or plaintext credential response was added.
- The local blocklist is a Phase 1 baseline, not a claim of production NIST conformance. A production breached-password corpus/provider and MFA remain separate explicit security/provider decisions.
- API admin user create/update writes fail-closed audit rows to one shared DB-backed `audit_events` table in the same transaction as the user mutation.
- `audit_events.batch_id` is nullable and reserved for future bulk-action grouping; single-record audit events leave it null.
- Audit events are written from Laravel application code, not DB triggers.
- Successful admin user mutations write allowlisted audit events; audit failure rolls back create and update. Denied/failed-attempt telemetry remains separate from the mutation audit.
- API admin user create/update requires recent session-backed password confirmation through `/api/auth/confirm-password`.
- Step-up state is stored in the Laravel session as `auth.password_confirmed_at`.
- The high-authority step-up timeout is `AUTH_HIGH_AUTHORITY_PASSWORD_TIMEOUT`, default 900 seconds.
- `password.confirmed.recent` returns JSON `423` when confirmation is missing or expired.
- Bearer-token callers cannot satisfy high-authority step-up because confirmation must be session-backed.
- API routes only receive a Laravel session for Sanctum stateful first-party requests; token-authenticated Sanctum requests do not have session state.
- Questionnaire and questionnaire-submission admin archives are soft-delete, reasoned, stepped-up, audited, and covered by rollback tests.
- Future bulk admin/root-admin role upgrades should be rejected outright; future bulk deletes require soft-delete behavior, step-up, and per-subject audit rows sharing one `batch_id`.
- Checkup/checkup-category archive is the second privileged family covered by policy, recent session password confirmation, and fail-closed audit. Category child detach/reassignment writes one event per child plus the category event under one shared `batch_id`.
- HTML catalog step-up uses named safe GET confirmation routes so password confirmation never tries to replay a destructive request as GET; API step-up continues returning JSON `423` even without an explicit Accept header.
- `/api/auth/me` currently returns `id`, `name`, `email`, `roles`, and optional `doctor_profile`.
- `/api/auth/me` should remain role-name-only for this slice; derived authority booleans wait for a concrete frontend route/menu contract.
- Browser admin auth must not store bearer tokens in `localStorage` or `sessionStorage`.
- Marketplace users now have public ULIDs and an authentication-level `active`/`suspended`/`closed` state separate from patient lifecycle state.
- Web/API login rejects inactive users. Authenticated routes apply `account.active`; it revokes Sanctum tokens and invalidates the current browser session for suspended/closed users.
- `PUT /api/admin/users/{user}/account-state` is root-admin-only, rejects root-admin targets, requires recent session-backed password confirmation plus a reason, and allows `active -> suspended|closed` and `suspended -> active|closed`; closed accounts cannot reopen.
- Account-state mutation, metadata, all-token deletion, all database-backed browser-session deletion, and audit creation share one transaction. Runtime session-driver drift away from the default database connection fails closed.
- Database-backed sessions are the canonical browser-session strategy in development, testing, and production templates; Redis remains available for cache and queues.
- Future queued work acting for a user must extend `App\Jobs\UserSensitiveJob`, whose final middleware reloads account state at execution time and skips inactive or deleted users.
- `/api/auth/me` uses an explicit safe-field allowlist, and the verification suite covers browser-session invalidation plus allowed/unknown CORS origins and matching/missing CSRF tokens.
- `.env.production.example` requires replacement HTTPS origins and secure, HTTP-only session cookies.

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
- `app/Services/AccountStateService.php`
- `app/Services/AdminIdentityService.php`
- `app/Rules/NotCommonPassword.php`
- `app/Policies/UserPolicy.php`
- `app/Services/BrowserSessionRevoker.php`
- `app/Jobs/UserSensitiveJob.php`
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

```powershell
docker compose exec app php artisan test
docker compose exec app php artisan route:list --except-vendor
docker compose exec db mysql -ucheckupino -pcheckupino_pass checkupino -e "SELECT id, name, guard_name FROM roles ORDER BY name;"
```

Focused local checks for the audit and step-up slice:

```bash
docker compose exec app php artisan test --filter=AdminUserAuditTest
docker compose exec app php artisan test --filter=AdminUserStepUpTest
docker compose exec app php artisan test --filter=AdminQuestionnaireSoftDeleteTest
docker compose exec app php artisan test --filter=AuthTokenTest
docker compose exec app php artisan test --filter=CatalogDestructiveDataSafetyTest
docker compose exec app php artisan test --filter=AdminAccountStateTest
docker compose exec app php artisan test --filter=AccountStateServiceTest
docker compose exec app php artisan test --filter=UserSensitiveJobTest
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
- `docs/TODO.md` only if the active roadmap order or gate changes; do not reopen completed Phase 1 items for ordinary maintenance.
- This module for durable auth/authority facts.
- ADR or `docs/architecture/boundaries.md` only for durable architecture decisions.
