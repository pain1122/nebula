# Foundation Verification Gate - 2026-07-19

## Result

The rebuilt marketplace baseline and isolated tenant foundation pass the Current Task item 8 verification matrix on disposable SQLite and MySQL databases.

This closes the foundation-baseline implementation slice. It does not complete the remaining Phase 1 product-correctness work listed in `docs/TODO.md` items 9-20.

## Changes Required By Verification

- Normal administrators could create or assign the `admin` role even though root-admin-only admin identity management was locked. `app/Http/Controllers/Api/Admin/UserController.php` now hides admin identities from normal admins and restricts admin creation/update to root-admin.
- Marketplace migration lifecycle tests left a partial schema when the complete suite used persistent MySQL. Each marketplace lifecycle test now restores the full baseline during teardown.
- `.env.production.example` used localhost Sanctum defaults, omitted the CORS origin, and did not require secure session cookies. It now contains explicit HTTPS replacement placeholders and secure cookie settings.

## Security Regression Coverage

- Normal admin cannot list, show, create, or update marketplace admin identities; root-admin can manage admins.
- A patient receives a not-found response when attempting to cancel another patient's reservation.
- Client-supplied reservation owner, tenant, status, and price fields cannot override server-owned values.
- `/api/auth/me` returns only its explicit safe identity allowlist.
- Suspended accounts lose bearer tokens and their active browser session is invalidated on the next authenticated request.
- The Sanctum CSRF-cookie endpoint permits the configured credentialed origin and does not reflect an unknown origin.
- Stateful writes reject missing CSRF tokens and accept matching session/header tokens.
- Recursive audit redaction continues to remove secrets, phone/NID-class PII, and medical/questionnaire payloads.

## SQLite Verification

- Full backend suite: 106 tests, 575 assertions passed.
- Marketplace migration groups: fresh apply, rollback, reapply, and complete-schema restoration passed.
- Minimal tenant foundation: isolated migrate, rollback, reapply, and repeat seed passed.
- Marketplace seed graph and tenant seed graph remained idempotent.
- Touched PHP files pass Pint.
- Route loading passed with 99 non-vendor routes.

## MySQL Verification

- Disposable marketplace database `checkupino_verify`: 24 migrations fresh-applied and seeded, seeded a second time, fully rolled back, reapplied, and reseeded.
- Disposable tenant database `checkupino_tenant_verify`: 6 migrations fresh-applied, seeded twice, fully rolled back, reapplied, and reseeded.
- Full backend suite against MySQL: 106 tests, 575 assertions passed.
- Verified unique indexes include doctor/workplace ownership, reservation booking idempotency, one payment summary per reservation, provider attempt idempotency/reference, tenant domain, and public identifiers.
- Historical reservation, payment-summary, note, file, and questionnaire-submission relationships use `RESTRICT` or `SET NULL`; no destructive historical cascade was found in the inspected paths.
- Tenant schema contains 22 tables and no marketplace hospital, reservation, or payment tables. Marketplace schema contains 49 tables.

## Formatting Status

Pint passes for every PHP file changed by this verification slice. Repository-wide `pint --test` still reports 65 pre-existing style issues in untouched files, so the roadmap-wide formatting checkbox remains open instead of expanding this security verification into a 65-file formatting rewrite.

## Remaining Phase 1 Work

- Complete booking duration, hold-expiration, rescheduling, and lifecycle behavior.
- Implement verified payment callbacks and explicit override/refund policy.
- Complete questionnaire throttling/anti-automation and stored-HTML policy.
- Implement the private medical file/report vertical slice.
- Finish audit, step-up, and policy coverage for remaining high-authority mutation families.
- Complete shared settings/media/API/integration runtime behavior beyond the verified baseline schemas and contracts.
