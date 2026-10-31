# Medical panel connection proposal

**Approved October 10:** operator approves both patient/doctor routes and this first read-only File Manager composition. Source is implemented and verified in [the slice report](medical-panel-readonly-2026-10-10.md); rebuild/browser acceptance pending. Do not re-request this approval. Later ordinary write forms remain separately concrete UI slices; underlying golden-flow work remains authorized. The operator also prioritizes the golden flow for Monday October12 over further deep media expansion: [recalibration](demo-golden-flow-recalibration-2026-10-10.md).

Prepared October 10, 2026, Asia/Tehran for the approved minimum demo. Source-only medical GET contracts/queries are prepared independently; this proposal supplies the exact new URLs and Velzon composition for the next visible slice. It does not activate scanning, a worker, migrations or uploads.

## Proposed routes and entry

| Role | Canonical URL | Entry |
| --- | --- | --- |
| Patient | `/panel/my/reservations/:reservationId/medical` | Medical files button in the existing reservation Actions cell, beside sandbox checkout when applicable |
| Assigned doctor | `/panel/doctor/reservations/:reservationId/medical` | Medical files button in a new Actions cell on the existing doctor reservation table |

Keep existing reservation URLs/navigation and `/panel` basename. New routes are lazy, registered in the existing Checkupino manifest, restricted to their respective role, and use reservation public IDs. No additional sidebar navigation item. Breadcrumb returns to the existing role-specific reservation list. Backend ownership remains authoritative; role checks do not grant access to another person's reservation. Generic admins/root have no medical-file access.

## First visible slice to approve

Reuse the original Velzon File Manager's `file-manager-wrapper`, request/sidebar and `file-manager-content` structure, its existing responsive table/classes/icons and detail surface, under the established panel shell. Connect reservation medical requests as the sidebar selection; selected request title/instructions/status are real server resources. The table displays safe eligible file name/type/exact-size/date and availability. For doctors, use the existing doctor detail endpoint; for patients, use published outcome only after request completion. Doctor draft report and patient published history render as plain text, never HTML. All labels use paired English/Farsi translations and the existing flag-owned direction.

For an open patient request, display issued allowed MIME types and exact per-type byte limits from `attachment_rules`. An unavailable policy blocks the future upload action. The existing API does not provide a pending-file list before publication; show an honest pending-outcome message rather than an invented list or completion. Empty, loading, unavailable and access-denied states use the existing product feedback primitives. Switching request/reservation uses current query arguments and fresh responses; logout/role change clears the shared query cache.

This first UI slice is read-only. Folder CRUD, demo storage usage/charts, sharing, unsafe preview, rename/delete and public links have no medical API authority and are not presented as real actions. Keep the original root Developer Toolbox File Manager intact and recoverable. No CSS, font, logo, image, editor, dependency or visual RTL repair is part of the proposal. Product-specific functionality replaces only demo data/actions within the approved medical surface.

## Following slices, still required for the full demo

1. Ordinary doctor request creation with immutable server-owned attachment policy; patient preflight/upload with truthful uploading/checking progress. Persisted owner-safe pending progress needs a separately verified API contract; no raw scan/storage facts.
2. Remaining named runtime safeguards and dedicated worker acceptance/controlled activation, with only medical-scan jobs and no unrelated queue consumption. Do not manufacture clean state or bypass freshness/content/integrity checks.
3. Eligible download, ordinary review, plain-text draft/update/publish, immutable report history and patient outcome. No reservation/payment lifecycle shortcut.
4. Fixed questionnaire and repeated bilingual/role/ordinary golden-flow rehearsal. Operator builds/recreates the static admin only after source checks pass and receives exact project-scoped commands.

## Verification and rollback

First slice acceptance: registry role/URL/refresh tests; synthetic component tests for wrong-reservation/request transitions, draft/published separation, unavailable rules and logout; full frontend quality; then user-run admin build/recreation and ordinary browser checks in both languages. No live medical writes are required for the read-only UI gate.

Rollback: remove only the newly approved product medical route/loaders/entry controls from the source and rebuild the admin, retaining backend schema/history/quarantine/policies and all existing routes/File Manager toolbox. No data rollback, volume deletion or credential changes.

Approval boundary: `AI_BOOT.md`, Working Mode, requires human design approval before finalizing canonical `/panel/*` URLs and navigation/page composition/component UX. `CODEX_RULES.md` separately requires approval before canonical route changes or visual recomposition. This proposal requests those two medical routes and the stated first read-only composition only; the existing broad golden-flow approval continues to authorize its independent backend/source prerequisites.
