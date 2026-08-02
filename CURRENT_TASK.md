# CURRENT_TASK.md

Snapshot date: 2026-08-03

## Status

Phase 1D is complete as an architecture-contract gate. It reserves the ownership, lifecycle, security, and extension boundaries needed by six later feature families without creating speculative tables, models, routes, controllers, provider adapters, or UI.

Canonical contract: `docs/architecture/phase-1d-future-feature-extension-contract.md`.

Phase 1C remains complete and verified. Its code-level learning material is preserved in `docs/reports/phase-1c-code-learning-report-2026-08-03.md`.

Phase 1 is still active because Phase 1E items 16-20 remain open. Phase 2 and the parked Vite admin are not current work.

## Completed Objective

Reconcile every Phase 1D roadmap row against the real backend and reserve only the boundaries that later implementation would otherwise risk getting wrong.

The audit found that Phase 1C already supplies the reusable runtime foundations: database-context ownership, tenant entitlements and monitoring, scoped settings, public/private file separation, API v1 conventions, policy/step-up/audit patterns, integer money, payment separation, typed outbox events, and provider-neutral transports.

Phase 1D therefore closes through an explicit contract, not empty feature scaffolding.

## Phase 1D Decisions

| Future domain | Boundary reserved now | Runtime work deferred |
| --- | --- | --- |
| Blogs/content | marketplace or tenant-local ownership; locale/slug/publication/SEO/media rules | content schema, APIs, rendering, and UI to Phase 4 |
| Products/commerce | catalog/order/payment separation; immutable order snapshots; money/tax/discount adjustment rules | catalog, cart, order, fulfillment, and provider work to Phase 5 |
| Mobile apps | API/client-settings/version/maintenance/flag boundaries; user/device/bearer/push credential separation | device and push-token schema only when the Phase 6 lifecycle is implemented |
| Hospital/clinic sites | one implicit hospital per tenant database; marketplace control metadata; signed local entitlement enforcement; sanitized heartbeat | tenant product/site workflows and operations to Phase 7 |
| Reports/medical files | private patient/reservation ownership; quarantine, authorization, retention, audit, and report/file separation | doctor-request/patient-upload/review/report workflow to Phase 1E item 19 and Phase 3 |
| Notifications | domain event/request/delivery separation; recipient ownership; template/channel/preference/privacy rules | notification product tables, providers, inbox, and UI to later feature phases |

## Non-Negotiable Guardrails

- Do not add placeholder domain tables, migrations, models, controllers, routes, seeders, providers, or UI merely to make a future feature appear started.
- Do not trust a client-provided `tenant_id`, database selector, price, entitlement, lifecycle state, or authorization claim.
- Do not cross-write marketplace and tenant operational databases in one request. Marketplace feature control records desired control-plane state and publishes intent; a tenant enforces a separately delivered, signed local entitlement.
- Do not put push tokens, provider credentials, secrets, private medical data, or raw provider payloads in ordinary settings, API resources, audit metadata, outbox payloads, or logs.
- Do not reuse public-media storage for medical files or treat a storage file as the medical report aggregate.
- Do not couple future orders to the reservation payment aggregate. Shared money and provider contracts are reusable; business lifecycles remain separate.
- Do not create a mobile device table until logout, revocation, replacement, ownership, retention, and push-token lifecycle behavior can be implemented and tested together.
- Do not start Phase 2/Vite work while Phase 1E remains open.

## Verification Basis

- Each of the six Phase 1D roadmap rows has explicit ownership and lifecycle/security rules in the canonical contract.
- Each row maps to verified Phase 1C extension points rather than invented code.
- Later implementation phases and prohibited premature work are explicit.
- No Phase 1E or Phase 2 item is claimed complete.
- Phase 1C runtime evidence remains `docs/audits/phase-1c-verification-gate-2026-08-03.md`: SQLite 186 tests/950 assertions with one expected MySQL-only skip; disposable MySQL 187 tests/961 assertions; touched Pint and 104-route discovery passed.

## Next Implementation Boundary

The next roadmap slice is Phase 1E item 16, booking correctness. It requires a fresh implementation blueprint before source changes, with special attention to history-preserving rescheduling, duration rules, availability, hold expiry, and concurrent overlap protection.

Do not silently reopen Phase 1C or broaden item 16 into payment completion, questionnaires, medical reports, Phase 2, or frontend work.
