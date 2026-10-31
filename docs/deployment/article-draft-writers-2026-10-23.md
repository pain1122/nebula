# Article draft writers — source acceptance

Current pointer (October23): all four approved administration screens are now static-deployed; see [panel delivery and honest fixture/live limits](article-panel-2026-10-23.md). Full frontend78/835 plus final article37 and current draft44/346 pass;39 served assets. Article remains disabled/six tables absent. Next focused disposable MySQL, then separate exact activation/ordinary writes. The recorded source acceptance below remains historical evidence.

October23, Asia/Tehran. The user instructed proceeding with article draft creation/editing under the [approved six-table/four-administration-page scope](article-taxonomy-proposal-2026-10-22.md). This slice adds draft persistence only; editorial transitions, UI, disposable MySQL and live activation remain subsequent work.

Before: content preparation, immutable schema, protected readers and taxonomy writers were source-accepted; article drafts could not be saved through the API. After: admin/root can create and edit drafts in the isolated source contract, with exact references, current-snapshot contexts and atomic metadata audits. No live content or article UI was created.

## Files and API

Implementation: [ArticleDraftWrite](../../app/Services/Content/ArticleDraftWrite.php), [controller](../../app/Http/Controllers/Api/Admin/ArticleDraftWriteController.php), [Article audit subject](../../app/Models/Article.php), [audit allowlists](../../app/Services/AuditLogger.php) and [routes](../../routes/api.php). Existing content preparation, snapshot serializers, reader services, taxonomy writer and migration are unchanged.

| Method | API | Contract |
| --- | --- | --- |
| GET | `/api/admin/articles/write-context` | Signed create context |
| GET | `/api/admin/articles/{articleId}/write-context` | Matching current working/published snapshot, revision and eligibility |
| POST | `/api/admin/articles` | Create identity, immutable version1, exact taxonomy links and audit |
| PUT | `/api/admin/articles/{articleId}` | Append a new working draft and clear its review metadata |

Public ULIDs are canonicalized to lowercase. Contexts contain the matching `current` resource and signed `revision` together, `catalog_revision`, create/update/slug capabilities and limits. Future forms must initialize from this exact snapshot/token pair, then explicitly construct the write payload; reader or taxonomy tokens cannot authorize draft writes.

Payloads require `slug`, `expected_revision`, ordinary bounded `reason`, `confirmed` and recent password confirmation. Optional `translations` (`en`/`fa` title/summary/body_html), `health_references` (fixed catalog IDs), `source_links` (`url`/`label`) and `taxonomy` (list of `{id, kind}` for category/topic/tag) replace the complete editable content snapshot. Omitting a collection clears it; these PUTs are not partial patches. Incomplete/empty drafts are allowed. Client authors, versions, hashes, active/status/publication fields and taxonomy version IDs are refused.

Original JSON is bounded to1MiB and validated before normalized request input can hide control bytes. Existing content limits remain200 Unicode title characters,1000 summary characters,20000 UTF-16 body units/80000 UTF-8 bytes per language,30 taxonomy references,30 fixed medical references and20 safe HTTPS sources. Existing server sanitization/escaping is reused; no remote URL fetch, media upload, raw-HTML editor or dependency is added.

## Persistence and safeguards

The transaction locks catalog anchor -> fresh active admin/root and roles -> article -> sorted selected taxonomy rows/ancestors. Password freshness is checked again after waiting for locks. HMAC revisions bind purpose, current catalog, actor/roles and the complete normalized current resource. Source/schema/identity/hash/review corruption refuses safely through the existing reader validation; nothing is silently repaired.

Every selected taxonomy must have the requested kind, be currently active and resolve to its exact current supported term version. Duplicate IDs (including case variants), client-supplied versions, missing/inactive references, invalid ancestors and cyclic ancestry refuse. Server-resolved snapshots are sorted by public ID and included in the content hash; medical IDs resolve only through unchanged catalog1. No private health or patient records are queried.

Success appends one article version and its exact ownership-constrained term links, updates the working pointer/state, clears all working review fields, increments the shared catalog revision and writes one metadata-only audit in the same transaction. Create fixes the author to the authenticated staff identity; subsequent editors do not reassign it. Audit snapshots contain public IDs, slug/version/hash/state, published version and reference counts, excluding article text, source URLs and medical IDs/labels. A late audit failure rolls everything back.

Editing published content preserves its published pointer, original version bytes and original links. The result is `published_with_draft`; only a later explicit reviewed publication can replace it. Slugs can change before first publication; published slugs and archived identity slugs remain reserved. Archived records cannot be edited or restored here. No-op saves, stale/duplicate delivery, cross-actor/resource tokens and reserved identities return409. Validation422, authority403, missing entity404, password423 and neutral storage503 responses remain private/no-store. There is no automatic mutation replay; future UI must resolve ambiguous delivery through fresh reads.

## Verification

- New draft gate **44 tests/344 assertions**: staff/guest/clinical roles, both contexts, bilingual sanitized persistence, incomplete/cleared data, immutable snapshots/history, published preservation and author ownership, in-review/reviewed invalidation, slug rules, canonical/no-op/stale/duplicate/cross-scope revisions, real taxonomy writer rename/retire invalidation, malformed input/references/ancestry, late audit rollback, fresh lock-time authority/password checks and20 long valid sources with maximum multilingual labels. Stored JSON uses compact UTF-8 without changing content/hash semantics or existing URL validation.
- Retained taxonomy **37/310**, readers **35/405**, foundation **35/121**, health **11/126** pass. Combined focused gate: **162 tests/1306 assertions**. Initial39/302 and expanded43/338 passed. A44-case expansion had one fixture failure (340 assertions): raw Unicode URLs correctly returned422 under the existing URL contract. Only the fixture URLs changed to valid long ASCII paths; multilingual labels remain at their bound. Final44/344 passes. All attempts are retained; no populated disposable schema or live data needed recovery.
- Tests use pinned PHP8.3.35/PHPUnit11.5.56, UID33, no network, SQLite memory, empty isolated environment/cache, read-only source and masked private storage. A synthetic unrelated job sentinel remains unchanged; successful writes issue no private-health queries or broad user reads.
- Six affected PHP style files pass; route/PHP and PowerShell syntax/whitespace pass. One existing reader assertion intentionally changes from405 to423 because POST now exists and requires password confirmation. Its reader implementation remains unchanged; old source receipts stay immutable.
- Four actual anonymous endpoints return401/private/no-store. This verifies refusal only, not authenticated live content writes.
- Fresh runtime comparison preserves30 business/protected fingerprints, health counts, both queued jobs and all service images/states. Nine normal services run; six helpers remain stopped. Article flag remains false, six tables/migration absent live; health/static c99b19e9 remains accepted.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/content/test-draft-writers.ps1
if ($LASTEXITCODE -ne 0) { throw 'Article draft source gate failed.' }
```

[Tests](../../tests/Feature/Api/ArticleDraftWriteTest.php) and [runner](../../scripts/content/test-draft-writers.ps1). Receipts: [acceptance](evidence/article-draft-writers-2026-10-23.json), [baseline](evidence/article-draft-writers-before-2026-10-23.json), [initial preservation](evidence/article-draft-writers-runtime-2026-10-23.json), [final preservation](evidence/article-draft-writers-runtime-final-2026-10-23.json), [anonymous refusals](evidence/article-draft-writers-http-2026-10-23.json).

## Next and rollback

Editorial/recovery/history source has since passed in the current pointer above. Next wire the four approved admin/root pages with retained Velzon/CKEditor and EN/Farsi/session/cancel/uncertain-delivery acceptance. Focused disposable MySQL contention precedes separate article live migration/activation and ordinary synthetic authoring/publication acceptance. SQLite source tests do not prove real MySQL interleavings or actual clinical review. Patient library route approval and reviewed recommendations follow separately.

Feature-off application rollback retains article identities, immutable versions, references and audit history; never roll down populated tables. No live migration/save, feature flag, build/dependency/Compose, scanner/parser/worker, key/credential or queued-job operation occurred. Current panel and rollback tags remain unchanged. [Current ordered checklist](../../CURRENT_TASK.md).
