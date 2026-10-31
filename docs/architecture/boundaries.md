# Architecture Boundaries

Last reconciled: 2026-08-26
Source of truth: ADR-0001
Implementation status: Phase 1A-1E backend work, verification, and documentation gates are complete. Phase 2 planning is active. Active frontend SPA session auth and the root-admin toolbox route boundary are wired, but the product Vite admin is not yet canonical.

## Surface Ownership
1. Admin UI surface:
- Target stack: React + Bootstrap.
- Target namespace: `/panel/*`.
- Current state: Blade `/admin/*` remains active during migration.

2. Client/public UI surface:
- Target stack: React + Tailwind.
- Target namespace: public-facing routes/pages.
- Current state: root Blade/public routes remain active during migration.

3. Legacy/current Blade:
- May exist during migration.
- Is still the primary runtime for several web surfaces.
- Should not receive new long-term-only admin/client architecture unless explicitly accepted.

4. Parked React workspace:
- `frontend/` currently contains a Velzon React-TS template migrated to Vite.
- Active browser auth uses Sanctum session cookies through `session_api.ts`.
- Root-admin demo/toolbox routes are lazy and role-gated under `/panel/dev/*`. An internal framework-neutral core/module contract and additive product registry are validated, but the active product router still uses `/dashboard` and `/profile`; the workspace is not canonical until the approved `/panel/*` registry is activated and later design, bundle, delivery, and portability gates pass.

## Auth Boundaries
1. First-party web SPA/PWA:
- Target auth mode: Sanctum Session/Cookie.
- Browser flow: CSRF bootstrap plus session-authenticated requests.
- Status: active admin shell flow is wired and browser-tested.
- Current frontend flow: `/sanctum/csrf-cookie` -> JSON `POST /login` -> `/api/auth/me`; logout uses JSON `POST /logout`.
- Browser admin auth must not store bearer tokens in `localStorage` or `sessionStorage`.

2. Mobile/external consumers:
- Auth mode: Bearer tokens.
- Status: server-timed TTL, login/register issuance, authenticated refresh/rotation, current-token logout/revocation, and expiry metadata are implemented. Device/push ownership and broader mobile policy remain Phase 6.

3. High-authority actions:
- Require server-side policy checks.
- Named privileged mutation routes require recent session-backed password confirmation where specified by the verified route contract.
- Reasoned state mutations and allowlisted audit records share the owning transaction and fail closed for the verified Phase 1 authority families.

## Authorization Boundaries
1. Spatie roles/permissions are authoritative.
2. `users.role` is not an authority input and has been removed from the active schema.
3. Role names must come from `App\Enums\UserRole`.
4. Route-level and policy-level checks must align with Spatie roles.
5. API role middleware must specify the Sanctum guard where appropriate.

## Domain Logic Boundaries
1. Controllers are orchestration layers, not business-rule sources.
2. Shared domain services must contain reusable business rules.
3. Web and API surfaces must call the same domain decision logic.
4. Booking eligibility uses active `doctor_workplace_checkup` membership inside a selected active doctor workplace; the removed `checkup_doctor` pivot is not authoritative.
5. Reservation creation accepts only exact service-specific ranges declared by the doctor and resolved by the scheduling domain; patient-supplied ends, durations, and money are never authoritative.

## Data Boundaries
1. `users` stores account identity, contact fields, login credentials, and nullable `patient_status`.
2. `user_profiles` stores medical profile details such as blood type, allergies, chronic diseases, and emergency contact data.
3. `leads` stores anonymous or unconverted public captures, including questionnaire-origin metadata.
4. Roles are stored only in Spatie permission tables.

## Style/System Boundaries
1. Admin React components use Bootstrap classes and design system.
2. Client/public React components use Tailwind utility strategy.
3. Cross-surface style leakage is disallowed by convention.
4. Current Blade surfaces can keep their existing root Vite/Tailwind conventions during migration.
5. Persian is the default authoring language for every newly designed worded admin element. Product language is the only direction authority: `fa` applies RTL and `en` applies LTR, with no independent direction preference. Persian uses ordinary standards-based RTL (`lang`/`dir`, semantic order, Bootstrap RTL, and logical CSS properties); English/LTR remains supported. The current Velzon RTL layout is broken and unverified, so later product-shell work must repair and visually prove the selected foundation rather than treating the template as accepted behavior.
6. Color preference is independent of locale/direction. System is the default; explicit Light/Dark is device-scoped and persists across reload/logout until the user returns to System.

## API Contract Boundaries
1. New API responses use the v1 envelope/resource contract; legacy compatibility fields remain additive until an explicit v2 migration.
2. Client parsers should not rely on endpoint-specific ad-hoc payload structures.
3. Public questionnaire definition/submission endpoints use explicit resources/validation, hide scoring internals, sanitize stored HTML, and have envelope, tamper, recommendation, and throttle coverage.
