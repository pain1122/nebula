# Approved schedule read panels

The user explicitly approved both proposed schedule URLs, retained navigation/card/table composition and the stated subsequent bounded slot-control modal. [The proposal records that approval](admin-schedule-proposal-2026-10-15.md); no repeated permission is needed for its stated following slices. This slice completes the two read-only panel pages. Guarded slot mutations remain the next implementation slice, and successful live saves remain separate.

| Before | After |
| --- | --- |
| Four accepted private schedule readers have no panel consumer. | Admin/root Schedules navigation and `/panel/schedules`, plus `/panel/schedules/workplaces/:workplaceId`. |
| Workplace/service/rule/slot facts require direct API inspection. | Searchable/filterable workplace table; doctor/hospital/workplace cards, explicit current/historical service prices and independently paged rules/breaks and dated slots. |
| No panel drill-down or saved schedule-list state. | Safe support-profile/catalog/reservation links, independent URL-owned rule/slot filters and canonical Back retaining workplace filters. |

## Presentation and safeguards

Retained React18/Bootstrap/Velzon cards, forms, shared table, shell/auth/session transport and flag-owned English/Farsi direction are reused. No dependency, stylesheet, backend scheduling logic, schema or environment change. Existing controls are separate from the new adapters/presentation to support the client's expected later design refactor. The new calendar icon is present in the installed original icon inventory.

The typed adapter strips unknown nested fields, binds workplace detail identity, validates read-only envelopes, bounded/unique pages, archive/count facts, local dates/timezones, rule/break bounds, exact money strings and slot time/duration. Current response data alone is displayed; incomplete/invalid filters suppress the affected read and clear rows. A failed full-detail refresh clears cards and both nested tables. Separate current queries and immediate cache eviction reuse the session-owned cache/reset boundary.

Workplace search includes names via the existing server reader; advanced doctor-profile/hospital filters are explicit numeric IDs. Service filters on detail use that workplace's actual bounded assignments. Rule/slot filters and pagination have separate URL prefixes; reset/refresh affects the selected table and Back restores only the workplace list's filters. Unsupported free-text search is hidden for those two tables through a default-compatible optional shared-table prop. Existing table search behavior remains the default elsewhere.

Dates are paired Gregorian local-date inputs; the reported period/timezone comes from the server. Rule times are local hospital hours. Slot display uses the returned hospital timezone, including offset changes, rather than assuming Tehran for every hospital. Exact decimal prices use BigInt formatting. A rule-price override without its own currency is visibly labeled as inherited currency. Enabled state, future time, reservation blocking, reservation history, binding consistency and rule state remain distinct; none is presented as a booking promise. Service overrides are not booked payment snapshots. No read materializes slots, expires holds or consumes jobs.

## Accepted verification

- Backend read foundation remains **22 tests /490 assertions** and ten direct UID33 read-only MySQL checks/four actual guest401 refusals. All five controller/routes/test/runner source bindings remain unchanged. The proposal's former pending state is historical; its approval annotation is the intentional documentation successor.
- Frontend TypeScript/full **64 files /614 tests**, focused four-file **106 tests**, final schedule **15 tests**, governed/page lint, fixture/format and unchanged **2515 any /10 ambient /40 legacyApex /zero undeclared** ratchets pass. The inherited Quill toolbox case timed out on the initial full run, then passed alone and in the full rerun without a deadline/assertion change. New negative tests were strengthened with explicit error-message assertions to satisfy lint. No dependency install or test skip was introduced.
- Only static admin was built/recreated. Healthy image **4037f0c0**, retained as `checkupino-admin:schedule-read-accepted-2026-10-15`, passes **56 served/container asset matches**, lazy styles, compression/cache/deep-link and missing-asset checks. Retained image43f3 and earlier rollback tags remain.
- **11 retained role groups /161 requests** preserve existing reservation/medical/questionnaire behavior and denials. **23 native schedule groups /134 requests**, four desktop/390px shell/card mirrors and12 viewport captures pass. Admin/root ENFA sidebar, actual filters, paired-date blocking, independent reset/refresh, deep reload and Back are verified; patients/doctors are refused by all four APIs and both panel pages/menus.
- The first native harness counted a late preceding valid filter request as an incomplete-date dispatch. Its raw failed evidence is retained. The corrected harness records query strings and asserts that the exact forbidden partial-date query never occurs; UI/source guards were unchanged. Accepted proof records zero exceptions, external requests, blocked business attempts or business writes.
- Farsi desktop and390px workplace detail captures were visually inspected. The captures show the viewport, not the whole long detail page or exhaustive lower-table visual states. Tables retain responsive horizontal scrolling; geometric checks cover shell/cards, breadcrumb arrows, logo and language menu/flag spacing.
- Readiness safeguards14 and live readiness at **2026-10-15 16:23:38 UTC /19:53:38 Tehran** pass on4037/56. Twelve services run, worker stays idle/jobs0, both sockets and original/protected demo remain. All eleven catalog/schedule/doctor-reference hashes match the accepted read foundation before/after. Scanner remains stopped/stale and current-engine proof remains open; no retry or definition access was attempted.

[Static proof](evidence/admin-schedule-panel-static-2026-10-15.json), [retained role proof](evidence/admin-schedule-panel-browser-2026-10-15.json), [native schedule/fingerprint proof](evidence/admin-schedule-panel-pointer-2026-10-15.json), [source/evidence binding](evidence/admin-schedule-panel-acceptance-2026-10-15.json), [backend contract and limits](admin-schedule-read-foundation-2026-10-15.md).

## Rollback and next slice

The quiet-validated, unexecuted UI rollback preserves the accepted backend readers and every data/audit row:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-schedule-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Schedule rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-schedule-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Schedule rollback failed.' }
```

It uses `checkupino-admin:catalog-controls-accepted-2026-10-15` (43f3). No schema rollback or reseed is needed. Original proof writers refuse overwriting their accepted evidence; inspect existing proofs instead of replaying them. `node scripts/media/check-demo-readiness.mjs` remains the repeatable read-only checkpoint.

Next under the same recorded composition approval: guarded occurrence/day/week price-active controls with exact eligible-target previews, fresh actor/revision/reason/password/confirmation, current ownership/conflicts and atomic audit/rollback. Preserve reserved/history slots and all snapshots, and record the admin as the actual actor. No scheduling mutation is enabled by this read-only acceptance. Weekly-rule replacement, hospital/workplace editors and sweeps remain outside that narrow proposal; live-save/profile/download-audit and fresh-scanner gates remain separate. Payments/settings/real dashboard follow the ordered task list.
