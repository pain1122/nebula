# Payment administration read foundation — verified October 16, Tehran

This continues the authorized payment-administration work after accepted bounded schedule controls. It completes the private backend reader and isolated/read-only verification. The exact payment page URLs, navigation and future root request-modal composition are proposed separately in [the October15 proposal](admin-payment-proposal-2026-10-15.md); they have not yet been approved or wired. The source slice crossed local midnight; immutable evidence uses October16, with actual UTC verification timestamps.

Before: administrators could inspect limited payment data through reservation details and root could submit an adjustment request; there was no dedicated payment list/detail/history API. After: five additive authenticated admin/root GET endpoints expose safe operational payment metadata without changing the payment core or writer:

- `/api/admin/payments`
- `/api/admin/payments/{paymentPublicId}`
- `/api/admin/payments/{paymentPublicId}/attempts`
- `/api/admin/payments/{paymentPublicId}/adjustments`
- `/api/admin/payments/{paymentPublicId}/events`

## Contract and safeguards

The parent is identified by its public ULID. Reads refresh active admin/root authority before and after query/formatting and recheck current patient/doctor visibility for every returned payment. Another privileged user's patient/doctor relationships remain hidden, while authorized archived doctor history remains readable. No actor, payment, reservation or clinical fields are serialized wholesale.

List filters compose payment status, reservation status, doctor-profile/patient/workplace/checkup IDs, currency, provider/attempt status and adjustment status. Provider plus attempt status must match the **same attempt**. Safe literal search covers exact payment/reservation public ULIDs and current public display names/booked service/hospital names; `%`, `_` and `!` are escaped. Private contact, provider references and callback identifiers are neither returned nor searched. Date filters require a pair, cover at most90 inclusive Tehran **payment-creation** days, and use exclusive next-local-midnight SQL bounds; appointment dates are separate facts. Sort keys/directions are allowlisted with an ID tie-breaker. All collections have server pagination, default20, maximum100/page and page1000.

All money is emitted as normalized unsigned decimal strings, including reservation snapshots read without an integer cast. Zero and values above JavaScript's exact-number range retain their exact digits; fractional/negative/out-of-storage-range values and invalid currencies/states fail closed. Currencies stay attached to each amount; this slice does not total amounts or report revenue.

Payment status, reservation status and canonical-attempt consistency remain explicit separate facts. A canonical pointer to another payment/reservation is flagged and not exposed. Consistency flags report recorded relationships/status/money; they do not establish fresh provider verification or execute reconciliation. Reads do not offer an authoritative adjustment eligibility/revision context yet.

Attempts expose only their own public identity, safe provider code, state, exact money, lifecycle timestamps, canonical/binding facts and failure **presence**. No provider reference, idempotency key, error text/code or metadata body is returned. Adjustments expose public identity, type/state, money, timestamps, currency consistency and whether a reason was recorded, excluding actor/private reason/provider references. Pending remains explicitly request-only. Events are scoped through the chosen payment's attempts and expose safe internal public identities, recognized event types, signature/processing facts and timestamps. Unknown event types returnnull; external event IDs and callback payloads stay hidden. Every response is `no-store, private` with `read_only:true` and `adjustments_execute_provider:false`.

The existing root-only adjustment POST/service/policy is unchanged. Before wiring its proposed modal, add fresh locked authority/current canonical-attempt validation, actor-bound revision/confirmation and duplicate/ambiguous-delivery protection while preserving the payment-summary serialization point, amount reservation and fail-closed audit. No new successful live financial action is authorized by this read acceptance. Real refund/void execution, provider SDKs/callback transport, settlement/accounting/receipts and manual balance/status changes remain excluded.

## Verification

- Initial read-only container check found static admin plus four SeaweedFS services running; backend/parser/checker/idle worker were stopped, with scanner already stopped. The user ran the exact four-service existing-backend `start` command. App retains image18eb9257 and both existing socket mounts; no backend build/recreation or scanner/worker/parser activation occurred.
- Scoped PHP formatting passes three files. Isolated UID33/network-none/read-only-container/env-cache-bypassed SQLite gate passes **30 tests / 636 assertions** (16 payment cases plus14 retained schedule-reader cases). It covers roles/guest/refreshed authority, privileged-owner promotion, exact/zero/corrupt money, public identity/literal search, composed same-attempt filters, local date boundaries, stable sorting/pagination, bounded large histories, separate lifecycle/canonical consistency, private-field exclusion and unchanged financial/clinical/audit/outbox/queue/identity rows. Initial fixture uniqueness and mid-read test-hook selection were corrected without weakening production checks.
- [Runtime proof](evidence/admin-payment-read-runtime-2026-10-16.json): **14 existing synthetic admin/root direct-controller MySQL reads** inside a UID33 read-only transaction, plus Redis health, Laravel HTTP200 and **five actual guest HTTP401** refusals. Financial core, provider-event/adjustment, twelve schedule/catalog/reschedule-history, original clinical and protected-account fingerprints stay unchanged. This does not establish authenticated served payment-panel acceptance or a live mutation.
- Current runtime: **nine services running** — static admin, four SeaweedFS services and app/Nginx/MySQL/Redis. Parser, checker, worker and scanner remain stopped. The retained worker configuration is not activated. Full medical-stack readiness was not reaccepted in this API-only recovery. Static admin remains healthy9db92664 with its existing56-asset acceptance; no frontend source/build changed.
- All53 prior schedule-control immutable artifacts and32 unaffected noncontext source bindings remain intact. The five reader routes intentionally supersede the prior route-file hash; current context updates intentionally supersede their old context hashes. The existing payment writer/lifecycle/policies, dependencies, environment and schemas are unchanged.

No live financial/clinical/business save, refund/void request, provider execution, signature or definition contact, download, general worker, unrelated queue consumption, scheduler sweep, migration/reset/reseed, credential replacement or unrelated-project operation occurred. Protected accounts7/8/hazelnut2.0/NebulaNV remain untouched.

## Continuation and compatibility

Approve the concrete payment composition proposal before wiring its two canonical panel routes. Next deliver read-only retained ENFA list/card/history pages, then the hardened root request control under that stated approval. Positive live saves/download audit, isolated concurrent schedule-control/booking/legacy-doctor acceptance, full helper recovery and fresh scanner/current synthetic engine proof remain separate gates; the user-owned profile-save rehearsal stays deferred.

Rollback is additive source removal of these five new GET route definitions, retaining existing adjustment POST and all payment/history data. The new controller can remain unused. No database, asset, configuration or provider rollback is needed; older reservation/payment and accepted schedule-panel clients retain their contracts. Preserve the dirty/untracked worktree; do not use a broad Git revert/reset against this file.
