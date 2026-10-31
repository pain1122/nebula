# ADR-0001: UI Surfaces, Auth Modes, and Role Authority

Status: Accepted
Date: 2026-05-03
Implementation status updated: 2026-10-04

## Context
The project drifted into a mixed architecture:
- Blade and React both used for admin-like surfaces.
- Role authority split between a legacy `users.role` field and Spatie role tables.
- SPA auth behavior drifting between session/cookie and bearer token patterns.

This drift caused duplicated logic, inconsistent enforcement, and fragile behavior.

## Decision
1. Authenticated admin, doctor and patient panel UI is the existing Velzon React + Bootstrap framework. Each role sees its permitted navigation and workflows; backend policies remain authoritative. This October 4 user decision supersedes the previous client/public grouping for authenticated patients.
2. Public SEO and subscription/plans pages remain separate from the authenticated panel and are excluded from the demo. Their later React + Tailwind work does not block the golden flow.
3. Spatie roles/permissions are the sole authorization source of truth.
4. First-party web SPA/PWA uses Sanctum Session/Cookie authentication.
5. Mobile/external clients use bearer tokens with TTL/rotation/revocation policy.

## Current Implementation Status
1. Role source-of-truth migration:
- Complete for the active schema and runtime authority path.
- `users.role` has been dropped.
- Runtime roles are `root-admin`, `admin`, `doctor`, and `patient`.
- Role names are centralized in `App\Enums\UserRole`.

2. UI boundary migration:
- Partially complete.
- Relevant Blade/resources workflows are being migrated into role-specific versions of the established panel. Retain unmigrated sources until their replacement passes acceptance; no template deletion or broad resource rewrite is authorized.
- `frontend/` is the active Velzon React-TS/Vite panel with one /panel basename, session cookies, the existing language flag/direction ownership, local fonts and retained theme/layout controls.
- Admin login/home/users/create/edit and root-only lazy `/panel/dev/*` are deployed and verified. October 4 also delivers patient booking/own reservations and doctor assigned reservations with shared session, role-specific landing/menu/guards and deployed browser acceptance. Evidence: `../deployment/demo-role-booking-2026-10-04.md`; payment/medical/questionnaire/full golden-flow acceptance remains separate.
- All versions share the existing transport, auth authority, query/cache and manifest contracts, with role-gated routes/navigation and backend-owned authorization. CI, portability and toolbox disposition remain separately deferred.

3. Auth-mode migration:
- Partially complete.
- Bearer token auth exists for API/mobile-style clients.
- First-party browser SPA auth is wired through Sanctum session/cookies in `frontend/src/helpers/session_api.ts`.
- Browser-tested flow: CSRF cookie, JSON login, `/api/auth/me`, dashboard refresh, profile display, logout, and logged-out redirect.
- Mobile/external bearer tokens have server-timed TTL, refresh/rotation, current-token logout/revocation, and expiry metadata. Device/push ownership and later mobile-product policy remain Phase 6.

## Consequences
### Positive
- Clear ownership boundaries for UI and styling systems.
- Reduced split-brain behavior in authorization.
- Stronger browser security posture through the implemented first-party Sanctum cookie/session boundary.
- Cleaner API client separation for first-party vs external consumers.

### Tradeoffs
- Requires deliberate migration from mixed auth usage in current/parked React pages.
- Requires ongoing docs/testing so role and auth boundaries do not drift again.
- Requires accepting that Blade remains a transition surface until the React admin/client rebuild is ready.

## Alternatives Considered
1. Keep Blade admin as canonical:
- Pros: lower immediate migration effort.
- Cons: conflicts with product decision and front-end direction.

2. Full bearer tokens for first-party SPA:
- Pros: familiar for API-first apps and mobile patterns.
- Cons: higher token theft risk in browser contexts; additional client-side token handling complexity.

3. Permanent hybrid with Blade and React admin surfaces:
- Pros: flexibility in short term.
- Cons: highest long-term drift risk and duplicated business/UI logic.

## Implementation Notes
- Route and build boundaries must reflect this ADR.
- Authorization checks must be role-based via Spatie middleware/policies.
- Named high-authority mutations use verified policy, recent session-backed password confirmation, reason, transaction, and fail-closed audit boundaries as applicable.
- API payload keys named `role` must be computed from Spatie roles, never from a users table column.

## Acceptance Signals
- No authorization decision depends on `users.role`.
- First-party SPA auth works end-to-end via Sanctum session/cookie.
- Mobile/external token auth remains supported and documented.
- Admin/client style boundaries are explicit and enforced by conventions.
- Phase 2 must prove canonical product routing, normal/root navigation, build/type quality, bundle isolation, and reusable-core portability before the React admin becomes canonical.
