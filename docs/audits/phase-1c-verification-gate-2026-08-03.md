# Phase 1C Verification Gate - 2026-08-03

## Result

Phase 1C items 9-15 are complete as backend foundations. Final review found and corrected one integration gap: the outbox publisher/dispatcher was verified in isolation but production domain services did not publish their typed intents. Reservation creation, payment-attempt creation, and marketplace tenant-feature override now publish from their existing owning transactions, and focused plus full SQLite/MySQL verification passes.

This closes only Phase 1C. It does not complete Phase 1D, Phase 1E, the product-facing medical/payment workflows, the Vite admin, or the full isolated-tenant product.

## Verification Evidence

- The final SQLite suite passed 186 tests with 950 assertions; the MySQL-only concurrency regression was the one expected skip.
- The final disposable-MySQL suite passed 187 tests with 961 assertions, including the two-process lock-contention regression.
- Focused production outbox integration passed 18 tests with 89 assertions.
- Touched PHP files passed Pint. The final six outbox-integration files separately passed targeted Pint and `git diff --check`.
- Route discovery loaded 104 non-vendor routes.
- MySQL initially exposed a test-only JSON key-order assumption in the tenant-entitlement outbox payload. The test now asserts named fields because JSON object ordering is not semantically meaningful; the focused MySQL rerun passed 5 tests/30 assertions before the clean full-suite result above.
- `checkupino_phase1c_verify` contains the complete 50-table marketplace schema after verification.
- `checkupino_tenant_phase1c_verify` independently passed fresh migration, repeat seed, rollback, re-apply, and reseed across 22 tables.
- The verified tenant seed remains idempotent: one installation, hospital profile, local user, local role, and feature entitlement.
- The tenant schema contains none of the inspected marketplace directory, workplace, reservation, payment-summary, questionnaire, submission, or reservation-file tables.

## Item 9 - Directory, Monitoring, Subscription, And Entitlements

- Marketplace directory hospitals remain separate from monitored `tenant_instances`.
- `TenantFeatureGate` validates signed Ed25519 entitlements and fails closed for disabled, expired, future-issued, tampered, unknown-key, and ambiguous-installation states.
- Root-admin registry and feature-override mutations use policies, recent session password confirmation, required reasons, row locks, and transactional marketplace audit.
- The heartbeat endpoint authenticates signed timestamped requests, rejects replays and non-allowlisted operational/business/medical fields, and stores only sanitized health/version data.
- Marketplace controls record authoritative subscription metadata and desired report-feature overrides without receiving tenant operational-data access. A feature override now emits `tenant.entitlement.changed` delivery intent; it does not cross-write or automatically activate the tenant database. The tenant activates only a separately delivered, signed, locally cached effective entitlement.

## Item 10 - Scoped Settings

- `SettingsRegistry` owns known keys, types, rules, defaults, sensitivity, and allowed scopes.
- `SettingsResolver` applies explicit marketplace and tenant precedence.
- Marketplace and tenant mutation services enforce scope, authority, reason, validation, secret-reference rules, entitlement intersection, row locking, and fail-closed audit in the owning database.

## Item 11 - Public Media And Private Files

- Public media uses an explicit public attachment service and image-only availability rules.
- Reservation medical files use the private disk, opaque paths, server-owned metadata, MIME/extension/size checks, SHA-256 checksums, quarantine, scan transitions, policy-protected access, replacement, archive, retention, and audit.
- Unscanned, infected, expired, archived, unauthorized, or public-disk medical files fail closed.
- The doctor-request/patient-upload/review/report workflow remains Phase 1E item 19.

## Item 12 - Audit And Step-Up

- Sensitive subjects use explicit snapshot allowlists with recursive secret/PII/medical redaction as defense in depth.
- Existing privileged doctor verification, catalog, questionnaire/submission, tenant setting/feature, reservation override, and payment-adjustment paths have policy, session-backed recent-password, reason where required, and transactional fail-closed audit coverage.
- Bearer-only password step-up remains intentionally unsupported.

## Item 13 - API Contract

- The compatibility-safe API contract adds version/correlation metadata without moving existing routes.
- Representative writes use Form Requests and representative reads use explicit Resources.
- Pagination is capped, filters/sorts are allowlisted, money is serialized as amount/currency, and sensitive contact, NID, medical-answer, scoring-rule, and internal identifier fields are excluded from the covered resources.
- Sanctum session, bearer-token, CSRF, CORS, ownership, and validation regressions remain green.

## Item 14 - Integrations And Background Work

- Provider-neutral payment, message, push, and outbox transport contracts exist without choosing vendors or credentials.
- `OutboxPublisher` writes typed sanitized events on the selected marketplace or tenant connection. Reservation creation, payment-attempt creation, and marketplace tenant-feature changes call it inside their owning production transactions with rollback coverage.
- `OutboxDispatcher` owns idempotent claiming, stale-lease recovery, retry/backoff, terminal failure, and status counts.
- User-sensitive jobs recheck account state at execution time.

## Item 15 - Payment, Money, And Holds

- Enums and services own payment summary, attempt, provider-event, adjustment, reservation override, and hold-expiration transitions.
- Callback signatures and external event IDs are verified before canonical state changes; duplicate events are idempotent and late/competing successes reconcile.
- Refund/void requests reserve server-owned amounts but do not pretend a provider-side refund has executed.
- Reservation confirmation, canonical success, adjustments, overrides, and expiry use locked transactions.
- A scheduled idempotent job expires overdue holds; payment retries do not extend holds; booking applies per-user active-hold caps and authenticated user/device/IP throttles.
- `PaymentLifecycleMySqlConcurrencyTest` deterministically holds the payment-summary row in one process, starts a competing callback in another, proves the contender waits for the MySQL lock, and verifies one success plus one reconciliation.

## Preserved Boundaries

- No monitoring dashboard, subscription billing workflow, provider SDK, live credential, tenant operational-data bridge, or frontend surface was added.
- The isolated tenant remains a minimal local profile/authority/settings/entitlement/audit/outbox foundation, not a duplicate of marketplace operations.
- File primitives do not claim the Phase 1E medical workflow.
- Payment foundations do not claim provider checkout, appointment completion, rating triggers, or executed refunds/voids.
- Phase 2 must not treat frontend visibility as authorization; backend policies and services remain authoritative.
