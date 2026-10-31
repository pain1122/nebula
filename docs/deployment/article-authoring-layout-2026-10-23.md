# Article authoring: Add Product layout and live acceptance

Accepted October23, Asia/Tehran. Admin/root article authoring is now enabled and persisted, following the user's explicit database/activation authorization. The earlier flat, disabled panel was source/fixture acceptance only; it did not prove working live authoring.

The four existing approved routes remain `/panel/articles`, `/panel/articles/new`, `/panel/articles/:articleId` and `/panel/article-taxonomies`. The editor now follows the retained Velzon Add Product composition: main content cards and a smaller operations/relationships sidebar. Save and Cancel share one action row. Unsaved Preview works without saving or publishing. Unavailable authoring displays an explicit state/reload instead of a disabled imitation form.

English/Farsi tabs preserve both native CKEditor drafts. Each category/topic/tag is one shared record containing both labels/descriptions and one English SEO slug; the three installed searchable multi-select widgets choose stable relationship IDs. Terms are managed on the existing taxonomy screen. No dependency, stylesheet, route, separate-language tag or unsupported image/SEO control was introduced.

Two real integration faults were corrected: CKEditor now retains native IDs/accessible labels through its supported view writer after typing; optional blank list/search parameters are omitted instead of becoming Laravel-null values and422 refusals. Strict backend validation remains intact.

## Executed activation and ordinary acceptance

- The [eleven-case disposable MySQL acceptance](article-mysql-2026-10-23.md) passed and its exact container/network were removed.
- UID33 inspection verified the original six tables/exact migration absent and feature disabled. Only `2026_10_22_000002_create_article_content_foundation_tables.php` was migrated; migrated/disabled state passed before changing only main `.env` `ARTICLE_ADMIN_ENABLED=true`. Effective uncached configuration/schema checks pass. [Enablement receipt](evidence/article-product-layout-enablement-2026-10-23.json).
- The [real native browser flow](evidence/article-live-authoring-1792770896872-2026-10-23.json) performed nine successful content writes as synthetic admin2 using ordinary current revisions, real password confirmation, reason and explicit confirmation: three bilingual terms; bilingual article draft; submit; editorial review; publish; draft edit; copy older version.
- Published version1 remains intact. Edit appended version2; recovery appended draft version3 with version1's exact content hash. Three immutable versions and nine retained relationship links exist; review is cleared on the new draft. Recovery never rewinds/deletes history or changes the published pointer.
- [Read-only closeout](evidence/article-authoring-closeout-1792771413541-2026-10-23.json) verifies the original30 audit rows byte-for-byte plus exactly nine new successful metadata-only audits belonging to actor2 and those new subjects/actions. All29 other business/protected fingerprints, zero health rows and both pending medical jobs are unchanged. Coordination revision is9; term/version/article counts are3/3/1/3.
- Guest401 and patient/doctor403 content-administration refusals pass. No external requests, unrelated mutation, manual database status shortcut, health save, download, scanner/worker startup or job consumption occurred.

Editorial review records staff approval of an exact version; it is not independent clinical review or permission to activate personalized medical rules. Live archive was not exercised; source and isolated MySQL archive coverage remain separately recorded.

## Verification and runtime

Full frontend quality passed78 files/846 tests before the final small blank-query fix. The final article43-test gate, typecheck, governed and affected-page lint passed afterward; shared rich-text/toolbox12 tests passed. Retained backend source204 tests/1,674 assertions remain separate from eleven real-MySQL cases. No full847-test run is claimed.

The native fixture layout matrix covers admin/root, EN/Farsi and1440/390px (eight cohorts/16 captures); it includes real editor typing/label persistence, keyboard tabs, preserved bilingual drafts, shared taxonomy IDs, safe preview, adjacent actions and unavailable/session guards. [Matrix receipt](evidence/article-product-layout-browser-1792717502825-2026-10-23.json). Its positive content responses were browser fixtures; the live receipt above uses actual APIs and persisted records.

Current static image is `sha256:073f9111d74d92282f771d6a91b0f03c92d38b53f8a007b1c8c5497d39799678`, retained as `checkupino-admin:article-authoring-accepted-2026-10-23`. [Final static check](evidence/article-product-layout-static-1792770896382-2026-10-23.json) verifies43 affected served/container assets, compression/cache and routing. [Final read-only real-screen check](evidence/article-settled-browser-1792771491830-2026-10-23.json) verifies editor/workspace ENFA1440/390, loaded direction styles, no desktop sidebar overlap or page overflow, eight captures and unchanged post-authoring fingerprints. The immediate language-switch screenshots in the live writer receipt preceded stylesheet settling; the final settled screenshots supersede those visual frames. Nine app/admin/SeaweedFS services run after the requested existing-container recovery; six scanner/content helper containers remain stopped. Backend image and existing socket overlays are unchanged. All failed harness/diagnostic receipts remain historical evidence.

## Rollback and next scope

Application rollback changes only `ARTICLE_ADMIN_ENABLED=false`, verifies `scripts/content/inspect-activation.php --expect-migrated-disabled`, and retains every populated table, migration/version/reference/audit and coordination row. Never roll down this populated migration. Use ordinary copy-version to recover content. Static deployment/rollback is described in the [activation package](article-panel-activation-proposal-2026-10-23.md); retained health image `checkupino-admin:patient-health-accepted-2026-10-22` remains a fallback with authoring disabled.

Next is the patient published-article library. Exact patient URLs/composition still need their own proposal/approval; reading must work without health data and must expose only the exact published version. Reviewed, versioned recommendation rules follow separately. Covers/thumbnails remain honest placeholders. Managed medical-term editing, patient-health/profile saves and fresh scanner/continuous-processing acceptance remain open independent gates in [CURRENT_TASK](../../CURRENT_TASK.md).
