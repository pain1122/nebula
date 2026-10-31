# General marketplace settings panel

October16 approved page/control slice: `/panel/settings/general`, root-only Product Admin entry, retained Velzon cards and existing ActionDialog/password flow. This completes the deployed controls/read-only acceptance scope; successful live setting save/reset and concurrent MySQL mutations remain separate.

| Before | After |
| --- | --- |
| General read/save/reset safeguards and runtime defaults existed without a panel. | Three bilingual cards show pending hold, fallback timezone and default currency, with platform/site selection and typed save/reset controls. |
| Selected stored values could be confused with actual runtime defaults. | Cards distinguish the selected override, resolved value/source and applicable default. Hold also shows the operator fallback; platform changes disclose a winning site override. Confirmation previews show inheritance and before/after applicability. |
| UI wiring and served acceptance were open. | Canonical route, root sidebar/access, EN/FA desktop/mobile, native typing, current previews and cancellation/refusal behavior are verified on the rebuilt artifact. No live mutation was submitted. |

The adapter parses exactly the three registered public setting keys and the prepared read/write/runtime contract. It validates key/type/order/scope/metadata/value consistency, strict currency/hold input, supported timezone input and platform/site inheritance. Scope keys always come from the server snapshot. Both scopes are read together, followed by a platform verification to reject a changing mixed snapshot. Reads abort on scope/identity changes or unmount; failed reads expose no usable cards.

Save/reset opens a fresh confirmation against the reviewed pair. Both scopes are rechecked before delivery and again at the writer boundary, including after password confirmation. Writes use the exact reviewed key/scope/revision, reason and explicit confirmation. Reset omits `value` entirely; absent resets and stored same-value saves are disabled. Runtime preview never promises to alter explicit hospital timezones, saved currencies/prices or existing appointments. Default currency does not change the catalog create-form prefill or convert money.

The existing dialog owns recent-password retry/cancel and duplicate/in-flight/unmount/authority guards. Draft values, reason and confirmation survive ordinary language/password changes. Scope changes remount the workspace; an open action disables ordinary scope changes. A stale read blocks confirmation and requires close/refresh. An uncertain response or malformed acknowledgement locks further actions until an explicit successful refresh. No business mutation is automatically retried after an uncertain result. Source tests exercise ordinary mocked set/reset/password delivery; live browser acceptance never submits those actions.

Verification:

- Full frontend gate: **68 files/702 tests**, TypeScript, lint/fixtures, formatting and unchanged ratchets `2515/10/40/undeclared0`; supplemental page/registry lint and changed-file format pass. Thirty new general-setting adapter/control tests plus five route-role tests cover the new behavior. Existing shared dialog/overlay safeguards remain tested.
- An existing payment fixture regenerated its preview deadline on every read, intermittently crossing a second boundary and failing safe with a conflict. Both payment test files now reuse the reviewed deadline. Expiry/stale/retry tests remain; production payment code is unchanged. Initial manifest wiring was corrected to use route-derived roles and the existing integer navigation-order contract before the passing gate.
- The accepted backend **113 tests/1,092 assertions/Pint15** is reused through **31 unchanged backend/config/test source hashes**. No backend consumer, API, schema, dependency or environment changes occurred in this page slice.
- Static verification passes **58 served-container byte hashes**, lazy chunks/CSS, compression/cache, deep links and missing-asset/route checks on healthy **40e032de**. First inspection correctly refused the container's transient `starting` health; the helper now waits boundedly for health before acceptance.
- **21 UID33 read-only MySQL/default/refusal checks**, Redis/HTTP health and eight actual guest401 refusals pass. Clinical/payment/provider-event/adjustment/catalog/schedule/original/protected fingerprints remain identical.
- **15 native browser groups/63 API requests**, two desktop/390px mirror cases and eight viewport captures pass. Actual mouse/keyboard input checks invalid/valid hold, scope selection, fresh save/reset inheritance preview, reason/confirmation, close/cancel and explicit refresh. Admin/patient/doctor API/page/sidebar refusals pass. No console exception, external request, blocked attempted write or business mutation occurs.
- The retained **11 role/clinical/reservation browser groups** pass separately on the same candidate. Both browser helpers allow only GET/OPTIONS and synthetic login/logout, explicitly blocking business writes and downloads. Patient accounts7/8 never log in.

Nine services remain running. Parser, checker, worker and scanner remain stopped; current scanner proof is still absent. App18eb9257, both read-only sockets, all accepted synthetic history and unrelated/protected fingerprints remain. Only static admin was built/recreated using the previously delegated sequence; dependency installation layers were cached. Existing Sass/chunk-size build notices remain outside this slice.

Evidence: [static](evidence/general-settings-panel-static-2026-10-16.json), [runtime](evidence/general-settings-panel-runtime-2026-10-16.json), [retained browser](evidence/general-settings-panel-browser-2026-10-16.json), [native browser and captures](evidence/general-settings-panel-pointer-2026-10-16.json), [final binding](evidence/general-settings-panel-acceptance-2026-10-16.json). All earlier immutable evidence remains intact. Helpers refuse accepted-evidence overwrite; consult the proof instead of replaying it. The earlier API-only flags/no-panel checkpoint is historical for this now accepted UI scope.

Current image: `sha256:40e032dec0fc36c2c9680d3865a246a7dfcbce082caaf97b3e00a64b51c8d414`, retained as `checkupino-admin:general-settings-accepted-2026-10-16`. Prior payment controls remain retained as `checkupino-admin:payment-controls-accepted-2026-10-16` (fa9c061d). The static-only [rollback override](../../docker-compose.general-settings-panel-rollback.yml) is quiet-valid and unexecuted:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.general-settings-panel-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.general-settings-panel-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Static admin rollback failed.' }
```

That rollback restores the prior UI while retaining the hardened backend and all data; no reset, migration or source cleanup is needed. Next: replace home fixtures with authorized real feature/user/doctor/payment aggregates, activity previews and linked reports. Positive live administration saves, deferred user-owned profile rehearsal, fresh scanner recovery, large media/multipart and the undecided refund-policy questions remain separate.
