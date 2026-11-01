# Current Task

Updated: November 1, 2026 (Asia/Tehran).
Goal: finish the patient-facing blog library, then reviewed recommendations and the integrated demo.
Source baseline inspected: main at c4bd2c0, plus the current local documentation/runtime overrides. Recheck affected source when implementation begins; this is not a fresh full-suite acceptance receipt.

## Execution authority and next action

This is the current development queue. It reconstructs the recovered checklist against the actual source; it replaces the setup-only handoff and older next-action wording in TODO/PROJECT_MAP/module snapshots.
The user accepted the stage4 proposal and instructed implementation to commence. The bounded library is now implemented/deployed and its source/served gates recorded below. Unchecked later work is not newly approved deployment, data-write or dependency work; standing approvals remain valid.
**Next action:** stage5: prepare the reviewed, versioned recommendation-rule contract and reviewer authority using the now-delivered patient library/sidebar. Do not activate personal rules or restart completed stage4 work. [Stage4 delivery and evidence](docs/deployment/patient-article-library-2026-11-01.md).
Broader media hardening follows the library unless a reproduced safety defect blocks this bounded delivery. General article reading must work without a health profile, recommendation rules, fresh uploads or selectable images.

The unmodified [recovered development checkpoint](docs/ai-context/archive/CURRENT_TASK_development_checkpoint_2026-11-01.md) preserves the earlier complete checklist. Its links are relative to its original repository-root location; old machine instructions, counts and next-action statements are historical.
Machine-specific setup history is preserved in ignored `.local/install/CURRENT_TASK_setup_2026-11-01.md`; startup and installation details belong in `.local/install/README.md`, `start.ps1` and `installation-result.json`, not in this development queue.

## Verified position and evidence limits

| Slice | Position | Evidence and remaining boundary |
| --- | --- | --- |
| Patient health, fixed catalog1 | Implemented; historical source/MySQL/served gates recorded | [Health activation](docs/deployment/patient-health-activation-2026-10-22.md). Attended positive browser save/history/uncertain-delivery acceptance remains separate; seeded service writes do not close it. Managed medical-term editing is deferred. |
| Article/taxonomy administration | Implemented; historical ordinary authoring/publication/recovery accepted | [Authoring](docs/deployment/article-authoring-layout-2026-10-23.md), [MySQL](docs/deployment/article-mysql-2026-10-23.md). Working and published versions are deliberately separate. |
| Editorial JPEG/PNG and File Manager | Bounded implementation and historical real-media/UI acceptance complete | [Real media](docs/deployment/article-media-real-acceptance-2026-10-24.md), [Velzon correction/row selection](docs/deployment/velzon-file-manager-embedded-2026-10-25.md). Staff-only media is not patient image delivery or general media hardening. |
| Patient published-article library/detail | Implemented and accepted for the bounded local slice | [November1 delivery](docs/deployment/patient-article-library-2026-11-01.md): published-only APIs, retained Velzon grid/overview/author sidebar, actual EN/Farsi browser cohorts and ordinary synthetic publish/draft/archive. |
| Reviewed recommendation rules | Not implemented; follows library | Existing questionnaire scoring is not this shared reviewed-rule system. |
| Combined demo freeze | Pending | Role/auth/API smoke checks do not establish full business-workflow acceptance. |

These positions combine inspected source with historical reports; no historical test total or acceptance suite was rerun during reconstruction. Generated receipts/screenshots are excluded from Git and may be absent on this clone: [evidence policy](docs/deployment/evidence/README.md).
The November 1 fresh-instance checks established app/auth/role API health, real scanner/parser checks and basic background processing. They do not certify every mutation, concurrency case, storage backend, continuous medical-delivery case or scheduled publication.
Known drift: PROJECT_MAP describes pre-activation media state; TODO's broad Phase 4 boxes omit delivered administration and its execution table contains older intermediate steps. Use this queue and later closeouts; do not restart completed administration/media work from those stale lines.

## Standing decisions and scope

- Retain Velzon React/Bootstrap, the shared File Manager, CKEditor and approved EN/Farsi language-owned direction. Reuse template composition without importing mock business data.
- Already agreed October 25: `/panel/my/articles` for discovery and `/panel/my/articles/:articleId` for detail, using public ULIDs. Language stays in the existing selector; filters use ordinary query parameters. No health values in URLs.
- Use categories/tags; do not restore the removed Topics control.
- Latest explicit detail-page direction: use http://localhost:3000/panel/dev/pages-blog-overview (frontend/src/pages/Pages/Blogs/Overview/index.tsx). Preserve its author block, sidebar and adjacent article body; use the sidebar space below the author for recommendations and article extras. This reference/layout choice is settled. Do not replace it with an author-less page or infer unrequested widgets. Stage5 review requirements still govern personal recommendations.
- General reading is authenticated patient functionality. Public SEO/blog routes, tenant syndication, commerce and new content-manager roles are separate work.
- Existing article schema, staff URLs, source design and completed media activation approvals remain recorded. Do not ask for them again.
- Already settled by the [approved content contract](docs/deployment/article-taxonomy-proposal-2026-10-22.md): whole-complete-translation fallback with an explicit language label; published content remains unchanged by working drafts; archive hides future patient reads; retired taxonomy references retain their versioned labels and already published content remains readable. Verify and implement these rules rather than reopening them.
- Stage4's concrete composition, patient API/payload, ordering/filter-option presentation and publication-bound image behavior were accepted and implemented. Use the proposal/delivery contract instead of reopening these choices. Additional sidebar widgets and stage5 clinical-rule authority are separate; do not broaden staff-library permissions.
- Latest local instructions supersede source-laptop restrictions: the user requested a fresh reset, then authorized workers, scheduler and article publisher, and subsequently requested boot. No new reset/reseed is needed for development.
- Preserve current records, credentials, configuration, immutable history and unrelated work unless a new task requires a reviewed change. Never use manual clean/paid/published verdicts or fabricate clinical review.
- Do not apply historical protected numeric IDs, old two-job inventories, image hashes or database fingerprints to this new database.
- Work only in this project's checkout/runtime. Other projects, including hazelnut2.0 and NebulaNV, remain outside scope.

## 4. Patient article discovery - active objective

Completion gate: an authenticated patient can discover and read the correct published examples in EN/Farsi on desktop/mobile, without draft/review/archive leakage and without needing health information or personal recommendations.

### 4a. Prepare the reader and retained-page contract - do this first

Accepted by the user before implementation: [patient library proposal](docs/deployment/patient-article-library-proposal-2026-11-01.md). Implementation and scoped acceptance are now recorded in the linked November1 delivery report.

- [x] Recover the agreed patient page URLs and compare the queue with routes, services, frontend registry and tests.
- [x] Select retained Pages/Blogs/GridView and Overview composition, patient Content entry, controls, server paging and responsive states; preserve template/toolbox originals.
- [x] Record the user's exact live overview reference and retained author/sidebar composition. Inspect the live page and source; reserve the area below the author for recommendations and article extras, with personal rules still inactive until stage5.
- [x] Propose exact patient list/detail/filter/media GET contracts, bounded parameters, patient-only authority and safe payloads; reuse one controller/read service, existing schema/flags/query layer.
- [x] Carry forward the approved published-version rule into the contract: working drafts cannot change patient text/search/taxonomies/media/order; archive hides future reads.
- [x] Carry forward approved whole-complete-translation fallback and retained taxonomy labels; propose explicit published-only filter options and ordering without a fabricated publication timestamp.
- [x] Propose image authorization bound to the accessible current published article/version and selected complete language, without granting staff inventory or medical-file access.
- [x] Propose placeholders/inline omission for unavailable objects while preserving the current 48-hour evidence/integrity checks; distinguish corrupted article manifests from unavailable image bytes.
- [x] Record inherited authority, exact remaining choices, minimal files and focused acceptance cases in the linked proposal. No application/runtime/database/dependency change was made for this planning stage.
- [x] User accepted the remaining library/API/media proposal by instructing implementation to commence. The exact overview reference and author/sidebar placement are now user-directed, alongside the existing route/framework/translation/publication/taxonomy/staff-media decisions. Specific additional sidebar widgets remain open.

### 4b. Implement published readers after the contract is accepted

- [x] Add narrowly scoped authenticated list/detail readers with fresh account/role checks and deliberate invalid-ID/not-found/privacy behavior.
- [x] Return a patient-specific published representation, not a trimmed staff response containing working versions, reviewer context, audit/history, internal actor identities, signed mutation contexts or storage internals. Any public author attribution belongs in the agreed reader contract.
- [x] Enforce archived/unpublished refusal across discovery, filters, deep links and direct IDs. Retain private/no-store behavior; a different caching policy must be part of the contract.
- [x] Add publication-bound image delivery only as agreed in 4a; verify stored reference/checksum and permitted state. Do not relax staff-library or medical-download authorization.
- [x] Keep reading independent of health/questionnaire records and recommendation evaluation. No personal-match claims, public SEO surface or unrelated administration changes.
- [x] Add focused isolated tests for published-versus-working selection/search, language fallback, paging/filter bounds, archive transitions, role/account revocation and image reference/eligibility/integrity refusals.

### 4c. Wire the retained patient interface

- [x] Add the two agreed routes/loaders and patient navigation through the existing registry, transport and authorization patterns.
- [x] Implement the agreed EN/Farsi grid/detail, search/category/tag filters, pagination, complete-translation fallback and useful states with real APIs.
- [x] Render only the patient published contract and approved sanitized content; implement safe covers/inline images without exposing staff-only image URLs.
- [x] Preserve keyboard/focus, selected filters, language direction, deep-link/reload/back behavior and desktop/mobile usability. Do not redesign unrelated Velzon surfaces.
- [x] Add focused UI/contract tests for affected behavior; no template/mock data in the served product.

### 4d. Accept the integrated library candidate

- [x] Run focused backend/UI checks and required quality gates for changed files. Broaden regression only for affected integration or release concerns.
- [x] Verify native EN/Farsi desktop/mobile list/detail/search/filter/paging and safe no-image states, with absence of a health-profile prerequisite separately proven by the isolated empty-health API case. The native browser account uses the existing seeded profile; do not claim a new live empty-health save/rehearsal.
- [x] Verify guest, unsupported-role, logout/account-switch/revocation and direct-ID boundaries; no unpublished content, private medical data or staff controls may leak.
- [x] Use a concrete, authorized synthetic fixture plan to verify publication followed by draft editing, archive and relevant media revocation/failure transitions. Do not replay completed historical writer harnesses or call a read-only check positive mutation acceptance.
- [x] Record source/candidate bindings, actual tests/outcomes, synthetic data changes, failures, rollback and remaining limits. Preserve populated content/history on rollback.

### 4e. Requested full-length seed and visible sidebar follow-up

- [x] Add a repeat-safe bilingual full-length showcase through ordinary article writers, with all supported text formats and genuinely verified block/side/inline/captioned images.
- [x] Show general published recommended reading below the author; exclude self and retain patient-only readers. Personal clinical matching remains stage5.
- [x] Accept isolated seed/read/media tests, real-scanner/parser fresh seed repeat, frontend gates and served EN/Farsi desktop/mobile layouts. Preserve all original populated-demo rows.
- [x] Record the deployed candidate, additive live seed, counts and rollback in [showcase delivery](docs/deployment/article-showcase-2026-11-01.md). Next remains the first unchecked stage5 item.

## 5. Reviewed, versioned recommendation rules - after the library

- [ ] Prepare one bounded contract for article/checkup/self-care targets: stable fields/terms, intended population, units, freshness, missing/none/unknown/declined states, exclusions, sources, explanations and content/rule versions.
- [ ] Define reviewer/publisher authority and actual clinical review, with review/publish/revoke history. Unreviewed rules remain inactive; do not invent a role.
- [ ] Implement deterministic owner-only evaluation with positive/negative/missing/stale/contradictory inputs, changed/cleared facts, retired terms, revoked rules and unpublished/archived targets covered.
- [ ] Accept reviewed synthetic examples, no-match and insufficient-data states; keep health/match reasons out of public URLs, operational logs, analytics and notifications.
- [ ] Accept required activation/rollback separately. If actual review is unavailable, retain the general library and label personalized recommendations unavailable.

## 6. Integrated four-role rehearsal and demo freeze

- [ ] Run one integrated candidate through patient/doctor/admin/root-admin, EN/Farsi and desktop/mobile: auth/navigation, current booking/payment availability, health, questionnaires/history, medical published history, article administration/library and reviewed suggestions.
- [ ] Distinguish historical accepted workflows, fresh source tests, deployed read-only checks and positive writes. Keep the attended health save, deferred personal profile save and unproven admin mutations explicit.
- [ ] Check account/session changes, CSRF, duplicate/uncertain delivery, audit/privacy and recovery across changed surfaces; avoid replaying completed business actions.
- [ ] Refresh walkthroughs and release/rollback notes, record known limits and freeze one identifiable candidate. Read-only rehearsal is not real-patient production readiness.

## Media hardening and scheduling - separate work, not the library prerequisite

Bounded image support and running daemons do not close this list. Prioritize a reproduced safety defect; otherwise preserve the library-first order.

- [ ] Real MySQL media admission/retirement/publication interleavings and audit rollback. Earlier article/taxonomy MySQL acceptance is not evidence for these media cases.
- [ ] S3/SeaweedFS purpose-separated private lifecycle, ACL/access denial and failure acceptance. A source adapter and local-file tests do not prove the remote backend.
- [ ] Durable bounded orphan/stalled-upload reconciliation after ambiguous persistence. Current upload code intentionally leaves an inaccessible private orphan rather than deleting possibly committed data.
- [ ] File Manager folder authority across browse/search/select/upload and future move/copy/delete, with server-issued actor/purpose/action/expiry/revision context and deny precedence. The single-purpose folder is not an ACL system.
- [ ] Archive/audio/video validators, larger transport and resumable S3 multipart ownership/session/retry/cancel/abort/cleanup/capacity before enabling those formats.
- [ ] Deployed medical continuous-processing acceptance: ordinary synthetic upload through queue/scanner/parser to authorized access, progress, retries/duplicates/failures, outages/definition aging, integrity/audit and stop/recovery. Fixture handlers and an encrypted no-op worker probe do not replace the complete continuous-delivery matrix.
- [ ] Scheduled article publication acceptance: MySQL contention/rollback, due exact-version delivery, revocation, duplicate/restart/clock behavior and supervised heartbeat. The local publisher is enabled and basic ticks verified by user request; historical "disabled" statements are stale, but the full gate remains open.
- [ ] Questionnaire/doctor thumbnails/avatars/ratings, sanitized previews, scan/read capacity, encrypted temporary/storage/backup lifecycle and restore/retention/release controls remain separate.
- [ ] Managed medical terms need stable IDs, historical/backward readers, no ID reuse and correct unknown/none/declined semantics before mutation. Cross-device themes, refund policy/provider execution, public site/commerce/mobile/tenants, CI and optional dashboards remain deferred.

## Stage4 source and regression references

- Current backend boundary: `routes/api.php`, `app/Services/Content/ArticleAdministrationRead.php`, `ArticleMediaLibrary.php`, `ArticleMediaEligibility.php` and `ArticleMediaReferences.php` in the same service directory.
- Current frontend boundary: `frontend/src/modules/checkupino/manifest.ts`, `frontend/src/panel/registry.ts`, `frontend/src/modules/checkupino/content/media.ts` and `api/transport.ts` in that module. Existing article/image paths are staff-only.
- Retained references: `frontend/src/pages/Pages/Blogs/GridView/index.tsx`, `Pages/Blogs/Overview/index.tsx` under that pages directory, and existing Administration/content screens. Exact patient composition is now in the linked 4a proposal; template data is not product content.
- Existing regression contracts: `tests/Feature/Api/ArticleAdministrationReadTest.php`, `ArticleMediaTest.php` in that directory, and `frontend/src/test/Articles.test.tsx` / `ArticleMedia.test.tsx`.
- Development history: [TASK_LOG](docs/ai-context/TASK_LOG.md) and the accepted article/media reports above. Historical receipts are not instructions to rerun their writers.

## Working and handoff rules

1. Read this file after AI_BOOT/CODEX_RULES. Use source over conflicting historical prose; investigate discrepancies instead of guessing an execution order.
2. Stage4 is delivered; start with the first unchecked stage5 contract item. Do not repeat stage4 writers, re-approve settled UI/routes or reopen setup without a verified blocker.
3. Use isolated UID33 synthetic database/storage/environment/cache tests, with no live private mounts. Old scripts pin removed images and historical states; inspect before use, never weaken guards to replay accepted writers.
4. Record completed versus pending gates honestly. Update this checklist and affected small context/runbook after verified changes; retain the existing TASK_LOG split layout.
5. Documentation work does not authorize app/schema/dependency changes, resets, downloads, business writes or external publication. Honor standing approvals and ask only for genuinely missing decisions on a concrete proposal.
