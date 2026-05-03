# ADR-0001: UI Surfaces, Auth Modes, and Role Authority

Status: Accepted
Date: 2026-05-03

## Context
The project has drifted into a mixed architecture:
- Blade and React both used for admin-like surfaces.
- Role authority split between `users.role` and Spatie role tables.
- SPA auth behavior drifting between session/cookie and bearer token patterns.

This drift causes duplicated logic, inconsistent enforcement, and fragile behavior.

## Decision
1. Admin panel UI is React + Bootstrap.
2. Client/public UI is React + Tailwind.
3. Spatie roles/permissions are the sole authorization source of truth.
4. First-party web SPA/PWA uses Sanctum Session/Cookie authentication.
5. Mobile/external clients use bearer tokens with TTL/rotation/revocation policy.

## Consequences
### Positive
- Clear ownership boundaries for UI and styling systems.
- Reduced split-brain behavior in authorization.
- Stronger browser security posture for first-party SPA (cookie/session over localStorage bearer tokens).
- Cleaner API client separation for first-party vs external consumers.

### Tradeoffs
- Requires deliberate migration from mixed auth usage in current React pages.
- Requires deprecating runtime reliance on `users.role`.
- Requires additional docs/testing to enforce dual auth-mode correctness.

## Alternatives Considered
1. Keep Blade admin as canonical:
- Pros: lower immediate migration effort.
- Cons: conflicts with product decision and front-end direction.

2. Full bearer tokens for first-party SPA:
- Pros: familiar for API-first apps and mobile patterns.
- Cons: higher token theft risk in browser contexts; additional client-side token handling complexity.

3. Permanent hybrid (Blade + React admin surfaces):
- Pros: flexibility in short term.
- Cons: highest long-term drift risk and duplicated business/UI logic.

## Implementation Notes
- Route and build boundaries must reflect this ADR.
- Authorization checks must be role-based via Spatie middleware/policies.
- Any high-authority mutation should include step-up controls (policy + re-auth/audit).

## Acceptance Signals
- No authorization decision depends on `users.role`.
- First-party SPA auth works end-to-end via Sanctum session/cookie.
- Mobile/external token auth remains supported and documented.
- Admin/client style boundaries are explicit and enforced by conventions.

