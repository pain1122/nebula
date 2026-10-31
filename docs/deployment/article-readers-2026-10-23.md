# Protected article and taxonomy readers — October23

Current pointer (October23): all four approved administration screens are now static-deployed; see [panel delivery and honest fixture/live limits](article-panel-2026-10-23.md). Full frontend78/835 plus final article37 and current draft44/346 pass;39 served assets. Article remains disabled/six tables absent. Next focused disposable MySQL, then separate exact activation/ordinary writes. The recorded source acceptance below remains historical evidence.

The user authorized this slice with “ok. begin” after the [source schema/routes/controls approval](article-taxonomy-proposal-2026-10-22.md). Protected readers are now implemented and source-tested. Article administration defaults disabled; no live migration, activation, content save/publication, frontend build or scanner/worker operation occurred.

Before: the six-table source migration and pure content preparation passed35/121; article administration had no readers. After: admin/root have the seven GET contracts below in source, with fresh authority, bounded query handling and explicit safe resources. Patient, doctor and guest access refuses before any article content is returned. The new API definitions are visible through the existing backend bind mount, but editable/patient article features are not activated.

| API | Scope |
| --- | --- |
| `/api/admin/articles` | Compact working/published summaries, literal title/slug search, status/author/category/topic/tag filters, allowlisted sorting and paging. |
| `/api/admin/articles/{articleId}` | Full sanitized working and distinct published versions, author attribution and exact current editorial review metadata. |
| `/api/admin/articles/{articleId}/versions` | Descending bounded version summaries; HTML bodies/source links/medical reference payloads are omitted. |
| `/api/admin/articles/{articleId}/versions/{versionId}` | One full version strictly scoped to its article. Another article's version refuses404. |
| `/api/admin/article-taxonomies` | Category/topic/tag search, active/retired, parent filters and sorting/paging. |
| `/api/admin/article-taxonomies/{termId}` | Current versioned labels/descriptions/parent and actor attribution. |
| `/api/admin/article-taxonomies/{termId}/versions` | Descending retained term snapshots and current-version indication. |

All entity/version/actor/parent IDs in resources are public ULIDs. Actor resources contain public ID/display name only. Resources exclude emails, identity numbers, passwords, tokens and private clinical/health facts. The read services select only account-authority/public-attribution fields and do not query health tables; normal authentication remains governed by existing middleware. Lists default to20 rows, cap at50, and reject unknown query fields, unbounded inputs and invalid sort/filter values. Article taxonomy filters apply to the **working version**, stated in response metadata; the later patient library must filter only the published version. Percent/underscore searches are literal, not unrestricted SQL wildcards. Empty lists are valid; missing entities refuse404.

The transaction takes a shared catalog-coordination lock, then reads current account/role authority under locks, consistent with the approved future writer order of catalog before entity/authority rows. Read responses include read-only metadata and an actor/catalog/resource-bound HMAC revision. Upper/lowercase ULID URLs and normalized stored JSON object order produce the same revision. Catalogue or actor changes produce a new revision. These are read contexts, not implemented writer eligibility or publication controls; exact write-context integration remains with the next slices. MySQL lock behavior is not accepted by SQLite tests.

`ArticleSnapshots` explicitly prepares resources and verifies article content against both its stored hash and the sanitizer-prepared form. Unsupported schema/catalog, changed hashes, active markup even with a recomputed raw hash, missing working/published pointers, stale review metadata and invalid term references refuse503 with neutral errors and no partial content. Published content stays distinct when a new draft is appended. Archived records remain available only to authorized staff readers.

Article versions retain exact taxonomy-version labels and snapshot state after a term is renamed/retired. `currently_active` is separate from the historical `is_active` value. Hashes bind the stable snapshot, not mutable current eligibility. Bilingual maps remain JSON objects, including empty description maps. Medical reference labels come from the fixed source catalog; no managed medical-term mutation or personal recommendation is added.

Private/no-store middleware wraps successful reads and valid-route authorization/error responses. The first34-case test run exposed Laravel's middleware sorting placing authentication before the wrapper: guest401 had only no-cache/private. An article-specific priority entry now places that wrapper before authentication only on routes carrying it. Existing authentication rules are unchanged; health regressions pass. The failure and intermediate source outcomes are retained in the immutable receipt.

## Verification

- Reader gate: **35 tests/405 assertions**, including all seven endpoints across guest/patient/doctor/admin/root, cached-role revocation/suspension, source feature/schema refusal, public-ID scoping, compact/paged lists/history, literal EN/Farsi search, filtering, stable revisions, JSON normalization, current/published separation, retirement/history, corruption refusal, privacy and no business writes/health queries.
- Original article schema/content gate: **35/121**, unchanged source bindings.
- Existing health source regression: **11/126**. Two test fixtures previously used `now()->setDate(...)`, retaining the UTC hour and crossing midnight in Tehran. The initial regression therefore failed age/future-date assertions. Only those test clocks were corrected to explicit October22 noon in Asia/Tehran; no health application logic changed. Historical health receipts remain unchanged.
- Combined focused result: **81 tests/652 assertions**. Tests use the retained pinned PHP image, UID33, no network, read-only source/root, masked private storage, empty isolated environment and SQLite memory. PHP style/syntax/whitespace checks pass. No dependency install or full frontend regression was needed for this backend-only slice.
- Actual anonymous HTTP checks: all seven running routes return401/private/no-store, without logging in or reading patient accounts. This is refusal acceptance only, not live positive admin/content acceptance.
- Fresh read-only preservation:30 business/protected fingerprints, health row counts, both queued jobs and all service images/states match the new pre-slice baseline. Nine normal services run; six scanner/parser/checker/worker helpers remain stopped. Article flag is false; all six content tables and their migration record remain absent live. Health stays enabled on the accepted c99b19e9 panel.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/content/test-readers.ps1
if ($LASTEXITCODE -ne 0) { throw 'Article reader source gate failed.' }
```

The existing `scripts/content/test-source.ps1` is still the separate35/121 foundation gate; accepted historical evidence is not overwritten. Direct isolated fixtures create representative published/draft records to test reads; they do not certify ordinary writers, editorial transitions or live publication/auditing.

## Reader checkpoint boundary (historical)

Taxonomy writers/history and hierarchy/cycle source rules have since passed in the linked writer slice. Article draft/version writers have also since passed in the linked draft slice. Next implement exact-version editorial transitions with recent-password/reason/confirmation, fresh revision/reference checks, deterministic locks, audit rollback and ambiguous-delivery handling. Add the publication/audit transition timeline with those writers; the present article history lists version records and current review metadata only. Real disposable MySQL contention remains open before activation.

Then wire the already-approved four administrative pages, verify EN/Farsi served controls, and prepare the concrete activation package. No additional approval is needed for those already-approved source tables/routes/controls. Patient library URLs, medical-term editing/backward readers, positive health/profile saves and reviewed recommendations remain separate. Rollback for this source reader wiring disables `ARTICLE_ADMIN_ENABLED`; retain populated content history and the existing key. No environment change or migration rollback was performed here.

Receipts: [reader acceptance](evidence/article-readers-2026-10-23.json), [pre-slice baseline](evidence/article-readers-before-2026-10-23.json), [read-only runtime preservation](evidence/article-readers-runtime-2026-10-23.json). [Current task](../../CURRENT_TASK.md).
