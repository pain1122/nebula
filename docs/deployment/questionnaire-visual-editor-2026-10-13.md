# Questionnaire visual content editor

User scope: replace the introduction and recommendation HTML-source inputs with an existing visual editor. No new dependency, route, server rule or schema was requested or added.

Healthy candidate **`sha256:a5b454858ef3f9eb602a7dd943b040dd41dc45c593a986f0bd4b843a80e81311`**, retained as **`checkupino-admin:questionnaire-editor-accepted-2026-10-13`**. Only the delegated static-admin build/recreation ran; cached dependency installation was reused. Prior **`checkupino-admin:panel-mirror-accepted-2026-10-13`** (12112aa9) and earlier tags remain for rollback.

## Result and safeguards

Introduction and each recommendation now use CKEditor with headings, bold/italic/underline, lists, quotations, links and undo/redo. Content authors see formatted text and normal EN/Farsi controls. Raw-source labels/fields are removed. Question/choice text and URL/slug fields keep their existing semantics; medical plain-text reports are unchanged.

The existing `ToolboxClassicEditor.tsx` remains the sole CKEditor import owner. Its original toolbox config is preserved; a named product adapter limits formats to the server allowlist. Native Farsi translation/UI direction and saved-content language are independent of document-wide direction. The existing GPL configuration is reused; no package/lock or quality-ownership/direction guard was changed. English must omit `translations`; the installed SDK's empty-array reduction caused the first native runtime failure, now fixed and covered. Failed/intermediate proofs are retained.

Before initial data reaches CKEditor, an inert allowlist removes active elements, executable attributes, unsafe/relative links and unsupported assets. The existing server sanitizer remains authoritative on save. No media upload/embed/source-editing control is introduced.

Save waits for healthy initialized editors within the existing20,000-character bound. Failure/oversize/confirmation/uncertain states block unsafe saves. Active native drafts/carets are not overwritten with sanitized HTML on each keystroke; fresh reads, version changes and locale changes remount from parent-owned data. Stable client-only recommendation identities prevent removing one editor from reusing another's state. Reasons, fresh-version checks, recent-password handling, server ownership/audit controls and saved-answer/result/version history stay intact.

## Verification

- Full frontend **58 files /460 tests**, TypeScript, governed and supplemental page/adapter lint, fixtures, formatting and unchanged2515/10/40/0 ratchets pass. Eleven dedicated editor tests and16 administration tests cover safe HTML/links/limits, readiness/failure/freeze, language, stable removal and ordinary mocked formatted save with reason/version. Existing backend sanitization/audit-rollback evidence is reused; no new server behavior.
- **47 actual served assets** match container bytes/cache/compression/deep links. Native editor CSS and JS stay outside initial HTML; editor CSS217,427 bytes/33,721 gzip and shared adapter JS932,790/245,162 load with the feature. [Static proof](evidence/questionnaire-editor-ready-static-2026-10-13.json).
- **31 real-pointer/keyboard groups**,70 API requests and16 screenshots pass for admin2/root1 EN/Farsi. Actual native typing/bold, preserved unsaved formatting across flag changes, reasoned-save cancellation with four read-only editors, fresh server restoration, archive cancellation, keyboard/refresh and390px definition/submission grids pass. The nine previously measured shell layouts also pass. Desktop/Farsi/mobile editor captures were visually inspected. [Pointer/geometry proof](evidence/questionnaire-editor-ready-pointer-2026-10-13.json).
- **11 role/API groups**,161 requests cover admin/root filters/history/refresh/cancel and patient4/doctor5 refusals. [Role proof](evidence/questionnaire-editor-ready-browser-2026-10-13.json). This helper uses DOM activation; actual mouse acceptance comes from the previous proof.
- Thirty mirror plus14 readiness Node safeguards pass. Fixed matching static/role evidence is admitted through unchanged candidate/asset/original clinical gates. Twelve services, UID33 MySQL/Redis/parser, both read-only sockets, idle worker/jobs0 and original completed/protected fingerprints pass. [Source/runtime binding](evidence/questionnaire-editor-acceptance-2026-10-13.json).

Browser runs allow local GET/OPTIONS and ordinary login/logout only. Native edits were local and cancelled/refreshed; no live definition save, clinical download, audit mutation, scanner contact or queue consumption occurred. Successful live administrative writes remain a separately guarded synthetic-checkpoint task. Fresh scanning remains stopped/stale/unproved.

## Rollback and continuation

Use the [existing admin-only image rollback sequence](admin-reservation-panel-2026-10-11.md#source-and-rollback) with `checkupino-admin:panel-mirror-accepted-2026-10-13`. This restores the prior HTML-source UI while retaining data, server sanitization, audit/ownership/history and release safeguards. Source rollback must undo only these adapter/consumer/locale changes, preserving the large dirty worktree and original toolbox config.

Current checklist/context and the [RTL compatibility log](rtl-compatibility-log-2026-10-13.md) are synchronized. Native product questionnaire editing is accepted; optional toolbox editor interactions and later client UI refactors remain separate. Never replay closed business writers or overwrite historical evidence.
