# Patient questionnaire history and grouped navigation - October 18, 2026

User requested access to patients' submitted questionnaires and related pages grouped under sidebar submenus. This is an additive change to existing panel addresses, with no dependency, schema, credential or clinical-processing change.

## Before and after

| Before | Delivered behavior |
| --- | --- |
| Patient questionnaire workspace lists available questionnaires and opens a form. Saved submissions have no patient review screen. | Available and My submissions tabs share `/panel/my/questionnaire`. `?view=submissions` opens dated cards, and `?view=submissions&submission=<public ULID>` opens saved questions, selected answers, version, score and recommendation. Paging and reload retain the history location. |
| Sidebar displays related administration pages as individual top-level entries. | Appointments & care, Questionnaires, People, Catalog and root Settings use existing Velzon submenus. Patient appointments and questionnaires are grouped; the doctor's single reservation link stays direct. Home, Activity and Payments remain direct. No empty or unnecessary single-item group is emitted. |
| Active navigation is based on exact path and imperative template activation. | Product menus derive selection from the current path/query, retain the containing group on detail pages and expose unique controls/current/expanded states. A group can be opened or closed without navigation. Retained developer tools keep their existing adapter. |

## Ownership and historical accuracy

New GET-only `/api/my/questionnaire-submissions` and `/api/my/questionnaire-submissions/{public ULID}` readers require an authenticated active patient. They reload account/role authority before and after reads, bind every query to the current account, and return private/no-store responses. Unowned, guest and archived submissions are unavailable. Doctor/admin/root callers cannot use this patient reader; their existing administration permissions are unchanged. Owner filters cannot select another account.

Responses use explicit projections. No submitter contact/identity fields, guest tokens, internal metadata, choice weights or raw model serialization are exposed. Lists are bounded to twelve records; details use the stored submission snapshot, independent of the current questionnaire's status or version. Expired answer retention removes answers and recommendation body while retaining the existing allowed summary. The client verifies the response owner against the current session, discards unused cache immediately, hides previous data during refresh/errors, and renders recommendation HTML as inert plain text. Existing ambiguous-submission and session-history protections remain.

English/Farsi copy and retained responsive cards are used without new CSS. Thumbnails remain placeholders; their upload/publication workflow remains future hardening.

## Verification and runtime

- Full frontend quality: 72 files / 746 tests, typecheck, lint, fixtures, unchanged quality ratchets and formatting pass. After the semantic status element and legacy helper-order corrections, the affected 23 tests / three files, typecheck, changed-file lint and formatting pass.
- Isolated UID33 SQLite: seven tests / 78 assertions pass, including public submission regression, ownership/guest/staff/refreshed-authority refusals, pagination, saved snapshot after definition changes/archive, retention and soft deletion. An empty isolated environment file avoids missing-environment warnings without loading project credentials. Pint checks three PHP files.
- Static admin build/recreation uses only the previously delegated `checkupino_prod` admin service. Final `a3f0286a` is healthy with 65 assets matched byte-for-byte to served identity/gzip responses and retained contract/privacy markers. The four-role matrix ran on the preceding `6ebcaeb8`; only automatic direction on stored questionnaire content changed afterward, correcting English punctuation inside the Farsi shell.
- Native served acceptance: four roles / ENFA / 1440-390px, 34 groups / 108 requests / 20 captures; final patient direction delta adds 11 groups / 37 requests / eight captures. No JavaScript exceptions, external requests, blocked writes or business-data changes. Final source/runtime binding preserves 194 unrelated source bindings and 304 historical evidence bindings. Failed browser harness attempts remain preserved: a guest probe required a same-origin login-page context, and the mobile sidebar closes through its normal overlay rather than its covered hamburger. Those corrections changed verification code only.

Backend/database/worker/scanner Compose remain operator-owned. The backend and four media services are retained. Parser/scanner/checker/worker remain stopped; two pending medical-scan jobs must stay untouched. No business save, password confirmation, download, current-engine claim, worker delivery or completed-demo replay belongs to this slice. Live profile saving remains personally deferred.

## Evidence and rollback

- `evidence/questionnaire-history-quality-2026-10-18.log`
- `evidence/questionnaire-history-source-final-2026-10-18.json`
- `evidence/questionnaire-history-backend-fixed-2026-10-18.log` (initial warning-bearing log retained)
- `evidence/questionnaire-history-static-2026-10-18.json`
- `evidence/questionnaire-history-browser-2026-10-18.json`
- `evidence/questionnaire-history-acceptance-2026-10-18.json`
- `evidence/questionnaire-history-final-context-2026-10-18.json` binds this final documentation clarification to the immutable acceptance; application source, runtime and earlier evidence are unchanged.

Retain the accepted candidate as `checkupino-admin:questionnaire-history-accepted-2026-10-18`. The locally retained predecessor `checkupino-admin:clinical-experience-accepted-2026-10-17` / `4eba1012` restores the previous panel while preserving the accepted session-history guard. Rollback is static-admin-only through the same scoped build/recreation ownership; restore the recorded image, not an old pre-privacy image. The additive read-only API may remain deployed. No schema/data rollback, credential replacement or queue operation is needed.
