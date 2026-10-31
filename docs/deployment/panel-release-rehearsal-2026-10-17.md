# Combined panel/release rehearsal - October 17, 2026

Accepted for the currently delivered demo/admin source, served artifact and read-only presentation scope. The user requested extra effort; three observed defects were corrected and verified. Current healthy image is `sha256:c6fdcf14921ab863e51ea567280cc40e9c3c22dae105834b21fa34a4d0de6422`, retained as `checkupino-admin:panel-release-accepted-2026-10-17`. Existing isolated service/concurrency proofs remain separate; completed business writers are never replayed.

## Acceptance sequence

1. Inspect containers without mutation; operator starts only the existing backend db/Redis/app/Nginx. Preserve container images, app socket overlays, source, private storage and original data. Parser/scanner/checker/worker remain stopped.
2. Check served bytes, compressed responses, lazy feature/editor/calendar assets, cache rules, deep links and missing-asset404 behavior against the accepted static image. Verify UID33 MySQL/Redis/HTTP, current authorized reads, guest refusals and fixed clinical/financial/catalog/schedule/protected fingerprints.
3. Run the full frontend quality gate. Retain any failing result and diagnose it; do not hide it by overwriting evidence or increasing a timeout without establishing the cause.
4. Exercise root/admin/doctor/patient/guest navigation on the same artifact, English/Farsi at1440px and390px. Require completed API responses and rendered data before claiming read acceptance. Check cross-page drill-down/Back, dashboards/charts/calendar, directories/private support profiles, catalog/schedules/payments/settings, visual questionnaire and saved-answer grids, patient discovery/questionnaire and published medical history. Inspect/cancel guarded root previews without a save or password confirmation.
5. Inspect screenshots/geometry and unexpected HTTP/JavaScript failures. Resolve demonstrated defects in small approved slices, rerun affected checks, and bind final evidence to the unchanged business/protected checkpoint and current sources.

## Current results

- Operator recovered only existing backend db/Redis/app/Nginx. Nine required services run; parser/scanner/checker/worker remain stopped. Unchanged app image18eb9257 and both read-only sockets are verified.
- Finalc6fdcf14 passes64 served-asset byte/compression/lazy-feature/cache/deep-link/404 checks,31 UID33 MySQL/Redis read/refusal checks and11 actual guest401s. [Static](evidence/panel-release-security-static-2026-10-17.json), [runtime](evidence/panel-release-security-runtime-2026-10-17.json).
- Complete feature UI matrix:304 page checks/321 groups/748 requests/76 captures,16 root/admin/doctor/patient ENFA1440/390px cohorts. It ran on133deb11 after both presentation fixes. The only subsequent production change is the app-entry history guard; feature UI source stays identical. [Full matrix](evidence/panel-release-pointer-2026-10-17.json).
- Finalc6fdcf14 adds24 typed-URL/keyboard/actual-cache-restore groups (78 requests) plus25 normal-bootstrap/role/published-history groups (152 requests/24 captures) across the same16 cohorts. Total captures100. Actual persisted medical restore is observed with its app root already hidden, followed by reload, login and server401. [Access/history](evidence/panel-release-access-2026-10-17.json), [final smoke](evidence/panel-release-session-smoke-2026-10-17.json).
- Full71-file/733-test run passes after the final production changes. New test mock typing then needed lint correction; current5 history tests, typecheck, lint, fixture guards, unchanged ratchets and formatting pass separately with unchanged production source. The evidence binds the full733 result and that test-only delta explicitly. Prior70/728, focused64 medical tests and22 history/authority/cache checks are retained; no full-suite result is inferred from a focused run. [Final source gate](evidence/panel-release-session-quality-2026-10-17.json).
- All clinical/payment/provider/adjustment/questionnaire/settings/audit/outbox/catalog/schedule/protected fingerprints match before/after. Zero business saves, password confirmations, clinical downloads, job consumption or definition access.157 unrelated Staff source bindings/256 prior immutable evidence bindings remain intact; the disposable test project stays absent.
- [Final acceptance binding](evidence/panel-release-acceptance-2026-10-17.json) records source/context/artifact/capture hashes and current runtime. Earlier55f10d0b/55491820/133deb11 proofs, initial Quill timeout, test typing/lint failures, helper corrections, observed UI failures and deliberate baseline interruption stay immutable. No dependency/timeout/concurrency change hides a failed result.

| Observed before | Verified after |
| --- | --- |
| Full Farsi weekday headings collide at390px. | Seven distinct native compact labels below576px, full names for readers/tooltips and unchanged desktop/English labels. |
| File Manager center expands to its content minimum, pushing reports offscreen. | Existing relative/overflow/wrapping utilities contain all columns/drawers in ENFA desktop/mobile; report text chooses its own direction. No Sass or stylesheet change. |
| Browser Back restores an old private medical screen after successful logout. | Cached root is hidden before retention and on restore; fresh bootstrap returns to login/session401. |

## Session-history privacy correction

The additional ordinary-admin/doctor/patient typed-URL refusals and patient keyboard links pass, but Browser Back after successful logout restores the old medical document without rechecking its expired session. The failed supplemental evidence is retained; this is an observed client privacy defect, not a failed backend authorization rule. A second logout from that cached document returns401.

The scoped correction installs a browser-history guard at app entry. A retained page hides its app root on persisted `pagehide`; persisted `pageshow` keeps it hidden and reloads through ordinary session bootstrap. New loads and ordinary navigation are unchanged. The server remains the authority; no cookie, role, credential, storage, route or backend policy is modified. Five lifecycle tests plus retained authority/query-cache tests pass22 checks; the final source gate and actual persisted-restore/login401 acceptance pass.

This follows the documented need to clear/revalidate sensitive state on browser-cache restore; HTTP cache directives alone do not revalidate an in-memory restored document. [Browser lifecycle guidance](https://web.dev/articles/bfcache#update-stale-or-sensitive-data-after-bfcache-restore), [Chrome cache behavior](https://developer.chrome.com/docs/web-platform/bfcache-ccns). The pre-hide and reload are this app's conservative implementation, with a fresh server session read before protected content returns.

The guard applies to documents loaded from the corrected build. Previously cached documents from older builds cannot acquire new JavaScript retroactively; use a fresh panel tab after deployment. Reloading a restored document also discards unsaved in-memory form state; pending-delivery markers and all server history remain intact, with no automatic resubmission. Browser acceptance observes actual persisted restore events, hidden content and the subsequent session401/login outcome in the tested Chrome; it does not claim every browser/OS snapshot behavior.

## Boundaries and recovery

Browser requests allow only local GET/OPTIONS and ordinary synthetic login/logout. Business writes, password confirmation, clinical downloads and external requests are blocked. Use only synthetic accounts1-5; protected patient accounts7/8 never log in. No database reset/reseed/migration/backfill, dependency/env/credential change, manual verdict/payment/completion, definition download or worker/provider/queue action.

This API/presentation rehearsal does not require the stopped parser or idle medical worker. The older `check-demo-readiness.mjs` requires their running runtime and is not weakened to turn a partial runtime into a full pipeline pass. Fresh uploads/scanner recovery, successful live admin saves, verified-download audit and the personally deferred profile save remain explicit separate gates. Production and real-patient readiness are outside this acceptance.

Recovery started existing backend containers only. The doctor recovery source is verified separately32/261 plus eleven MySQL interleavings. The three frontend corrections used the already delegated static-admin-only build/recreation sequence, with cached dependencies. No backend recreation or schema/data rollback is needed. API contracts, CSS, dates/events, clinical history, SeaweedFS/AWS compatibility and all unrelated dirty work are preserved.

Keep the current history guard when rolling back presentation: earlier retained55f10d0b Staff and133deb11 UI images lack that privacy fix and are not privacy-accepted release rollbacks. A presentation rollback can restore only the responsive header fragment/test assertions and four File Manager class-attribute edits/`dir=auto`, then rebuild with the current index/history guard. Currentc6fdcf14 is retained as the accepted artifact; no data reset or credential change is part of rollback.
