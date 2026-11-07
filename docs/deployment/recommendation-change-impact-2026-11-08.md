# Recommendation changes: files, dependencies and edit order

November8, 2026, Asia/Tehran. Scope: clarify the delivered recommendation package and its next review/activation work; preserve the dirty worktree and accepted evidence. This document does not activate anything.

## Pre-publication conflict snapshot

`git ls-files -u` returns no entries: there is no unresolved Git merge. There are22 modified tracked files plus untracked recommendation files/directories from the approved work. Untracked files are part of this delivery, not disposable leftovers. No fetch/pull/reset/checkout/stash, file removal or application edit was performed for this map. That inspection did not check remote divergence. At the subsequent November8 publication fetch, origin/main still matched imported ac57e6d; there was no remote change to reconcile. The [publication handoff](recommendation-handoff-2026-11-08.md) supersedes this snapshot for resume instructions.

The remaining risk is overlapping edits to shared files and invalidating source-bound acceptance, rather than an existing merge conflict. Keep changes sequential and compare individual hunks with the current worktree. Do not replace whole shared files with copies from another PC.

## What changes next

1. Prepare the initial rule/content review dossier: intended article/version, condition tree, exclusions, EN/Farsi explanations, population, limitations, evidence sources, freshness and review validity. This is documentation first; do not invent clinical approval.
2. Prepare a separate exact activation/rollback package: inspect current schema/config/candidate, identify only the existing recommendation migration, verify disabled behavior, and separate authoring from personal matching. Package preparation is source work; executing a live migration, granting a reviewer or enabling flags requires the separate authorization already listed in CURRENT_TASK.
3. After that authorization, verify deployed authoring and ordinary synthetic review/publication/withdrawal, then the owner-only sidebar in EN/Farsi desktop/mobile. Actual criteria still require qualified independent review before personal matching is activated.

The authoring deployment can be accepted while personal matching stays disabled. Initial clinical criteria and future threshold changes are **versioned database content**, not PHP constants or seeders. An edit creates a new immutable working version and needs exact-version review/publication; existing published history is preserved. Changing a target article's published version can invalidate the old rule target and requires rebinding/review through the normal controls.

## Direct files and downstream impact

Paths below are relative to the project root. Existing source is implemented and tested; an entry here does not mean the file needs another edit.

| Change | Direct files | Consumers and required verification |
| --- | --- | --- |
| Initial clinical review material | Proposed new `docs/deployment/recommendation-initial-review-2026-11-08.md` | Human review feeds ordinary rule authoring later. No runtime import, seed, automatic grant or patient-data access. Do not put private qualification documents or patient details in Git. |
| Activation/rollback preparation | Proposed new `docs/deployment/recommendation-activation-proposal-2026-11-08.md`; any exact helper scripts must be enumerated there before execution | Existing migration/config, backend cache handling, static-admin build and served checks. No Docker image/Compose definition change is currently established as necessary. |
| Runtime availability | Private `.env` at authorized activation only; `config/recommendations.php` already maps `RECOMMENDATION_RULES_ENABLED` and `PATIENT_RECOMMENDATIONS_ENABLED` | `RecommendationAuthority.php` gates staff/reviewer operations; `PatientRecommendationService.php` also requires health and article features. Environment changes must be verified against effective Laravel config, including any existing config cache. Frontend source tests alone do not prove runtime availability. |
| Database deployment | Existing `database/migrations/2026_11_05_000001_create_recommendation_rule_tables.php`; no schema edit currently planned | Four `app/Models/Recommendation*.php` models, administration/authority/content/preview/patient services and APIs. Additive six-table migration only; populated rollback deliberately refuses deletion. Disable flags for rollback; do not drop history. |
| Rule definition validation/evaluation, only if supported semantics change | `app/Services/Recommendations/RuleCondition.php`, `RulePredicateEvaluator.php`, `PredicateOutcome.php` | `RecommendationContent.php`, `PatientRecommendationService.php`, `SyntheticRecommendationCases.php`; frontend condition parser/editor; predicate/API/UI and source-binding gates. A reviewed value/threshold change using existing operators does not require these edits. |
| Draft/review/grant/publication behavior, only if a defect or new requirement arises | `RecommendationAdministration.php`, `RecommendationAuthority.php`, `RecommendationContent.php`, `RecommendationTargetPreview.php` in `app/Services/Recommendations/` | `app/Http/Controllers/Api/RecommendationController.php`, existing models, `AuditLogger.php`, article/media eligibility and patient matching. Changes can affect review validity, hashes, locks, history and privacy: assess the affected MySQL cases before deployment. |
| Patient evaluation, only if behavior changes | `app/Services/Recommendations/PatientRecommendationService.php` | Existing `app/Services/Health/PatientHealthService.php`, `HealthCatalog.php`, `app/Services/Content/PatientArticleRead.php`; owner API response, client parser and sidebar. Preserve self-report provenance, missing/stale/cleared states and no health reads for ineligible content. Health/article services are dependencies, not planned edits. |
| API shape, only if contract changes | `app/Http/Controllers/Api/RecommendationController.php`, recommendation sections of `routes/api.php` | `frontend/src/modules/checkupino/recommendations/api.ts`, `frontend/src/modules/checkupino/api/transport.ts`, staff screens and patient sidebar; backend API and frontend response/transport tests must change together. No new URL is currently needed. |
| Staff screen correction found in served acceptance | `frontend/src/pages/Recommendations/index.tsx`, `RuleEditor.tsx`, `RuleReview.tsx`, `ConditionEditor.tsx`, `Shared.tsx` | Existing `recommendations/api.ts`, shared `profiles/useClinicalWrite.ts`, paired locale keys and `frontend/src/test/Recommendations.test.tsx`. Shared write hook is a dependency, not an edit target unless a reproduced defect requires it. |
| Patient sidebar correction found in served acceptance | `frontend/src/pages/PatientArticles/PersonalSuggestions.tsx`, existing `ArticleDetail.tsx`, recommendation API module | General library API/parser, published cards, account-switch/query invalidation and EN/Farsi unavailable states. Keep general Recommended reading separate and usable. |
| New visible text | Matching keys in `frontend/src/locales/en.json` and `fa.json` | Staff/patient screens; preserve equivalent meaning, interpolation and existing direction handling. Change only the affected recommendation keys. |
| Navigation/registration, only if a defect is found | `frontend/src/modules/checkupino/manifest.ts`, `frontend/src/panel/registry.ts`, `menu.ts` | Role-specific navigation, deep links and `frontend/src/test/productRegistry.test.ts`. Approved routes already exist in source; do not register duplicates. |
| Shared article rendering, only if a defect is found | `frontend/src/modules/checkupino/content/articleRichHtml.ts`; existing `frontend/src/pages/Administration/content/articleRichHtml.ts` compatibility export | Article administration, patient library and recommendation previews. Preserve the single sanitizer implementation and old import compatibility. Run affected article tests if edited. |

## Shared-file conflict hotspots

These tracked files are already modified. Preserve their existing non-recommendation code and apply narrow edits only when needed:

- Backend: `routes/api.php`, `app/Services/AuditLogger.php`, `.env.example`, `.env.production.example`.
- Frontend wiring: `frontend/src/modules/checkupino/manifest.ts`, `api/transport.ts` in that module, `frontend/src/panel/registry.ts`, `menu.ts`.
- Content integration: `frontend/src/modules/checkupino/patientArticles/api.ts`, `frontend/src/pages/PatientArticles/ArticleDetail.tsx`, `frontend/src/pages/Administration/content/articleRichHtml.ts`.
- Paired text and regression: `frontend/src/locales/en.json`, `fa.json`, `frontend/src/test/PatientArticles.test.tsx`, `productRegistry.test.ts`.
- Handoffs: `AI_BOOT.md`, `CURRENT_TASK.md`, `docs/TODO.md`, `docs/ai-context/CONTINUE_PROMPT.md`, both affected modules and `TASK_LOG.md`. Update the current summary without rewriting historical checkpoints; keep TASK_LOG at150 split lines.

Private `.env` is not a template or a merge target. Never replace its credentials/key when bringing changes from another PC. Package/lock files, new dependencies, health/catalog schema, booking/payment logic, Docker definitions and Velzon styles are not planned changes for this next slice.

## Accepted evidence and retest boundaries

The original PHP source receipt covers52 files. The cross-module fixture receipt covers135; native cross-module acceptance binds142 sources, including its harness and earlier receipts. These sets include shared article/health sources, migrations, factories, policies and configuration, not just files named Recommendation.

- Documentation-only edits outside those sets do not require rerunning application tests. Confirm links/layout and unchanged source hashes.
- Changing bound code does not erase historical acceptance, but that acceptance no longer proves the new candidate. Record a new source binding and run the affected checks; retain old receipts unchanged.
- The accepted eight-case and16-case MySQL writers refuse replay. Do not edit their expected hashes, remove populated-schema checks or overwrite accepted evidence to make a new candidate pass. A necessary new MySQL acceptance needs a separately identified run/evidence package using the existing guarded disposable lifecycle.
- Relevant existing tests: `tests/Unit/Recommendations/RulePredicateTest.php`, `tests/Feature/Api/RecommendationTest.php`, `tests/Feature/Database/RecommendationSchemaTest.php`, `RecommendationCrossModuleFixtureTest.php` in that database directory, `frontend/src/test/Recommendations.test.tsx`, `PatientArticles.test.tsx` and `productRegistry.test.ts`.
- Existing source runners: `scripts/recommendations/test-source.ps1`, `test-cross-source.ps1`, with bindings in `source-bindings.mjs` and `cross-source-bindings.mjs`. Inspect current dependencies and immutable receipts before selecting a runner. Source tests do not replace served browser/session acceptance or actual clinical review.

## Execution order to avoid conflicting edits

1. Record the review/activation contract and exact file list before application changes. Keep both recommendation flags disabled during preparation.
2. If a defect requires code changes: settle backend schema/response semantics first, then the TypeScript parser, then UI and paired locales. Make shared route/registry/menu changes once after the contract is stable.
3. Check affected tests and required source bindings, then obtain authorization for the concrete activation package. Do not change clinically reviewed meanings while deploying.
4. Apply only the authorized migration/configuration/deployment, then verify the same identifiable static candidate and ordinary bounded flows. Keep failed evidence; diagnose ambiguous writes rather than replaying them.
5. Synchronize CURRENT_TASK and small context summaries last. Keep any new source, tests and handoffs together for a future explicitly requested commit; the user subsequently requested the source checkpoint push described in the publication handoff.

Verified closeout and current test limits: [cross-module acceptance](recommendation-mysql-cross-module-2026-11-08.md). Active execution queue: [CURRENT_TASK](../../CURRENT_TASK.md).
