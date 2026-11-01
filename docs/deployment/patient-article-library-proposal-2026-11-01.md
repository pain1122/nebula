# Patient article library: stage 4a proposal

Prepared November 1, 2026 (Asia/Tehran), against source c4bd2c0 and the current worktree.
Status: accepted when the user instructed implementation to commence; the bounded stage4 implementation and acceptance are complete. See [delivery and evidence](patient-article-library-2026-11-01.md). The decisions below remain the design contract; older future-tense steps record the approved plan.

## 1. Decisions inherited from approved documents

These are requirements to implement, not new approval questions.

| Requirement | Authority | Source to reuse |
| --- | --- | --- |
| Patient discovery/detail use /panel/my/articles and /panel/my/articles/:articleId; public ULIDs, selector-owned language | [Recovered task, section 4](../ai-context/archive/CURRENT_TASK_development_checkpoint_2026-11-01.md) | Frontend patient route/registry/menu patterns |
| Published pointer remains authoritative while a newer draft is edited; archive hides future reads | [Approved content contract, editorial workflow](article-taxonomy-proposal-2026-10-22.md) | articles.published_version, ArticleSnapshots |
| Whole complete translation with an explicit language label; no mixed or incomplete article rendering | [Approved content contract, content contract](article-taxonomy-proposal-2026-10-22.md) | ArticleContent::publishableLanguages |
| Retired terms cannot be newly selected, but existing publications retain their linked term versions/labels and remain readable | [Approved content contract, taxonomy history](article-taxonomy-proposal-2026-10-22.md) | article_version_terms, ArticleSnapshots::version |
| Retain Velzon grid/detail; categories/tags, no Topics control, no health prerequisite or fabricated personal matches | [Recovered task, section 4](../ai-context/archive/CURRENT_TASK_development_checkpoint_2026-11-01.md) | Pages/Blogs/GridView and Overview |
| Private editorial purpose, exact references/checksums, released/current validation; staff library stays staff-only | [Media contract](article-scheduling-media-proposal-2026-10-23.md), [real-media closeout](article-media-real-acceptance-2026-10-24.md) | ArticleMediaReferences, ArticleMediaEligibility, ArticleMediaStorage |

The archived task is unmodified; its internal root-relative links describe its original location. The links in this proposal resolve from docs/deployment.

## 2. Concrete page composition proposed for the remaining UI decision

### Library

Adapt frontend/src/pages/Pages/Blogs/GridView/index.tsx into the patient product, preserving its page-content/Container, card markup, typography, image proportion and Bootstrap breakpoints: four cards at xxl, two at lg, one on narrow screens.

- Breadcrumb/title: Articles. Add one patient entry in the existing Content navigation group.
- Replace the template Add New/date controls with labelled Search, Category, Tag and Reset using existing form controls. No administration action, Topics selector or new dashboard widgets.
- Each card shows cover/placeholder, title, optional summary, category/tag labels and Read article. The whole article text is selected from one complete published translation.
- Use actual server pagination/counts instead of slicing gridData or showing template totals. Default 12 cards; preserve query parameters when returning from detail. Search/filter changes reset page to 1.
- Browser query state: q, category_id, tag_id and page; optional per_page. Language comes from the existing selector and is sent to the API, not a second page-language control.
- Loading uses existing feedback components; empty library and no matching results have distinct text; request failure offers explicit Retry without automatic retry loops. Invalid query state is shown safely with Reset.
- Keep the 230px blog image slot with a neutral placeholder when unavailable. Missing images do not remove cards.

### Detail

User direction: use [the live Velzon blog overview](http://localhost:3000/panel/dev/pages-blog-overview) as the reference for the article view, retaining the author column and using the space below it for recommendations and other article extras. The live page and frontend/src/pages/Pages/Blogs/Overview/index.tsx were inspected: a centered col-xxl-10 card contains the heading/summary/tags, cover, and a col-lg-3 author/sidebar beside the col-lg-9 body. The sidebar currently contains the contributor block; the area below it is available for the requested additions.

- Breadcrumb: Articles -> selected title; return link retains library filters/page.
- Main content: sanitized published body in its content language, with an explicit fallback-language label when necessary. The shell language/direction stays selector-owned; lang/dir on the article body describe that translation.
- Preserve the author block at the top of that sidebar. Use the actual article author's display name from articles.author_user_id, not the editor/actor who happened to create a version. Return no staff ID, contact details or staff-profile link. Use existing initials/avatar fallback until a real approved author photo exists; omit the template's fabricated profession and relative publication time.
- Stack the requested recommendation area and article extras below the author, keeping them in this same sidebar rather than creating a separate full-width section or a different page. Published categories/tags and escaped sources can use this space; additional widgets remain to be specified rather than inferred from "other stuff".
- Personal recommendations remain governed by stage5's reviewed-rule contract. Preserve their intended sidebar location now, but do not activate a fake personal-match panel or read patient health as part of stage4. Any general related articles must be real published content and explicitly labelled as general, not personalized matches.
- Retain the reference's responsive sidebar/body behavior: the narrow layout stacks the sidebar and body using the existing Bootstrap structure, and EN/Farsi follow the established language-owned mirror. Do not replace this composition with the earlier proposed author-less detail view.
- Use only reviewed source links already stored in the published version; do not fetch remote URLs or add link previews.
- No comments form, article editing, active personalization or public SEO route is introduced in stage4.
- Preserve existing template files and the root-only toolbox. These are new patient consumers, not a rewrite of the reference screens.

No new visual system or dependency is proposed. Add narrowly scoped styling only if the retained blog styles are not available to the product or body images need a scoped width rule; inspect the actual style entrypoint before changing CSS.

## 3. Proposed patient API and representation

One new PatientArticleController and one PatientArticleRead service handle this bounded reader. Start with private helper methods; do not create separate media/projection/repository layers without an implementation need.

| GET endpoint | Allowed query | Result |
| --- | --- | --- |
| /api/my/articles | language=en/fa; q up to 120 characters; category_id/tag_id ULIDs; page 1..10000; per_page 1..24 | Cards and normal envelope pagination; default language en, page 1, per_page 12 |
| /api/my/article-taxonomies | language=en/fa; kind=category/tag; optional q; page/per_page with the same bounds | Paged filter choices actually referenced by accessible publications |
| /api/my/articles/{articleId} | language=en/fa | One published article, chosen complete translation, safe sources/media |
| /api/my/articles/{articleId}/media/{assetId} | version_id ULID; language=en/fa | Exact private image bytes after publication/reference/eligibility/integrity checks |

A small taxonomy reader action is justified by searchable, bounded filter controls; it does not expose the staff taxonomy catalog or require a new service. It runs only for filter selection and must not load the entire catalog into each card response.

Authorization: authenticated active account with the patient role, checked freshly in the service using the established catalog -> authority -> content lock order. Admin/root status alone grants no patient-library access. Reuse ArticleReadPrivacy around authorization as well as successful reads. All responses, including failures and images, remain private/no-store.

Invalid queries return 422; absent/malformed/unpublished/archived article identities and unauthorized image associations return uniform 404; guest/unsupported-role/account refusals follow existing 401/403 semantics. Unexpected stored-integrity or dependency failures return a generic 503, not internal paths or exceptions.

Card fields: id, version_id, title, summary, content_language, fallback_used, categories, tags and thumbnail (safe content_path/alt/dimensions or null).
Detail adds body_html, author.display_name, source_links and inline-image paths. Author attribution follows the user-selected contributor block; it exposes only the author's display name. No working/review/audit objects, mutation signatures, staff IDs/contact data, patient facts, raw storage keys, scan evidence, hashes or executable SEO metadata.
version_id is the public identity of the current published version, used only to keep image requests bound to the displayed article; it does not expose a history endpoint.

Use the existing content enabled/schema gates, privacy middleware and API envelope. No new feature flag, table, migration, role or dependency is proposed for this slice. The patient reader must still work when optional media support is disabled.

## 4. Published selection, language, filtering and ordering

- Join article_versions through articles.published_version and exclude archived identities before searching/filtering/paging. Do not call the administrative list reader: it joins working_version and filters working taxonomies.
- Reuse ArticleSnapshots to validate the published snapshot and immutable references, then explicitly project only patient fields. Do not serialize the staff representation or mutate stored content.
- Select the requested language if ArticleContent::publishableLanguages says it is complete; otherwise select the other complete language and label the fallback. Use the schema-aware completeness rule already in code; summary is not mandatory for schema2/3. No complete language is a stored-integrity failure, not permission to show a partial draft.
- q is a literal bilingual lookup over the published version's title/summary and public slug; escape wildcard input. It never examines working text, review/audit metadata or patient data. Rendering still uses one complete translation, so a bilingual match need not change the shell language. Do not return incomplete translations as snippets.
- Category/tag filters use stable public term IDs joined to the published version's references. No current/working taxonomy join may silently change the article's pinned labels.
- Filter choices come only from eligible published references, including retained retired terms. For one stable term ID with multiple published label versions, use its highest referenced term version for the dropdown, with normal label-language fallback; individual articles keep their own pinned labels. Unknown or unreferenced valid filter IDs yield no matches, without exposing the staff catalog.
- Default order: published version recorded_at descending, then article ID descending. Draft edits cannot reorder the library. There is no dedicated published_at field; do not label article updated_at or version recorded_at as publication time. No date control is needed on the first page.
- Search, counts, taxonomy eligibility and ordering must apply before pagination. Do not fetch a page and silently discard rows afterward. Reuse canonical snapshot/completeness validation; malformed stored records fail explicitly rather than producing misleading totals.
- No patient health/questionnaire queries or recommendation evaluation occur in this reader.

## 5. Publication-bound media delivery and graceful failure

Preserve stored staff-image paths and version hashes. Rewrite allowed image URLs only in the patient response/presentation after validating that exact published manifest; use DOM-based allowlisted rendering, not arbitrary string substitution or a more permissive editor sanitizer.

The media action rechecks the current published pointer, requested version_id, article visibility, selected complete language and exact thumbnail/inline association. If a replacement publication changes that version while a page is open, its old image URL becomes unavailable until the article refreshes. This deliberately avoids adding a general historical-media API.

Reuse ArticleMediaEligibility and ArticleMediaStorage::copy. Serve only released/current-policy media with unchanged checksum and MIME, from the editorial purpose. Keep response nosniff/CSP/private/no-store protections. Do not grant patients permission on /api/admin/article-media or expose raw object URLs.

A thumbnail is usable for the selected complete translation; an inline image must appear in that translation's published manifest. Asset IDs, arbitrary query strings or a requested version alone never grant access.

- No thumbnail, media disabled, retired/stale evidence, missing object, failed byte verification or a failed image request: neutral cover placeholder or remove that inline image/empty figure. Keep independently verified article text readable.
- For immutable manifest/content-hash corruption, fail closed for the article. This is different from an unavailable object whose stored reference remains valid.
- Do not scan, revalidate, change verdicts, write audit/business rows, delete assets or renew evidence during a read.
- The recorded scanner-definition timestamp in asset evidence has the existing 48-hour limit. Updating the daemon alone does not refresh the asset; this proposal preserves that rule.
- Do not inspect/copy every cover while listing cards. Resolve manifest/policy metadata for the response; the image action verifies bytes when requested. Browser failure handling must still show the placeholder.
- Strip staff-only and arbitrary remote image URLs from patient output. The frontend adapter resolves only validated patient API paths against the configured backend origin, as existing credentialed image consumers do; relative paths must not accidentally target the frontend server. Keep ordinary body links and editorial source links within the existing approved sanitizer rules.
- No automatic retry loop for unavailable images. An explicit article refresh can request current state again.

## 6. Minimal implementation file map after this proposal is accepted

| Action | Files | Purpose |
| --- | --- | --- |
| Create | app/Http/Controllers/Api/PatientArticleController.php | List/detail/filter/image actions and normal safe responses |
| Create | app/Services/Content/PatientArticleRead.php | Published queries, projection, translation, taxonomy and media authorization using existing services |
| Modify | routes/api.php | Narrow patient GET routes with privacy/auth/account/role middleware |
| Create | frontend/src/pages/PatientArticles/index.tsx; ArticleDetail.tsx | Two retained Velzon patient pages; keep small render helpers local initially |
| Create | frontend/src/modules/checkupino/patientArticles/api.ts | Patient response/query schemas, endpoint injection, public path builders and patient HTML/media adapter |
| Reuse | frontend/src/modules/checkupino/query/api.ts; frontend/src/store.ts | Existing transport, query hooks and account/role-change cache reset; keepUnusedDataFor=0/refetch for protected readers, no new cache subsystem |
| Modify | frontend/src/modules/checkupino/manifest.ts; frontend/src/panel/registry.ts; menu.ts | Agreed URLs, loaders, breadcrumbs and patient Content entry |
| Modify | frontend/src/locales/en.json; fa.json | Patient labels, states, fallback language and accessible image placeholders |
| Create | tests/Feature/Api/PatientArticleReadTest.php; PatientArticleMediaTest.php | Focused source behavior and refusal tests, reusing existing isolated article support |
| Create | frontend/src/test/PatientArticles.test.tsx | Contracts, list/detail/filter/fallback/media failures and account changes |
| Extend | frontend/src/test/productRegistry.test.ts and existing relevant navigation/transport tests | Route/menu/authority regressions only where behavior changes |
| Record | This proposal, CURRENT_TASK.md, affected context notes and a later scoped served-acceptance runner | Decisions and actual evidence, not new runtime claims |

No template deletion, new upload flow, broad shared-helper refactor, separate frontend custom-hook hierarchy or new backend media subsystem is required. Split a helper later only when the code needs it.

## 7. Verification and delivery order

1. Implement the controller/read service and focused isolated API tests first. Exercise schemas1/2/3 using existing support; do not replay historical populated acceptance writers or use production private mounts.
2. Add publication-bound image delivery and patient rendering tests, retaining the staff-media and questionnaire-sanitizer regressions.
3. Wire the two frontend pages, existing query layer, registry/menu and EN/Farsi labels. Run affected UI/registry tests and required type/lint/format gates.
4. Accept one served candidate at desktop/mobile in EN/Farsi, with current patient/other-role/guest sessions and a concrete authorized synthetic transition plan. Source tests alone do not close served acceptance.

Required cases: published v1 + changed working v2 (including search/taxonomies/media/order); complete-language fallback with partial requested translation; retained renamed/retired taxonomy labels; archive and account/role revocation; no health record; unrelated/draft-only/quarantined images; old version request after republishing; stale/missing/tampered objects; unknown queries/IDs; logout/account switch/back/reload; correct page counts and no unauthorized API requests.

Before declaring 4b complete, inspect the actual stored-query plans and bounded paging behavior. Avoid expanding the schema or adding indexes until a measured query requires an explicit change.

## 8. Review boundary and next action

Prepared in 4a: inherited rules traced, retained composition selected, exact patient API/payload and image behavior proposed, minimal files and verification mapped.
Confirmed by the latest user direction: the exact blog-overview reference, retained author/sidebar/body composition, and placement below the author for recommendations and article extras. Do not ask for this reference/layout choice again.
The user subsequently accepted the library/API/media choices by instructing implementation to commence. Additional sidebar widgets and reviewed personal rules remain separate; stage4 does not invent them.
The initial preparation changed documentation only. The subsequently authorized implementation and owned synthetic transition are recorded in the delivery report; next is stage5, not replaying stage4.
