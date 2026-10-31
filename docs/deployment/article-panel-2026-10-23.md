# Article and taxonomy panel delivery

Historical first-panel acceptance. Superseded for current layout/runtime/live authoring by [the Add Product and persisted acceptance](article-authoring-layout-2026-10-23.md): accepted073f9111/43 assets, enabled exact six-table schema and nine ordinary synthetic authoring writes. Fixture-only/disabled statements below describe this earlier checkpoint.

October23, Asia/Tehran. Implements all four screens in the already approved [source/design contract](article-taxonomy-proposal-2026-10-22.md). Live article schema/feature activation and positive persisted content actions remain separate.

Accepted static image: **b94e4ab0**, retained `checkupino-admin:article-panel-accepted-2026-10-23`. [Immutable acceptance/source bindings](evidence/article-panel-2026-10-23.json), [39-asset served receipt](evidence/article-panel-static-2026-10-23.json), [four completed admin cohorts in the retained partial run](evidence/article-panel-browser-1792715320239-2026-10-23.json) and [successful root/access follow-up](evidence/article-panel-browser-1792715454018-2026-10-23.json). Combined: eight staff EN/Farsi desktop/mobile cohorts,16 captures, actual guest/clinical refusals and logout protection. The partial run retains its overall failed status because root login hit a hidden dashboard overlay; the follow-up completes only the remaining checks. Thirty business/protected fingerprints, health counts, both queued jobs and every non-admin service image/state remain identical to the before receipt. Nine normal services run; all six helpers stay stopped.

Before: backend readers, taxonomy/draft writers and editorial/version recovery existed in source, with no administration screens. After: the approved screens and Content submenu are built and deployed in the static panel. With the live feature disabled they report unavailable; positive populated browser coverage uses explicitly intercepted synthetic responses, never live article writes.

| Screen | Delivered controls |
| --- | --- |
| `/panel/articles` | Retained blog grid/list, local cover placeholder, URL-owned literal search/status/author/category/topic/tag filters, quick presets, sort/order, paging and refresh |
| `/panel/articles/new` | Separate EN/Farsi native CKEditors, optional translations, slug, controlled category/topic/tag selection, fixed medical catalog, safe editorial sources and adjacent Save/Cancel/Reload |
| `/panel/articles/:articleId` | Public ULID, reservation-style identity/publication boxes, distinct working/published previews, guarded edit/submit/review/publish/archive, paged versions/events and older-version copy into a new draft |
| `/panel/article-taxonomies` | Category/topic/tag tabs, search/active filters, paging, guarded bilingual create/edit/retire, category parent selection and retained exact version history |

## Boundaries and behavior

Admin/root only. Existing grouped navigation, native dialogs, recent-password coordination and explicit reason/confirmation remain. All writers refresh the same signed context after the password step, validate matching identity and response, and bind current/source versions/hashes. Stale tokens refuse; uncertain delivery locks the editor/action until an explicit read instead of replay. Session changes abort reads/actions and remount account-owned draft state. No body, draft or health selections enter persistent browser storage.

One narrow backend addition exposes the existing fixed medical vocabulary in the admin-only draft context; it reads no patient information and permits no vocabulary mutation. The matching isolated test adds two catalog assertions. Taxonomy editing preserves absent locale keys rather than generating empty-key-only revisions. Historical term pages use immutable version IDs so several revisions of one term remain readable.

Transport adapters stay inside the product module; retained rich-text sanitization stays at the presentation/editor boundary. Preview uses inert parsing/allowlisted elements and safe escaped metadata/source links. Explicit content language controls native editor direction independently of UI language. No remote covers, embedded media, source fetch, HTML-source input, new CSS, dependency, role, patient route or recommendation rule.

## Verification and acceptance limits

- Full integrated frontend:78 files/835 tests pass; final article interaction gate37 tests passes after six additional transition/session/hostile-preview checks. Typecheck, governed lint, explicit affected-page accessibility lint, lint fixtures, architecture/debt ratchets and formatting pass. The route/menu inventories include the four approved routes; debt thresholds are unchanged.
- Isolated draft backend:44 tests/346 assertions and affected PHP style pass. Retained other source receipts give a cumulative204 tests/1674 assertions; they are retained evidence, not a claim that every older suite was rerun in this panel slice.
- Static-admin-only build/recreation under existing delegation. The accepted served/container asset receipt checks39 affected assets, immutable cache/compression, all four approved deep links and missing-asset404. The previous health image remains retained for static rollback.
- Native browser acceptance uses real synthetic login/logout, actual guest/doctor/patient refusals and actual admin/root disabled-state responses. Positive content/editor/history controls are browser fixtures because live article schema is absent. EN/Farsi1440/390 checks and immutable browser captures/receipts are linked from the final evidence. No live password confirmation/content/business mutation is allowed by its network guard.
- Read-only current/protected/health/job fingerprints and all non-admin service images/states must remain preserved. Six helpers remain stopped and both medical jobs stay untouched. No live article migration, flag change, seed/reset, backend/database Compose, helper activation or job processing.

Failed checks remain recorded: ambiguous test selectors for hidden language forms/dialog close controls; integer navigation ordering; term-history identity; shared-module import boundary; a browser action-row selector counting nested pagination and a hidden dashboard overlay target. Corrections retain the existing safeguards and layouts. Source/browser fixture checks do not certify positive live writes or real MySQL contention.

## Files and reproducibility

Frontend: `frontend/src/pages/Administration/content/{Articles,ArticleEditor,Taxonomies,Shared}.tsx`, `frontend/src/modules/checkupino/content/api.ts`, the product manifest/registry/menu, paired locales and the shared rich-text adapter's optional explicit content language. Tests: `frontend/src/test/Articles.test.tsx`, affected registry/router contracts and retained editor/source tests.

Verification: `scripts/content/verify-panel.mjs`, `panel-fixtures.mjs`, `verify-static.mjs`, existing `test-draft-writers.ps1`, and read-only `inspect-activation.php`. Browser receipts are timestamped and never overwritten; fixture code is tooling only and never imported by the application. The static acceptance receipt is immutable and must not be overwritten on a new candidate.

## Next order and rollback

1. Prepare/run the [focused disposable MySQL plan](article-mysql-plan-2026-10-23.md), preserving empty-schema admission and operator-owned database startup/recreation/cleanup. Do not replay the closed clinical19/health8 suites.
2. Use the concrete [activation/rollback package](article-panel-activation-proposal-2026-10-23.md) only after the separate migration/flag/ordinary synthetic content authorization. Exact one-file migration, effective config checks and ordinary UI/API writer acceptance; no broad migrate/reset.
3. Patient library/detail after the exact route/design approval, then reviewed recommendation rules. Personalization and clinical review are not implied by editorial publication.

Static rollback restores retained `checkupino-admin:patient-health-accepted-2026-10-22` through admin-only Compose. Future feature rollback disables only `ARTICLE_ADMIN_ENABLED` and retains all six populated content/history tables; never roll down populated history or rewind publication. The attended health and personally deferred profile saves remain separate.
