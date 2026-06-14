# ADR-0001: UI Surfaces, Auth Modes, and Role Authority

Status: Accepted
Date: 2026-05-03
Implementation status updated: 2026-06-14

## Context
The project drifted into a mixed architecture:
- Blade and React both used for admin-like surfaces.
- Role authority split between a legacy `users.role` field and Spatie role tables.
- SPA auth behavior drifting between session/cookie and bearer token patterns.

This drift caused duplicated logic, inconsistent enforcement, and fragile behavior.

## Decision
1. Admin panel UI is React + Bootstrap.
2. Client/public UI is React + Tailwind.
3. Spatie roles/permissions are the sole authorization source of truth.
4. First-party web SPA/PWA uses Sanctum Session/Cookie authentication.
5. Mobile/external clients use bearer tokens with TTL/rotation/revocation policy.

## Current Implementation Status
1. Role source-of-truth migration:
- Complete for the active schema and runtime authority path.
- `users.role` has been dropped.
- Runtime roles are `admin`, `doctor`, and `patient`.
- Role names are centralized in `App\Enums\UserRole`.

2. UI boundary migration:
- Partially complete.
- Blade remains active for current admin/doctor/web surfaces.
- `frontend/` is currently a Velzon React-TS template migrated to Vite.
- The active React admin shell has session-cookie auth, Persian/RTL defaults, local font loading, and persistent theme settings.
- `/panel/*`, role-specific menus, root-admin utilities, and normal-admin bundle trimming still need canonical implementation.

3. Auth-mode migration:
- Partially complete.
- Bearer token auth exists for API/mobile-style clients.
- First-party browser SPA auth is wired through Sanctum session/cookies in `frontend/src/helpers/session_api.ts`.
- Browser-tested flow: CSRF cookie, JSON login, `/api/auth/me`, dashboard refresh, profile display, logout, and logged-out redirect.
- Mobile/external bearer token policy still needs TTL, rotation, revocation, and documentation.

## Consequences
### Positive
- Clear ownership boundaries for UI and styling systems.
- Reduced split-brain behavior in authorization.
- Stronger browser security posture for first-party SPA once cookie/session auth is implemented.
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
- Any high-authority mutation should include step-up controls through policy, re-auth, and audit logging.
- API payload keys named `role` must be computed from Spatie roles, never from a users table column.

## Acceptance Signals
- No authorization decision depends on `users.role`.
- First-party SPA auth works end-to-end via Sanctum session/cookie.
- Mobile/external token auth remains supported and documented.
- Admin/client style boundaries are explicit and enforced by conventions.
