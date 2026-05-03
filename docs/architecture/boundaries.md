# Architecture Boundaries

Date: 2026-05-03
Source of truth: ADR-0001

## Surface Ownership
1. Admin UI surface:
- Stack: React + Bootstrap
- Namespace: `/panel/*` (canonical admin web UI)

2. Client/public UI surface:
- Stack: React + Tailwind
- Namespace: public-facing routes/pages

3. Legacy Blade:
- May exist during migration.
- Not the target UI surface for new admin/client features.

## Auth Boundaries
1. First-party web SPA/PWA:
- Auth mode: Sanctum Session/Cookie
- Browser flow: CSRF + session-authenticated requests

2. Mobile/external consumers:
- Auth mode: Bearer tokens
- Policy: TTL, rotation, and revocation required

3. High-authority actions:
- Require server-side policy checks.
- Should include step-up controls where appropriate.

## Authorization Boundaries
1. Spatie roles/permissions are authoritative.
2. `users.role` is not an authority input for permission decisions.
3. Route-level and policy-level checks must align with Spatie roles.

## Domain Logic Boundaries
1. Controllers are orchestration layers, not business-rule sources.
2. Shared domain services must contain reusable business rules.
3. Web and API surfaces must call the same domain decision logic.

## Style/System Boundaries
1. Admin React components use Bootstrap classes and design system.
2. Client/public React components use Tailwind utility strategy.
3. Cross-surface style leakage is disallowed by convention.

## API Contract Boundaries
1. API response shape should be standardized across controllers.
2. Client parsers should not rely on endpoint-specific ad-hoc payload structures.

