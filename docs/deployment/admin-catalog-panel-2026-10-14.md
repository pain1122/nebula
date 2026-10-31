# Checkup/category panel slice

The user requests relaunching the existing containers and continuing the approved catalog work. All six catalog routes/navigation/controls were already explicitly approved in [the proposal](admin-catalog-proposal-2026-10-14.md); this slice wires the four checkup/category read screens. Guarded write controls and specialties remain the next catalog slices.

Work began October14 and final acceptance continued October15, Asia/Tehran. Original task-date filenames are retained; evidence timestamps record UTC.

| Before | This source slice |
| --- | --- |
| Seven required backend/parser/check/idle-worker services stopped; admin and four SeaweedFS services already running. | Exact seven existing services started; four SeaweedFS and the existing admin restarted. Twelve services/readiness/protected history pass; scanner stays stopped and worker idle. |
| Four accepted catalog readers have no panel consumer. | Admin/root Checkups and Categories navigation, URL-owned server lists and card-grid details on the four approved routes. |
| No catalog-to-history panel links. | Category/active/archived child counts, checkup reservation usage and category details link existing authorized readers; Back preserves canonical list filters. |

## Source rules

Existing React18/Velzon/Bootstrap tables, forms, DetailBox cards, shell/session transport and flag-owned EN/Farsi direction are reused. No stylesheet/dependency/backend/schema/env change. The two lists and two details are lazy and admin/root only. The future approved Specialty slot is reserved before root Upload limits; no dead Specialty link is introduced.

The adapter explicitly validates/strips nested DTOs, binds detail identity, rejects contradictory archive/count facts, duplicate/oversized pages and unsafe numeric IDs. Price display uses exact decimal strings/BigInt rather than rounding through Number. Invalid/unfinished currency or price/category filters block main reads and clear rows; currentData alone is presented, and refresh failures clear previous facts. Category filter choices are the first100 server records with an explicit bound and a link to the paged category directory. Descriptions remain escaped plain text.

List state/currency/category/uncategorized/price/search/sort/page filters, presets, refresh/reset and canonical Back are connected. Card-grid details show record facts, price/default duration/category, historical counts/dates and description. Current catalog state is not a promise that an appointment slot is available. Historical snapshots are untouched. No create/edit/archive/download/export or live business action is introduced by these read-only controls; guarded writes follow after fresh revision/locked authority/reason/password/atomic audit contracts.

## Verification and deployment

Full frontend **63 files /575 tests**, focused four files **92 tests**, TypeScript/governed lint/page lint/fixture/format and unchanged2515-any/10-ambient/40-legacyApex/zero-undeclared ratchets pass. The16 new route cases cover admin/root and patient/doctor refusals on all four pages;17 catalog cases cover privacy, exact prices, filters, invalid reads, detail identity, escaped content, card grids, Back and refresh denial. Fourteen readiness safeguards pass. An initial full-run retained Quill toolbox timeout is recorded: its isolated check and complete rerun pass without changing deadlines. Initial new test selectors/registry expectations and a Windows shell-pipe encoding error in generated Farsi labels were corrected before building; all Farsi labels retain real Unicode.

[Existing-container recovery proof](evidence/catalog-container-recovery-2026-10-14.json) records unchanged images/socket isolation/scanner state and original protected history. Admin readiness initially refused while its health was starting, then passed. No initializer/build/recreation was used for that recovery. Its prior Activity static image is789da82b/51 assets.

The previously delegated admin-only config/build/recreate sequence updated only the static panel, reusing cached installed dependencies. Healthy final image **0748b736**, retained as `checkupino-admin:catalog-read-accepted-2026-10-14`, passes **54 served/container asset matches**, lazy clinical/editor styles, compression/cache/deep links/404. Eleven retained role/history/refusal groups (161 API requests) and **19 native catalog groups /137 API requests /four desktop-390px mirror cases /twelve viewport captures** pass. Admin/root ENFA category/state filters, refresh/Back, detail boxes, deep refresh and all-state children are verified; patients/doctors are refused on all four routes/APIs and menus. Zero exceptions, external requests or blocked business attempts were recorded. Original completed/protected and exact catalog/assignment/slot hashes match before/after.

The first candidate69eef70a passed the same19 native groups, but visual inspection found English-description punctuation inherited RTL ordering. Native `<bdi>` now isolates escaped descriptions, with real computed-isolation checks; final Farsi desktop and390px captures were inspected. The first candidate/tag and raw proofs remain immutable. A first static attempt refused while health was starting; bounded health waiting preceded successful acceptance. No assertion, timeout or scanner guard was relaxed.

Read-only readiness at **2026-10-14 20:33:07 UTC /October15 00:03:07 Tehran** passes on0748/54: twelve services, idle worker/jobs0, both read-only sockets and original/protected fingerprints. Existing history is ready; scanner remains stopped/stale/current-probe absent. The backend/reader foundation hashes remain unchanged. [Final static proof](evidence/admin-catalog-ready-static-2026-10-14.json), [retained role proof](evidence/admin-catalog-ready-browser-2026-10-14.json), [native catalog proof](evidence/admin-catalog-ready-pointer-2026-10-14.json), [immutable source/runtime binding](evidence/admin-catalog-panel-acceptance-2026-10-14.json).

Rollback uses the retained `checkupino-admin:activity-accepted-2026-10-14` image through `docker-compose.admin-catalog-rollback.yml`; quiet configuration passes and rollback is unexecuted. It preserves the accepted backend read foundation and every record:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-catalog-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Catalog rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-catalog-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Catalog rollback failed.' }
```

The next catalog slice is guarded checkup/category mutations/controls, then specialty contracts/controls; schedules/payments/general settings and the real dashboard follow the current checklist. Successful live admin saves remain separate; the user-owned profile rehearsal stays deferred. Existing history is ready, fresh scanning is not; no scanner/definition retry or job consumption occurs here.
