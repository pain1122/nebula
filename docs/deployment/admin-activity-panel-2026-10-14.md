# Authorized activity panel

October 14, 2026, Asia/Tehran. The user requests continued implementation in checklist order. The October 11 administration proposal already approves `/panel/activity`, Product Admin navigation and the retained table composition; no repeated URL/design approval is needed.

| Before | Implemented slice |
| --- | --- |
| Owner/support profiles have bounded previews; the safe admin reader has no panel consumer. | Admin/root Activity sidebar and lazy page use the existing credentialed, session-owned query/table/feedback seams. |
| No cross-feature activity filter screen. | URL-owned exact audit/subject reference, actor account/current role, category/action/risk, paired Tehran dates, time order and stable paging; quick category filters, manual refresh/reset and visible server period/generated time. |
| No direct activity entry from doctor/patient lists. | Rows link the actual user account ID into activity, independently of the doctor-profile ID used for appointment links. Safe actor profile and reservation-subject drill-downs reuse approved routes. |

## Privacy and current-data rules

The response adapter strips unsolicited fields at every nested boundary and rejects contradictory hidden identities, action/category pairs, duplicate rows, oversized pages and invalid periods. Every42 action/category pairs match the accepted backend. Current query responses alone are presented; invalid/unfinished exact references or one-sided/reversed/over90-day dates block reads and clear displayed rows. Partial subject references stay editable rather than disappearing. Unsupported URL filters/private sorting and ordinary-admin root-role filters are removed. Numeric actor filters still receive authoritative backend permission checks.

The screen shows action/time/audit and subject references, permitted current actor identity/role, category/risk/outcome and a reason-recorded boolean. It exposes no raw reason, payload, private identity/credentials, clinical body, session/route/IP/user-agent facts or mutation/export/download controls. Unavailable actor identities remain explicitly unavailable. Activity is recorded business audit data, not online presence or comprehensive security telemetry. Root role labels reuse the existing shared translation. EN/Farsi comes from the language flag; no CSS, dependencies or alternate design system is added.

Original source foundations remain byte-identical: controller/routes/isolated tests/runner from [the reader checkpoint](admin-activity-foundation-2026-10-14.md). The existing candidate747 directory sources/evidence remain immutable historical artifacts; its changed frontend files are intentionally superseded by this slice.

## Source acceptance

Final full frontend **62 files /542 tests**, including16 activity tests and four added route-authority cases, TypeScript/governed lint/page lint/fixtures/format/unchanged2515-any/10-ambient/40-legacyApex/zero-undeclared ratchets pass. Fourteen readiness safeguards and the42-pair backend/frontend consistency check pass. Test assertions gained explicit expected rejection messages. The simple import-inventory parser misread an exported `from` field; shared date-filter definitions were moved outside that export, without changing behavior or relaxing its guard. Helper syntax checks caught nested selector quoting before browser execution.

## Deployment and rollback

Only the previously delegated static-admin config/build/recreate sequence is used; cached dependencies are reused. No backend/scanner/worker build/restart, .env/schema or business-write change is included. Prior `checkupino-admin:operational-directory-accepted-2026-10-13` /747564b5 remains available. Rollback override quiet configuration is valid; rollback has not been executed:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-activity-panel-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Activity rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-activity-panel-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Activity rollback failed.' }
```

Healthy image **789da82b**, retained as `checkupino-admin:activity-accepted-2026-10-14`, passes **51 actual served/container asset matches**, deep refresh, lazy clinical/editor CSS, gzip/cache and404. Eleven retained role/clinical/questionnaire/refusal groups and17 native Activity groups/106 API requests/two desktop-390px mirror cases pass. Admin/root ENFA sidebar, category/risk/reset/refresh, actual second-page audit rows, reservation-reference and doctor-account drill-downs pass; patient/doctor menu/API/deep-link refusals remain. Twelve services, idle worker/jobs0, both read-only sockets and original/protected fingerprints pass the final read-only readiness check at October14 **02:24:21 Tehran**.

The initial native paging proof failed on an immediate helper assertion; the accepted rerun waits for the returned second-page record. Original failed evidence remains. Raw static proof borrowed a predecessor's scope description; its separately hashed [scoped projection](evidence/admin-activity-panel-static-scoped-2026-10-14.json) is authoritative. Final image inspection found unsettled/offset full-document desktop captures. A separate [settled capture proof](evidence/admin-activity-panel-settled-capture-2026-10-14.json) verifies real first-page rows/period, both admin/root ENFA desktop mirrors and four explicit viewport captures. Farsi root desktop now visibly fits; original Farsi mobile was also inspected. No product CSS or raw evidence was changed.

[Immutable source/runtime/evidence binding](evidence/admin-activity-panel-acceptance-2026-10-14.json), [retained role proof](evidence/admin-activity-panel-browser-2026-10-14.json), [native Activity proof](evidence/admin-activity-panel-pointer-2026-10-14.json). Rollback keeps the safe backend reader, every audit/business record and all prior reservation/medical/privacy guards. No live business mutations or fresh-scanner readiness are established.

Next in order: catalog administration, then schedules, payments and the three general settings described in the reader inventory; real dashboard/report aggregation follows. The user explicitly approved [all six catalog routes/navigation/controls](admin-catalog-proposal-2026-10-14.md); no repeated catalog design approval. Their safe JSON reader is the next source slice. Schedule/payment/settings additions retain their named approval boundary. Live business saves remain separate.
