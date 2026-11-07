# Current Task

Updated: November 8, 2026 (Asia/Tehran).
Goal: finish reviewed recommendation acceptance, then the integrated demo; preserve the delivered patient blog library.
Imported baseline: ac57e6d from the other PC. The November8 source publication checkpoint includes recommendation implementation, tests and both completed MySQL slices; deployment and clinical activation are separate. [Changes since pull and resume instructions](docs/deployment/recommendation-handoff-2026-11-08.md).

## Execution authority and next action

This is the current development queue. It reconstructs the recovered checklist against the actual source; it replaces the setup-only handoff and older next-action wording in TODO/PROJECT_MAP/module snapshots.
The user accepted the stage4 proposal and instructed implementation to commence. The bounded library is now implemented/deployed and its source/served gates recorded below. Unchecked later work is not newly approved deployment, data-write or dependency work; standing approvals remain valid.
**NEXT - section 5:** define the intended initial recommendation criteria and obtain actual independent clinical review of their sources, population, limitations, freshness and target articles. The eight-case catalog and16-case cross-module MySQL slices, including operator cleanup and exact absence/source verification, are complete. [Current acceptance](docs/deployment/recommendation-mysql-cross-module-2026-11-08.md). Do not replay accepted writers. Separately authorized live migration/flags/static-admin/served acceptance follows; source approvals are unchanged.
File/change boundaries for the next review and activation slices: [dependency and conflict map](docs/deployment/recommendation-change-impact-2026-11-08.md). No unresolved Git merge exists; shared dirty files and accepted source bindings require narrow sequential edits. Clinical criteria are versioned records, not evaluator code changes.
Broader media hardening follows the library unless a reproduced safety defect blocks this bounded delivery. General article reading must work without a health profile, recommendation rules, fresh uploads or selectable images.

The unmodified [recovered development checkpoint](docs/ai-context/archive/CURRENT_TASK_development_checkpoint_2026-11-01.md) preserves the earlier complete checklist. Its links are relative to its original repository-root location; old machine instructions, counts and next-action statements are historical.
Current machine is the original `C:\Users\Pain\Desktop\work\checkupino` Windows/WSL laptop. The imported November1 ASUS fresh-instance setup/reset/worker/publisher permissions and `.local/install` records belong to that other PC. Do not apply them to this database or its two pending jobs. November7 operator recovery restored the existing four backend services; HTTP200, UID33 MySQL/Redis, false recommendation flags, absent recommendation schema and two queued jobs were verified. Nine intended services run; scanner/parser/checker/worker remain stopped for this slice.

## Verified position and evidence limits

| Slice | Position | Evidence and remaining boundary |
| --- | --- | --- |
| Patient health, fixed catalog1 | Implemented; historical source/MySQL/served gates recorded | [Health activation](docs/deployment/patient-health-activation-2026-10-22.md). Attended positive browser save/history/uncertain-delivery acceptance remains separate; seeded service writes do not close it. Managed medical-term editing is deferred. |
| Article/taxonomy administration | Implemented; historical ordinary authoring/publication/recovery accepted | [Authoring](docs/deployment/article-authoring-layout-2026-10-23.md), [MySQL](docs/deployment/article-mysql-2026-10-23.md). Working and published versions are deliberately separate. |
| Editorial JPEG/PNG and File Manager | Bounded implementation and historical real-media/UI acceptance complete | [Real media](docs/deployment/article-media-real-acceptance-2026-10-24.md), [Velzon correction/row selection](docs/deployment/velzon-file-manager-embedded-2026-10-25.md). Staff-only media is not patient image delivery or general media hardening. |
| Patient published-article library/detail | Implemented and accepted for the bounded local slice | [November1 delivery](docs/deployment/patient-article-library-2026-11-01.md): published-only APIs, retained Velzon grid/overview/author sidebar, actual EN/Farsi browser cohorts and ordinary synthetic publish/draft/archive. |
| Reviewed recommendation rules | Approved source implementation; activation remains closed | Six additive tables, bounded evaluator, exact-version review/publication, scoped reviewer media, retained EN/Farsi staff controls and private patient sidebar. Actual clinical review, MySQL interleavings, live migration/deployment and served acceptance remain separate. |
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
- Imported fresh-instance reset/workers/scheduler/publisher instructions apply to the other PC only. Current laptop runtime changes require their own scope; no reset/reseed or general worker is needed for recommendation source work.
- Preserve current records, credentials, configuration, immutable history and unrelated work unless a new task requires a reviewed change. Never use manual clean/paid/published verdicts or fabricate clinical review.
- Reinspect the current machine before using historical numeric IDs, counts, hashes or fingerprints. The current November7 read-only check found two queued jobs; no job content was read or consumed.
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

## 5. Reviewed, versioned recommendation rules - current source slice

- [x] Prepare the bounded [contract](docs/deployment/recommendation-rules-proposal-2026-11-05.md): fixed fields/catalog, units, freshness, unknown/none/declined/cleared states, exclusion logic, sources, explanations and exact versions. Articles are implemented; checkup/self-care adapters remain rejected pending their own contracts.
- [x] Record explicit user approval of the six-table source schema, three canonical panel routes/retained controls and existing-role reviewer model. Admin/root author and publish; explicitly designated active verified doctors independently review; author and reviewer must differ. No reviewer grant or clinical rule is seeded.
- [x] Implement additive persistence and empty-only rollback; immutable draft/review/withdrawal history, exact target/hash/publication bindings, fresh authority, scoped reviewer image delivery, atomic metadata-only audit and idempotent actions.
- [x] Implement owner-only deterministic matching, disabled independently from authoring. Missing/stale/cleared/unknown facts do not become negative facts; unknown exclusions block matches. General article reading remains independent. Patient results are ephemeral and do not enter URLs, business history, logs or notifications.
- [x] Wire the approved EN/Farsi rule editor, reviewer/publication controls, root designation controls, fixed synthetic predicate preview, version/review metadata and patient sidebar. Save/Cancel share one fieldset action row. Source tests are not served/browser acceptance.
- [x] Complete and record the current focused source/affected-article regression:158 tests/1,118 assertions; frontend5 files/117 tests, TypeScript and affected quality gates. The linked report retains the interrupted run, clock correction and exact-review withdrawal hardening. No served acceptance or actual clinical review is claimed.
- [x] Prepare the first eight-case MySQL schema/catalog package, exact52-file source binding/preflight and unchanged admission guard (31 checks). Harness fixture and assignment-refusal expectations are corrected and retained in the linked report.
- [x] Accept all8 forced MySQL catalog interleavings on fresh MySQL8.0.46/repeatable-read, migration/empty rollback and exact versions/reviews/audits/catalog invariants. Failed fixture/authority expectations are corrected and retained; original sources/runtime and test sentinel preserved. The accepted writer is closed to replay.
- [x] Verify operator-owned removal of the exact disposable MySQL container/network and zero project members; all accepted source bindings still match. Nine normal services remain running, helpers stopped, main flagsfalse/schemaabsent/jobs2 and HTTP/MySQL/Redis checks pass.
- [x] Prepare the separate remaining MySQL package: fixed16 real interleavings plus negative-link/expiry/health/replacement protocols, separate runner/evidence and135-file source proof. Offline20/155, syntax/style/preflight and31 admission checks pass. Existing pins/guards and the accepted eight-case writer are unchanged.
- [x] Verify operator-started disposable health/isolation/empty schema and execute the prepared cross-module package once. All16 actual waits pass on MySQL8.0.46/repeatable-read; source/runtime/queue preservation verified. No failed native attempt or replay.
- [x] Verify invalid rule-version, article-version and reviewer/grant-owner foreign-key bindings are rejected; preserve canonical JSON and immutable history.
- [x] Verify article publication/archive racing with rule review/publication and patient recommendation reads; prevent mixed or obsolete target versions.
- [x] Verify owner health saves/clears racing with recommendation reads, including missing/stale information; keep results current, owner-only and out of logs.
- [x] Verify account/role/verified-profile changes, designation expiry/revocation and exact review withdrawal/replacement racing with clinical actions or matching. Check the affected atomic-audit/stale-delivery paths without repeating completed catalog cases.
- [x] Accept this separate package:16 real interleavings plus five FK refusals, canonical JSON, populated rollback refusal, expiry/health-state and exact review replacement checks. [Evidence and limits](docs/deployment/recommendation-mysql-cross-module-2026-11-08.md).
- [x] Verify operator cleanup of the exact disposable container/network, zero project container/network members and all142 unchanged accepted source hashes. Immutable cleanup receipt recorded; this test lifecycle is closed. No durable volume/live project operation.
- [ ] Obtain actual independent clinical review of intended criteria, sources, population/limitations, freshness and target content. Synthetic fixtures prove software mechanics only.
- [ ] Prepare a separate exact live migration/flags/static-admin activation and rollback package. `RECOMMENDATION_RULES_ENABLED` and `PATIENT_RECOMMENDATIONS_ENABLED` default false; authoring can be accepted while matching remains disabled. No live grant, health read, clinical approval or new patient recommendation is currently authorized.
- [ ] After separate authorization, accept ordinary synthetic author/reviewer/publication/withdrawal and owner suggestions in the served EN/Farsi desktop/mobile candidate. Retain the general library when personal suggestions are unavailable, then proceed to stage6.

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
2. Stage4 and stage5 source/MySQL acceptance are delivered; follow the first unchecked stage5 clinical-review and separate activation gates. Use the linked dependency map before edits. Do not replay accepted writers, re-approve settled UI/routes or reopen setup without a verified blocker.
3. Use isolated UID33 synthetic database/storage/environment/cache tests, with no live private mounts. Old scripts pin removed images and historical states; inspect before use, never weaken guards to replay accepted writers.
4. Record completed versus pending gates honestly. Update this checklist and affected small context/runbook after verified changes; retain the existing TASK_LOG split layout.
5. Documentation work does not authorize app/schema/dependency changes, resets, downloads, business writes or external publication. Honor standing approvals and ask only for genuinely missing decisions on a concrete proposal.
