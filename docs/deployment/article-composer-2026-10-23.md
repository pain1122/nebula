# One-page article composer

October23, Asia/Tehran. User explicitly requested Add article navigation, all article settings on the editor, a Draft/Publish/Schedule action dropdown and a clearer grid. This is the design/navigation authorization for these changes on the existing approved URLs; no new canonical panel URL, dependency or schema is introduced.

## Before and after

Previously the editor saved drafts only. Publishing required leaving it and using separate submit/review/publish controls. The medical-reference checklist occupied the main writing column, categories/tags had repetitive separate cards, and Add article was absent from the sidebar.

Now **Content -> Add article** opens `/panel/articles/new`. Only that navigation entry is active there. The main Velzon eight-column area contains language tabs, title, shared English slug,400/250px CKEditor and the SEO accordion. The four-column sidebar contains Publication, one combined Categories and tags card and a collapsed Medical references section. Existing bilingual relationships, hidden historical topics/sources, SEO limits/safe JSON-LD, English/Farsi direction and adjacent Save/Cancel remain.

The Publication card contains one **Draft / Publish / Schedule** select and matching action button:

- **Draft:** ordinary immutable draft save, preserving any existing published version.
- **Publish:** preview the exact content in one dialog and explicitly confirm editorial review/publication, with ordinary reason and recent-password controls. One server transaction runs the existing draft/submit/review/publish services and their individual audits. It does not manually set a clean/paid/completed state or bypass editorial validation.
- **Schedule:** shows its Tehran date/time on this same editor. The confirmed server operation can save, review and arm the exact version atomically when the separately gated scheduling runtime is available. Missing schema/flags/current publisher heartbeat disables the scheduling submission and explains why. No fake scheduling success or manual date-only publication.

After saving, the editor stays open at `/panel/articles/:articleId?edit=1`; settings remain in the same composer. Cancel returns to the existing list/details without saving. Existing record/history/recovery/archive surfaces remain accessible; this change does not delete version history or broaden patient/doctor permissions.

## Atomic publication and safety

The existing draft endpoint accepts a bounded optional `intent` and requires explicit `editorial_confirmed` for publish/schedule. Older clients without an intent keep their original draft-only behavior. The signed write revision, fresh active staff authority, recent password, confirmation, content/taxonomy integrity and reason checks still run. The composer delegates to the existing editorial/scheduling services with fresh internal contexts while holding the outer catalog transaction. All ordinary audits remain. A late validation/audit failure rolls back draft creation, review, publication and schedule changes together.

Publishing an unchanged reviewed version uses that exact version without appending a duplicate. Duplicate/stale delivery remains a conflict; the client never automatically replays an ambiguous write. Confirming publication is editorial review by the acting authorized staff member, not a claim of independent clinical review or active patient recommendations.

## Verification and deployment

Source backend gate: **237 tests/1,813 assertions**, including seven new composer cases on top of the scheduling/schema regressions. Coverage includes one-operation audited publication, unchanged reviewed publication, draft-only behavior, missing review confirmation, incomplete-content rollback, unavailable/available scheduling, late audit failure rollback and ordinary publication on the unmigrated legacy runtime. UID33, pinned existing PHP image, network none, SQLite memory and isolated environment/cache/private storage; no live writer or queued job.

Frontend gate: **165 tests across four affected files**, including57 article/composer cases plus navigation/router checks. Typecheck, lint, affected-page lint, formatting, quality ratchets and three-file PHP style pass. The encoding regression test requires actual Arabic-script Farsi labels and refuses question-mark/replacement-character corruption. Build retained the existing dependency layers; no install/dependency update.

The final static candidate is `sha256:a85a88d455ff2a4595278c7688f258310501e5fb89539c3d7f802f9bc614c04b`. Served/container byte and compression checks pass45 assets. The prior accepted `checkupino-admin:article-controls-accepted-2026-10-23` remains the static rollback. Only the delegated static-admin service was rebuilt/recreated; backend/database/scanner/parser/workers were not operated.

Final native acceptance passes eight real admin/root English/Farsi desktop1440/mobile390 cohorts:24 check groups,24 captures and132 requests, with actual mouse/keyboard input, native CKEditor, publish-preview/cancel, action selection/date availability, active navigation, sidebar/SEO/counters/editor height and role sessions/logout. It blocks every content write/download and permits only ordinary login/logout mutations. Final browser closeout preserves30 business/protected/audit fingerprints, zero health rows, both medical jobs and all other14 service images/states. Final receipt: `evidence/article-composer-browser-1792786023131-2026-10-23.json`; source/runtime bindings are in `evidence/article-composer-2026-10-23.json`.

Retained corrections: the first two browser attempts exposed verification-script selector errors (escaped attribute selector; explicit-role selector against a native `<dialog>`). No content writes occurred. An interim complete functional matrix did not catch newly entered Farsi strings corrupted into question marks; visual inspection rejected that candidate. The final Farsi strings are UTF8-correct, with source/native preflight encoding assertions and a fresh final candidate matrix. Do not treat the interim image7a3033 or its matrix as final Farsi acceptance. All attempts/receipts/captures remain retained.

## Runtime boundary and next action

Immediate draft/publish composition is deployed against the existing enabled six-table article foundation. A successful live write through this new combined control was deliberately not performed; the user can exercise it with the normal confirmation controls. Native verification is read-only with respect to content. Existing article1/version3/taxonomy3/link9 history and business/health/protected fingerprints/two medical jobs are retained.

Scheduled publication still has no live extension migration, no enabled presentation/scheduling/publisher flags and no supervised dedicated publisher. Previous source-only approval does not authorize those operations. The Schedule option is visible and truthful rather than presented as an active automatic service. Do not run the general scheduler/queue or consume the two medical jobs to activate it.

Next prioritize the narrowly scoped scheduled-publication MySQL/activation package and its separate authorization, then the already approved private editorial image library/manifest and real File Manager thumbnail/editor integration. Those media controls remain open. Patient library/public blog pages and reviewed recommendation rules follow the active checklist.

Static rollback restores only the prior accepted admin image using the existing delegated admin-only Compose command with a temporary `CHECKUPINO_ADMIN_IMAGE=checkupino-admin:article-controls-accepted-2026-10-23` override, `up -d --no-deps --no-build --pull never admin`, then removes that temporary variable. Retain current backend readers/services and all database/version/audit history; no reset/down/reseed or published-pointer rewind.
