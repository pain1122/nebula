# Root payment adjustment request controls

The user instructed continuing the already approved refund/void request modal on the existing payment detail page. It reuses the approved composition without changing URLs, navigation, CSS, dependencies, backend, schema or provider operations.

| Before | After |
| --- | --- |
| Accepted payment list/detail/history with a hardened server request boundary. | Root-only “Request refund / void” opens the retained ActionDialog on the existing detail page. Ordinary admins retain read access without this control. |
| No panel request preview. | Fresh root preview shows exact payment money/currency, available amount and signed expiry; blocked or inconsistent history disables submission. |
| Source-tested request safeguards without UI wiring. | Exact positive integer strings, whole-remaining void, reason/explicit confirmation/recent password, repeated same-revision/expiry reads and bound pending-request receipts. |
| No request interaction lifecycle. | Value changes clear confirmation; expiry, cancel, unmount and session changes block or abort work. An uncertain response freezes the dialog and blocks reopening until a successful manual detail refresh. |

The existing backend remains unchanged. Every accepted backend source is hash-checked against the preceding payment acceptance; its isolated49 tests/859 assertions/Pint8 evidence is reused. The API rechecks current locked active root authority, owner privacy, canonical success, amount/history/revision/expiry and atomic audit. A pending adjustment reserves a request amount and does not execute provider money movement or change payment/reservation state. Provider execution remains outside this scope.

The new `payments/adjustments.ts` module owns transport scope, exact money/preview parsing, identity/currency/eligibility binding, repeated verification, strict request fields and response matching. It ignores the legacy numeric response amount and consumes `amount_exact`. The editor and existing page only present and coordinate these rules, allowing a later client UI refactor without moving authority into the browser. The shared ActionDialog, password coordinator, session authority and overlay remain unchanged.

Source gates: full frontend67 files/667 tests, final focused34 payment tests, TypeScript/governed and supplemental payment-page lint, fixtures, formatting, unchanged ratchets2515/10/40/zero undeclared, and14 readiness safeguard tests. The first quality run passed all667 tests, then exposed test assertion lint; supplemental lint required explicit effect dependencies and identity-keyed detail state. Those were corrected and the affected34 tests plus all remaining checks pass. No test timeout, rule or debt threshold was weakened.

Runtime acceptance uses new exclusive-write `admin-payment-controls-{static,runtime,browser,pointer}-2026-10-16.json` records. All pass: 57 served/container-byte assets;15 UID33 MySQL read-only checks/six guest401 refusals/HTTP-Redis health;11 retained role groups/161 requests;25 native ENFA groups/157 requests/four desktop-390px mirror cases/12 viewport captures. The browser guards permit only GET/OPTIONS and synthetic login/logout; they forbid adjustment submission, password confirmation and clinical download. Preview, ordinary form input, confirmation toggle, type changes and cancellation are the intended live acceptance boundary. Final clinical/financial/provider-event/adjustment/catalog/schedule/protected fingerprints equal their baselines and the earlier payment checkpoint. Historical read-panel proofs are preserved.

Accepted healthy image: `sha256:fa9c061dd76fde907465671a8c7d005d9288c2c18bb52406b17dbdc9740087d3`, retained as `checkupino-admin:payment-controls-accepted-2026-10-16`. Only static admin was built/recreated, using cached dependencies. [Immutable source/runtime binding](evidence/admin-payment-controls-acceptance-2026-10-16.json) records the accepted scope and retained prior source/evidence hashes.

Current runtime remains API-only: nine services, with parser/scan-check/worker/scanner stopped. App image and both read-only socket mounts remain unchanged; stale definitions and missing current scanner proof are not addressed here. No general worker, queue consumption, live business save, completed-demo replay, environment/credential replacement or protected-account mutation. Positive live request/audit acceptance and concurrent MySQL financial-write acceptance remain separate.

Rollback is UI-only to `checkupino-admin:payment-read-accepted-2026-10-16` using `docker-compose.admin-payment-controls-rollback.yml`; retain the backend safeguards and all data. Prepared and quiet-validated, not executed:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-payment-controls-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Payment controls rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-payment-controls-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Payment controls rollback failed.' }
```

Next in the existing sequence: general marketplace settings (hold duration, fallback timezone and default currency, with actual runtime consumption), then real product dashboard/reporting. Live saves and scanner recovery remain separately guarded checkpoints.
