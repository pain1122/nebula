# Article and taxonomy administration — approved source scope

Prepared October22 after the user's instruction to continue stage3. This document records the exact source schema, administrative URLs and retained controls approved below. It does not authorize live migration, content saves/publication, medical-term editing or the later patient library routes.

Approved October22: the user explicitly answered **“Approve the proposed source schema, routes and controls.”** This approval covers the six additive source tables, four administrative URLs/navigation and described controls across the small implementation slices below. Do not ask for these approvals again. [First source foundation acceptance](article-content-foundation-2026-10-22.md) and [protected reader acceptance](article-readers-2026-10-23.md); no live activation is included.

## Existing foundations and scope

Current implementation (October23): backend foundation/readers/taxonomy/drafts/editorial source and all four approved static administration screens are complete. Full frontend78/835 plus final article37 and current draft44/346 pass;39 served assets on b94e4ab0. Positive populated browser content uses fixtures because live article tables are absent and the feature remains disabled. Next focused disposable MySQL -> separate exact activation/ordinary writes. See [panel delivery](article-panel-2026-10-23.md) and [activation package](article-panel-activation-proposal-2026-10-23.md). The original proposed sequence below records completed and pending slices; do not repeat the schema/route/design approvals.

- No production article/post/taxonomy model or migration currently exists. Velzon already contains blog GridView/ListView/Overview cards; these remain retained template assets, not a source of product records or fake statistics.
- Reuse the installed CKEditor and existing frontend/server rich-text allowlists. No dependency, raw HTML editor, remote image/embed, new role or stylesheet is needed.
- Admin and root-admin manage articles and their categories/topics/tags. Doctors and patients receive no administration access. Editorial review/publication authority uses these existing roles; this is not a claim of clinical review. Restricted content-manager authority remains a separate future role decision.
- Article links to conditions/allergens use the existing fixed `health-2026-10-22.1` catalog and its stable kind-specific IDs. No patient-health reads/imports, new diagnosis facts or recommendation evaluation occurs here.
- Medical-term editing remains disabled. Before that future feature, implement versioned medical-catalog readers and retirement rules preserving existing patient selections. Article taxonomy history and patient measurement history are separate features; neither grants staff access to private health data.

## Four administrative URLs and navigation

| Surface | Exact proposed route | Retained composition |
| --- | --- | --- |
| Articles | `/panel/articles` | Velzon blog cards with list/grid switch, title/slug search, status/author/category/topic/tag filters, quick Draft/In review/Published/Archived presets, server paging and refresh. No fabricated views/ratings. |
| Create article | `/panel/articles/new` | Existing cards/form controls with EN/Farsi editing tabs, visual CKEditor, taxonomy multiselect, fixed medical-term reference picker, source links and a local cover placeholder. Adjacent Save draft/Cancel. |
| Article workspace | `/panel/articles/:articleId` | Public ULID; reservation-style detail boxes for identity, working/published state, taxonomy links and editorial facts; Edit/Preview/Review/Publish/Archive controls, plus paginated version/history tab. |
| Article taxonomies | `/panel/article-taxonomies` | Categories/Topics/Tags tabs, existing table/search/active filters, bounded create/edit/retire modal and term history. Category parent selector only; no extra detail URLs. |

Group Articles and Article taxonomies in a Content submenu for admin/root, with correct active detail/query states. Keep root-only Staff/settings, doctor/patient menus, reserved Recent Activity feed and developer toolbox boundaries unchanged. EN/Farsi labels, flag-owned direction, keyboard/mobile behavior and native existing dialogs remain mandatory. Presentation adapters stay separate from domain services to support the client's expected UI refactor.

Preview is staff-only within the article workspace and uses sanitized stored draft content. No public/SEO URL, patient route, share token or arbitrary preview iframe is introduced.

## Content contract

- One article identity covers a blog/educational post; future checkup recommendations target the existing checkup catalog rather than duplicating booking services. Self-care classification can use topics/tags; recommendation rules are stage5.
- Public ULID identity; lowercase ASCII slug of3–160 characters. Slugs remain reserved after archive and become immutable after first publication, avoiding unapproved redirect infrastructure.
- Optional `en` and `fa` translations, each containing plain-text title (up to200 characters), summary (up to1000) and sanitized rich-text body (up to20,000 UTF-16 code units, also capped at80,000 UTF-8 bytes). Reuse the existing editor's20,000-unit limit. The server calculates the same bounds; do not silently truncate. Require meaningful text after sanitization for a publishable body.
- Drafts may be incomplete. Review/publication requires at least one complete translation; patient readers later fall back to a whole complete translation with an explicit language label, never mix a title from one language with another body or expose an incomplete draft.
- Up to30 article taxonomy references and30 fixed-catalog medical references per version; reject duplicates, unknown IDs, wrong kinds and new inactive references. Medical references are version-bound and contain no patient values. Linking a condition does not by itself make an article a personal recommendation.
- Up to20 editorial source URLs, HTTPS only with bounded labels/lengths. Store/render escaped labels and safe links; do not fetch URLs, inspect remote resources or generate previews server-side. Ordinary body links follow the existing sanitizer's explicit safe schemes. Cover media remains a local placeholder, with upload/publication deferred to the media lane.

## Editorial workflow and history

`Draft -> In review -> Reviewed -> Published`; Archive removes the identity from subsequent reader responses. Fresh server eligibility governs every transition.

Saving an edit appends an immutable version and invalidates that working version's previous review. Submit/review/publish bind the exact current version and sanitized content/reference hash. Admin/root may perform editorial review and publication; no independent clinical review is inferred from their role or from a self-review in a solo-development demo.

Editing a published article leaves its last accepted published version visible until a reviewed replacement is published. Lists must say “Published with draft changes” when appropriate. Rejected/stale/uncertain publication never changes the published pointer. Archive preserves all content/history and hides future patient reads; reopening archived articles and hard deletion are deferred.

The workspace history records version, actor, time and editorial transitions. Staff may inspect prior text and copy a prior version into a **new draft**; this never rewinds a published pointer or deletes later versions. User/clinical values, credentials and activity monitoring are not part of this history. Audit events hold safe IDs/version/action/counts/hash metadata and an ordinary bounded reason, not article bodies or patient facts.

Article category/topic/tag IDs and kinds are immutable. Category parents must share the category kind; reject missing/retired parents, self-parenting and cycles. Topics/tags are flat. Labels/descriptions can change through appended term versions. Retired terms cannot be newly selected; old article versions retain their linked term versions/labels. A working version carrying retired references is visibly blocked from new publication until corrected; already published content remains readable. No ID/slug reuse, cascade delete or silent reassignment.

## Six additive source tables

| Table | Purpose and principal constraints |
| --- | --- |
| `article_catalog_state` | One initialized coordination row with catalog revision. All taxonomy writes and reference-sensitive article review/publication lock this row first, then relevant rows in deterministic order. Prevents cross-admin hierarchy/retirement/publication races. No clinical/user seed. |
| `article_terms` | Public ULID, immutable kind/slug, current version, current category parent, active state and timestamps. Unique kind/slug including retired rows; restrictive parent FK. |
| `article_term_versions` | Immutable term/version, bilingual labels/descriptions, active/parent snapshot, actor and timestamp. Unique term/version; restrictive term/actor FKs. |
| `articles` | Public ULID, reserved unique slug, author, working version/state, exact reviewed version/hash/reviewer/time, nullable published version, archive/timestamps. No password/contact/private-health fields. |
| `article_versions` | Immutable article/version and schema version, sanitized bilingual content, fixed medical-catalog references, editorial source links, actor/time and server content hash. Unique article/version; restrictive article/actor FKs. |
| `article_version_terms` | Version-to-exact-term-version references with indexed stable term IDs for filtering. Unique article-version/term pair; restrictive FKs and server validation that each referenced term version belongs to that term. |

The source migration adds only these tables and the single coordination row. Current user, health, medical, questionnaire, schedule, booking, payment and job tables are unchanged. No live schema operation is included. Migration down checks for any article/term/version/reference data **before** dropping anything; only the initial coordination row is exempt. Application rollback disables article administration and retains populated tables/history. Existing health source/catalog/key are retained.

## API and write safeguards

Admin/root readers: `GET /api/admin/articles`, `GET /api/admin/articles/{articleId}`, paginated version history; taxonomy list/detail/history readers under `/api/admin/article-taxonomies`. All identifiers exposed to clients are public ULIDs. Fresh authority and bounded query allowlists/paging apply.

Writers: `POST /api/admin/articles`, `PUT /api/admin/articles/{articleId}`, `POST /api/admin/articles/{articleId}/actions`; taxonomy create/update/action endpoints under `/api/admin/article-taxonomies`. Explicit action enums cover submission/review/publication/archive and copy-version-to-new-draft, plus taxonomy retirement. Do not overload a client-provided status field to bypass workflow checks.

Every write requires active fresh admin/root authority, current signed revision, explicit reason/confirmation and existing recent-password controls. Lock the shared coordination row before target/reference rows, re-read current authority/reference/review state, append versions and record the audit in one rollback-safe transaction. Enforce unique identities in the database and return a safe conflict for stale/duplicate delivery without automatic replay. No-op input refuses; audit failure rolls back state, versions and references. Metadata-only logs/errors and private no-store staff responses.

Frontend writes retain fresh reads, pending/uncertain locking, manual refresh after ambiguous delivery, cancellation/session abort and session-owned cache clearing. Keep article bodies/drafts out of local/session storage and query strings; discard draft state on account changes. A feature flag defaults article administration off until its later deployment is accepted.

## Small implementation and verification sequence

1. Approve these exact source tables, four URLs, navigation and controls. First implement migration/contracts/models and isolated SQLite readers/permission tests; no live migration.
2. Add taxonomy writers/history and deterministic locking, then article draft/version/reference writers. Validate bad IDs/kinds, archive semantics, cross-version references, hierarchy/cycles, duplicate/stale/no-op input and audit rollback.
3. Add exact-version editorial transitions; prove that editing/reviewing cannot change published content and that archive/retirement/authority revocation racing publication cannot produce an invalid published pointer. Real disposable MySQL verification follows the source gate under the existing operator-owned startup/recreation rules.
4. Wire the approved retained administration pages/editor in bounded slices. Verify sanitization/Unicode/limits, safe links, filtered paging, complete-translation fallback, preview isolation, revision/session/cancel/uncertain behavior and EN/Farsi desktop/mobile. Run affected tests first; broader integrated regression belongs to stage6.
5. Prepare exact activation, static rollback and ordinary synthetic write/publication acceptance after source verification. Obtain only genuinely missing activation/write authorizations; the user's disposable-development-data policy does not require an unnecessary reset or backup loop. Static-admin build delegation persists; backend/database Compose remains operator-owned.
6. Continue separately to stage4 patient library routes/design, then stage5 actually reviewed recommendations. No automatic diagnosis/personal matches, unreviewed rules or private health access from content administration.

Relevant inspected sources: `HealthCatalog`, `PatientHealthService`, `QuestionnaireRichTextSanitizer`, `QuestionnaireRichTextEditor`, `questionnaireRichHtml`, `QuestionnairePolicy`, and retained `pages/Pages/Blogs/{GridView,ListView,Overview}`. [Current task](../../CURRENT_TASK.md) and [AI_BOOT](../../AI_BOOT.md) require concrete approval for new schema and canonical panel/page composition; general content scope is already authorized.

The sanitizer reuse keeps HTML processing on an explicit allowlist, consistent with [Symfony's installed7.4 component documentation](https://symfony.com/doc/7.4/html_sanitizer.html) and [OWASP's rich-text HTML sanitization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#html-sanitization). The planned shared coordination-row lock uses the [MySQL transactional locking-read contract](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html); article MySQL contention acceptance is still pending. These are source references, not an independent clinical/security expert review.
