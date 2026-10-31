# Article editorial workflow and recovery — source acceptance

Current pointer (October23): all four approved administration screens are now static-deployed; see [panel delivery and honest fixture/live limits](article-panel-2026-10-23.md). Full frontend78/835 plus final article37 and current draft44/346 pass;39 served assets. Article remains disabled/six tables absent. Next focused disposable MySQL, then separate exact activation/ordinary writes. The recorded source acceptance below remains historical evidence.

October23, Asia/Tehran. The user asked to continue the next slice after confirming article version history and older-version recovery. This implements the editorial actions/history in the [approved source/design scope](article-taxonomy-proposal-2026-10-22.md). No new schema, dependency, panel URL, live activation or live content action is included.

Before: immutable drafts and taxonomy references existed, but the editorial transition/recovery action and audit timeline were not wired. After: admin/root have exact-version submit/review/publish/archive/copy actions, signed previews/eligibility and a paginated metadata-only timeline in source. Panel controls still await the approved frontend slice.

## Files and APIs

Implementation: [ArticleEditorial](../../app/Services/Content/ArticleEditorial.php), [editorial controller](../../app/Http/Controllers/Api/Admin/ArticleEditorialController.php), [history reader](../../app/Services/Content/ArticleAdministrationRead.php), [read controller](../../app/Http/Controllers/Api/Admin/ArticleReadController.php), [audit allowlists](../../app/Services/AuditLogger.php), [routes](../../routes/api.php), [tests](../../tests/Feature/Api/ArticleEditorialTest.php) and [isolated runner](../../scripts/content/test-editorial.ps1).

| Method | API | Purpose |
| --- | --- | --- |
| GET | `/api/admin/articles/{articleId}/action-context?action=…` | Fresh current resource, selected source/eligibility and action-bound signed revision |
| POST | `/api/admin/articles/{articleId}/actions` | Explicit audited editorial action |
| GET | `/api/admin/articles/{articleId}/events` | Paged staff-only editorial metadata timeline |

Actions are `submit`, `review`, `publish`, `archive`, `copy_version`. Copy context additionally requires `source_version_id`; it returns that same-article historical version for staff preview. Contexts include current working/published content, `eligible`, machine-readable `blockers`, `catalog_revision`, `review_kind: editorial` and signed `revision`. No recent-password confirmation is required merely to inspect context/history.

POST requires `action`, `expected_revision`, exact current `expected_version`/`expected_hash`, ordinary bounded `reason`, `confirmed` and the existing recent-password session. Copy additionally requires the chosen `source_version_id` and `source_hash`. Other actions reject copy fields, including empty strings. All unknown fields, manual states/pointers and query parameters refuse. Original JSON is bounded to16KiB and validated before input trimming; control bytes, malformed/non-object JSON, blank reasons and invalid IDs/types refuse with neutral422.

## Workflow and recovery

`Draft -> In review -> Reviewed -> Published` requires one complete sanitized translation and current active taxonomy identities/ancestors at each promotion. Existing whole-language readiness applies; Farsi-only complete content is supported. Review records the exact version/hash, reviewing actor/time and editorial kind. It does not imply independent clinical review. Self-review is permitted under the explicitly approved admin/root demo authority.

Every mutation takes the shared catalog lock first, then fresh active actor/roles, target and references. Password freshness is rechecked after acquiring locks. HMAC signatures bind purpose, actor/roles, action, catalog revision and exact current/source resources; reader/draft tokens cannot authorize actions. Versions/hashes, current reference eligibility and review state are revalidated under the transaction. No stale/duplicate/no-op action is replayed automatically. Even a reviewed working state cannot republish an already-current published pointer.

Saving or recovering a draft clears the working review fields; a later publication needs a new exact review. Editing/reviewing/recovering never replaces the published pointer. Publication explicitly promotes only the current reviewed version; previous versions and their exact references remain intact. A normal taxonomy change invalidates outstanding action contexts; a newly retired term blocks fresh promotion as well. Historical term labels are not silently rewritten when current labels change.

`copy_version` requires an older supported version belonging to the same article with a different content hash. It appends a new numbered draft, preserving the source's exact sanitized text, source links, fixed medical snapshot and term-version references; actor/time become the restoring staff member/current time. The article's current slug/author and published pointer remain unchanged. It neither overwrites the old version nor deletes later versions. The audit records its `source_version_id` so recovery lineage is visible.

Retired historical references may be recovered faithfully into a draft; they block subsequent submit/review/publication until corrected through a normal draft save. Foreign/current/unchanged/corrupt or unsupported source versions refuse. This is recovery of valid saved content, not a repair path for corrupt database blobs or unsupported schemas/catalog versions.

Archive is terminal for this scope. It records `archived_at` and audit history while retaining content/versions/published pointer; no reopen, restore-to-active or hard delete exists. Archive can remove an article with incomplete/inactive references, without promoting that content. Authorized staff still inspect archived history; future patient readers must exclude archived identities.

State/pointer/version/reference changes, catalog revision and safe audit metadata commit together. Any audit failure rolls back the whole action, including newly copied versions/links. Errors remain private/no-store and neutral: validation422, authority403, ownership/not-found404, stale/state/eligibility409, password423 and unexpected storage503. No raw exception, content or medical data is returned in errors.

## History privacy and integrity

Events are scoped by resolved article numeric/public identity, exact Article subject type, succeeded outcome and seven known authoring/editorial actions. Paging is capped at50/page and10000 pages. Resources expose public event/actor IDs, historical display name, time, editorial kind and allowlisted before/after version/hash/state/count/archive/source-version metadata. Reasons, IP, user agent, contact fields, raw article text, source URLs and medical IDs/values are excluded.

Version/hash ownership, typed fields, action/state consistency and recovery lineage are validated; a recovery source must be an older version of this article with the copied hash. Malformed/cross-article/self-referential lineage refuses safely. Existing version-content readers remain separate from this metadata timeline. Read operations do not mutate/audit records or consume jobs.

## Verification and limits

- New editorial gate: **42 tests/366 assertions**, including both staff roles and guest/clinical refusals, exact workflow, complete-language/incomplete states, review invalidation, replacement publication, stale/duplicate/action/actor/target/source/hash binding, retirement between review/publication, historical recovery with retired references, terminal archive, five action-specific audit rollbacks, late authority/password changes and private typed/paged/scoped history.
- Retained draft **44/344**, taxonomy **37/310**, readers **35/405**, foundation **35/121**, health **11/126** pass. Combined focused gate: **204 tests/1672 assertions**. Initial37/338 and intermediate40/360 passed; final42/366 adds explicit empty copy-field refusal. No failed test attempt needed recovery in this slice.
- Existing pinned PHP8.3.35/PHPUnit11.5.56, UID33, no network, SQLite memory, empty isolated environment/cache, read-only source and masked private storage. Synthetic unrelated queue sentinel preserved; successful actions/history issue no private-health queries or broad user reads. Six affected PHP files pass Pint; route/PHP, PowerShell syntax and whitespace checks pass.
- Three actual anonymous action-context/action/history endpoints return401/private/no-store. This is refusal acceptance, not live positive editorial acceptance.
- Fresh runtime preservation:30 business/protected fingerprints, health counts, both queued jobs and all service images/states unchanged. Nine normal services run; six helpers stay stopped. Article flag remains false, six tables/migration absent live; health/static c99b19e9 unchanged.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/content/test-editorial.ps1
if ($LASTEXITCODE -ne 0) { throw 'Article editorial source gate failed.' }
```

SQLite transactional proofs do not establish real MySQL contention behavior. Actual current patient reading, served EN/Farsi UI, ordinary live saves and editorial publication remain unaccepted. No claim of clinical review or personalized recommendations is made.

## Next and rollback

Next wire the four already-approved admin/root pages/navigation using retained Velzon blog grids/cards, detail boxes, taxonomy controls, CKEditor and version/event history/recovery controls. Respect session-owned state, matching context/revision previews, pending/cancel/uncertain delivery, adjacent actions and EN/Farsi desktop/mobile. Then accept focused disposable MySQL contention and prepare separate live activation/ordinary content-write acceptance. Patient library route approval, published-only readers and reviewed recommendation rules follow afterward.

Feature-off application rollback retains populated content and audit history; never roll down populated tables or rewind version pointers. No live migration/content write, feature flag, build/dependency/Compose, scanner/parser/worker, key/credential or job operation occurred. [Current ordered task](../../CURRENT_TASK.md).

Receipts: [source acceptance](evidence/article-editorial-2026-10-23.json), [baseline](evidence/article-editorial-before-2026-10-23.json), [runtime preservation](evidence/article-editorial-runtime-2026-10-23.json), [anonymous refusals](evidence/article-editorial-http-2026-10-23.json).
