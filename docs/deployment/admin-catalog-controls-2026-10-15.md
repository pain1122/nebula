# Guarded catalog controls and specialty administration

The two remaining approved catalog items are deployed: guarded checkup/category creation, editing and soft archives, followed by specialty readers and controls. The six routes and retained controls were approved in [the catalog proposal](admin-catalog-proposal-2026-10-14.md). Successful live admin writes remain a separate synthetic checkpoint; none were performed here.

| Before | After |
| --- | --- |
| Checkup/category lists and card details were read-only. | All three catalog kinds have guarded create/edit/archive controls, with fresh server contexts and reason/confirmation/recent-password checks. |
| Specialty administration existed only in legacy Blade. | Admin/root specialty lists, state/search/parent/root filters, detail cards, hierarchy and doctor-association counts use the two approved panel URLs. |
| Legacy catalog mutation paths had different safeguards. | API and Blade share one mutation service; legacy forms include revisions/reason/confirmation. Optional specialty slug generation/retention remains compatible. |

## Safeguards and compatibility

Actor-bound HMAC revisions include catalog and doctor-reference state. A bounded catalog cache mutex and ordered transactional row locks serialize catalog writers; existing resource policies are enforced and fresh active actor/roles are checked before, inside and at the end of the transaction. Unsupported fields, stale revisions, archived targets, duplicate reserved slugs, invalid references and missing confirmation/reason refuse. Audit failure rolls back the entire operation. Writes require the existing recent-password middleware; the UI rechecks context before dispatch and after password confirmation, cancels on session changes and freezes after ambiguous delivery until an explicit fresh read. No password or draft is persisted in Redux.

Category archive explicitly detaches or reassigns active and archived children, preserving all records and booking snapshots. Child changes and the archive share an audit batch and retain critical risk classification. Specialty reparenting rejects self/cycles/excessive depth and updates only its descendants, including archived descendants. Any child, primary doctor reference or secondary doctor association prevents specialty archive. Doctor assignment is not changed by catalog operations.

The source/isolated gate proves the intended catalog serialization and rollback behavior. Concurrent live MySQL catalog/doctor-assignment writers were not exercised; do not claim that broader concurrency acceptance from SQLite tests or read-only MySQL checks. Guarded snapshots refuse above 5,000 records per catalog/reference collection, hierarchy depth is bounded at 32, and relation selectors search/page 20 records at a time. Unrelated catalog changes conservatively invalidate an open revision. Price writes remain bounded exact integers; historical reads preserve exact decimal-string display. No schema, dependency, environment, storage or booking/payment lifecycle change.

React 18, Bootstrap/Velzon tables, grouped detail cards, dialogs and language-owned direction are retained. Names/descriptions use automatic content direction; slugs/currency/numeric inputs use LTR. Descriptions remain escaped plain text. New catalog audit actions are translated and accepted by the existing privacy-filtered Activity reader. No raw audit payload, private identity or clinical content is introduced.

## Verification

- Final isolated PHP gate: **53 tests /644 assertions**, including existing legacy authority/history tests, all three mutations, stale/actor-bound revisions, confirmation/password/strict fields, audit rollback, category reassignment, hierarchy cycles/depth, archived descendants, unrelated branches, primary/secondary reference refusals and legacy optional slugs. Disposable SQLite, UID33, read-only source, no network and masked live private storage only. Scoped Pint passes.
- Frontend full quality: **63 files /591 tests**, TypeScript/lint/fixtures/format and unchanged **2515 any /10 ambient /40 legacyApex /zero undeclared** ratchets. Final focused four-file gate **108 tests** and TypeScript pass after the small field-direction/spread cleanup; page lint/format pass. Initial failures were obsolete menu/route expectations and an ambiguous Close selector, corrected without weakening assertions. A supplemental broad lint invocation also surfaced a pre-existing conditional assertion in RouterContract; governed lint and the scoped product-page lint pass.
- Healthy image **43f3a3e5**, retained as `checkupino-admin:catalog-controls-accepted-2026-10-15`, passes **54** served/container byte matches, lazy styles, compression/cache/deep links and missing-asset checks. Only static admin was built/recreated.
- **11 retained role groups /161 requests** and **23 native catalog groups /275 requests** pass. Admin/root ENFA create contexts, edit/archive cancellation, category replacement selection and specialty reference refusal are exercised. Patient/doctor API/deep-link/menu refusals cover all six pages; two inherited group labels still say four although their actual loops now cover six. Four desktop/390px shell-card mirror checks and 16 viewport captures pass. Farsi specialty desktop and category mobile captures were visually inspected; viewport captures are not full-page or exhaustive modal/mobile interaction acceptance.
- Zero browser exceptions, external requests, blocked business attempts or business writes. Catalog/doctor-reference and original completed clinical/payment/questionnaire/audit/outbox/protected fingerprints are unchanged. Twelve services remain running, worker idle/jobs zero. Scanner remains stopped/stale; current official definitions and engine proof remain separate.

[Static proof](evidence/admin-catalog-controls-static-2026-10-15.json), [retained role proof](evidence/admin-catalog-controls-browser-2026-10-15.json), [native controls and fingerprint proof](evidence/admin-catalog-controls-pointer-2026-10-15.json), [source/evidence binding](evidence/admin-catalog-controls-acceptance-2026-10-15.json).

Repeat source/readiness checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-admin-catalog-mutations.ps1
node --test scripts/media/check-demo-readiness.test.mjs
node scripts/media/check-demo-readiness.mjs
```

Proof writers refuse overwriting their accepted evidence. Inspect existing proofs instead of replaying them.

## Rollback and next work

The accepted read-only predecessor **0748b736** remains retained. This unexecuted, quiet-validated static rollback preserves all backend data and guards:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-catalog-controls-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Catalog rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-catalog-controls-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Catalog rollback failed.' }
```

No schema rollback/backfill is needed. Retain audit rows/history and the stricter mutation boundary when rolling back UI; do not restore an older unguarded writer. Older read-only panels remain compatible with the additive readers. The next ordered feature is schedule administration, then payment administration, general marketplace settings and the real dashboard. Live positive admin-save/download-audit rehearsal and fresh scanning remain open; the user-owned profile rehearsal stays deferred.
