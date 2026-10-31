# Medical panel read foundation

October 10, 2026, Asia/Tehran. Three source files prepare the existing safe medical APIs for the retained role-specific panel. No new route, screen, dependency, stylesheet or live operation is delivered by this slice.

`frontend/src/modules/checkupino/medical/types.ts` models the safe request, revisioned per-MIME attachment rules, file receipt, plain-text report, doctor detail and patient published-outcome resources from the existing Laravel resources/controllers. Policy unavailable is an explicit union case; limits remain exact server-owned bytes, with no guessed client fallback. Storage paths, checksums, raw scan/retention state, internal notes and owner IDs are excluded from these contracts. Types describe the server contract; they are not runtime validation or permission enforcement.

`medical/api.ts` injects four GET-only queries into the existing `checkupinoApi`: patient request list, doctor request list, doctor detail and patient published outcome. Doctor detail uses `/api/doctor/reservations/.../medical-requests/...`; the patient query uses the separate `/api/reservations/.../medical-requests/.../outcome` endpoint, preserving the backend publication/ownership gate. Path segments are encoded. Endpoint/argument keys separate role/reservation/request caches; unused medical responses expire immediately. Existing session-cookie transport, abort propagation and store identity/role reset apply to these injected endpoints. No bearer-token or secondary API store is added. Future screens must use current arguments/currentData, explicit fresh refetch and backend errors; cache expiry is not an authorization or freshness substitute.

`medical/api.test.ts` adds six synthetic tests: role/reservation isolation and equal-query deduplication, unused-response eviction, exact doctor-detail/patient-outcome endpoint separation and encoded path segments/plain-text preservation, HTTP401/403/404 rejection without fabricated outcomes, transport abort and shared cache reset. These are mocked adapter tests, not live HTTP/browser/ownership acceptance.

## Verification

Final `npm.cmd run quality` passes: TypeScript, **50 files/299 tests**, lint, one valid/six rejected lint fixtures, unchanged quality ratchets and formatting. An initial full-suite run timed out in the unchanged Quill toolbox test; focused unchanged-editor/new-medical rerun passed2 files/7 tests. Subsequent full test runs passed50/299. The new mocks initially required explicit types for lint; that source defect was corrected and the final entire quality command exited0. No test deadline, editor source, dependency or lint rule changed. Existing browser-data/Tailwind/jsdom warnings remain; no unsolicited dependency update was performed.

Readonly inventory still contains twelve required services and no standing worker. Scanner remains healthy; offline-recovery disposable containers and socket volume are absent. Existing app/admin images, main env, clinical schema/state, patient accounts, quarantine and all dirty/untracked work are preserved. The new API module is prepared for a future lazy medical screen; it has not been wired into a live route or deployed admin image. No rebuild is needed merely to retain this unused source foundation.

## Next and rollback

The [exact medical route/File Manager proposal](medical-panel-proposal-2026-10-10.md) is prepared for the repository's named URL/composition approval boundary. Then connect the first read-only bilingual surface, followed by ordinary request/upload/review/publication controls, guarded dedicated worker runtime, fixed questionnaire and final rehearsal. The current patient API does not list pending files before publication; an owner-safe progress contract remains open. Large video/ZIP/multipart and public SEO remain separately scoped.

Rollback is to stop importing the new module before route wiring; no backend migration/config/history rollback is involved. When future UI wiring begins, remove only its newly introduced imports/routes/controls if needed, retaining the original toolbox File Manager.

Evidence: [source and quality gate](evidence/medical-panel-read-foundation-2026-10-10.json).
