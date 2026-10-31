# Article taxonomy writers — source acceptance

Current pointer (October23): all four approved administration screens are now static-deployed; see [panel delivery and honest fixture/live limits](article-panel-2026-10-23.md). Full frontend78/835 plus final article37 and current draft44/346 pass;39 served assets. Article remains disabled/six tables absent. Next focused disposable MySQL, then separate exact activation/ordinary writes. The recorded source acceptance below remains historical evidence.

October23, Asia/Tehran. The user instructed beginning/resuming the next approved content slice. This implements categories/topics/tags only under the [approved source/design contract](article-taxonomy-proposal-2026-10-22.md). It does not modify the fixed medical vocabulary, patient health, article drafts/editorial transitions or the panel UI.

## Delivered contract

Implementation files: [mutation service](../../app/Services/Content/ArticleTaxonomyWrite.php), [API controller](../../app/Http/Controllers/Api/Admin/ArticleTaxonomyWriteController.php), [audit subject](../../app/Models/ArticleTerm.php), [audit allowlists](../../app/Services/AuditLogger.php) and [routes](../../routes/api.php). Focused verification: [writer tests](../../tests/Feature/Api/ArticleTaxonomyWriteTest.php) and [isolated runner](../../scripts/content/test-taxonomy-writers.ps1). No frontend implementation is included in this accepted slice.

| Method | Staff-only API | Purpose |
| --- | --- | --- |
| GET | `/api/admin/article-taxonomies/write-context` | Signed create context |
| GET | `/api/admin/article-taxonomies/{termId}/write-context` | Signed current snapshot and eligibility |
| POST | `/api/admin/article-taxonomies` | Create category/topic/tag and version1 |
| PUT | `/api/admin/article-taxonomies/{termId}` | Append edited labels/descriptions/parent |
| POST | `/api/admin/article-taxonomies/{termId}/actions` | Explicit `retire` action; append inactive version |

All IDs are public ULIDs, normalized to lowercase. Contexts include `revision`, `catalog_revision`, the matching `current` snapshot (null for creation), capabilities and limits. Future forms must initialize from that context's snapshot and token together; fetching older detail values and attaching a newer token would defeat the intended stale-edit protection. Existing reader signatures are deliberately not write tokens.

JSON writes require `expected_revision`, nonblank bounded `reason`, and `confirmed`, plus ordinary recent-password session confirmation. Create additionally requires immutable `kind` and reserved lowercase ASCII `slug`; create/update require bilingual `labels`, optional `descriptions` and nullable `parent_id`. Update is a replacement of the editable snapshot, not a partial patch; omitted descriptions/parent become empty/null. Action payloads accept only `action: retire` and the guard fields. Identity fields, client active/status fields, extra/query fields and other actions refuse.

Limits are200 Unicode characters per label,1000 per description/reason,64KiB raw JSON and bounded parent traversal (at most63 ancestors). The endpoint validates original JSON before Laravel's input trimming can hide control bytes. Invalid UTF-8, malformed/non-object JSON, nested/unknown locales, blank-only labels and prohibited controls refuse with neutral422. Text remains plain text for escaped presentation; no remote fetch/editor/dependency is introduced.

Every context/mutation takes the catalog anchor first, then fresh active admin/root authority and target/parent rows. Password freshness is checked again after acquiring locks. Write signatures bind their distinct purpose, actor/roles, catalog revision and exact current snapshot. A successful write increments the catalog revision, appends one immutable term version, updates only its current pointer/state and writes one allowlisted audit event in the same transaction. Audit metadata holds public IDs/kind/slug/version/active/parent only; labels, descriptions, article bodies and patient values are excluded. Existing actor name/ID metadata is retained.

Only categories have parents. Missing/retired/wrong-kind parents, self/descendant cycles and corrupt cyclic ancestry refuse; an active parent with active children cannot retire. Children must first be moved or retired through ordinary guarded operations. Retired identities cannot be edited/reactivated or have their kind/slug reused; hard deletion/restoration remain outside this slice. History and article-version links are retained, and already-published article snapshots preserve their original labels/hash while exposing current term inactivity separately. Later article publication must independently revalidate active references under this same catalog lock.

Stale/duplicate/cross-actor/cross-target/read-only tokens and no-op saves refuse409; missing records404, stale authority403 and expired password423. Unexpected storage/audit failures return neutral503 with no raw exception/SQL. There is no automatic mutation replay. The future UI still needs pending/cancel/session/ambiguous-delivery handling; a lost response must be resolved by a fresh read before any new intent.

## Verification and retained failures

- New writer gate: **37 tests/310 assertions**. Covers guest/patient/doctor/admin/root, recent password including expiry during lock acquisition, cached and late authority revocation, bilingual bounds/raw JSON, identity/action allowlists, revisions/duplicate/no-op, category moves/cycles/retirement, safe immutable audit/history, published snapshot preservation, corrupt state and late audit rollback for create/update/retire. Synthetic unrelated queue sentinel remains untouched; successful writes issue no private-health queries or broad user reads.
- Existing readers **35/405**, original schema/content **35/121**, health regression **11/126** pass. Total **118 tests/962 assertions**. The six original foundation source bindings remain exact.
- PHP8.3.35/PHPUnit11.5.56, pinned existing app image, UID33, no network, read-only source, masked private storage, empty isolated environment and SQLite memory. Five scoped PHP files pass Pint; route/PHP and PowerShell syntax plus whitespace checks pass. No frontend/full790-test replay or install/build was needed.
- All five actual anonymous endpoints return401/private/no-store. These are refusal checks, not positive live writer acceptance.
- Fresh baseline comparison preserves30 business/protected fingerprints, health counts, both queued jobs and all service images/states. Nine normal services run; six helpers remain stopped. Article flag remains false; all six tables/migration absent live. Health stays enabled on accepted c99b19e9.

The first30-case run passed29 and exposed trailing NUL being removed by global input trimming (259 assertions, one failure). Original-JSON validation corrected that application issue. The next33-case run had one harness failure (279 assertions): raw request construction omitted Origin, so stateful password confirmation correctly returned423. Supplying the normal Origin fixed only the test request. The intermediate33/286 and37/306 gates passed; the final37/310 additionally verifies the atomically returned context snapshot. Failed outcomes are retained in the immutable receipt; no live fixture was created or reset.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/content/test-taxonomy-writers.ps1
if ($LASTEXITCODE -ne 0) { throw 'Article taxonomy source gate failed.' }
```

## Next and rollback

Article draft/version/reference writers have since passed in the current pointer above. Next implement exact-version submit/review/publish/archive/copy controls and editorial history. Wire the already-approved four administrative screens afterward. Real disposable MySQL hierarchy/retirement/publication contention, served EN/Farsi controls and separate live activation/ordinary positive writes remain open. SQLite tests do not establish real MySQL contention behavior, and editorial authority does not imply clinical review.

No live migration, environment/config enablement, build/Compose/dependency, scanner/parser/worker operation, credential change or job consumption occurred. Feature-off application rollback retains all populated content/history; never roll down populated tables. Current static panel and its existing rollback tags are unchanged.

Receipts: [source acceptance](evidence/article-taxonomy-writers-2026-10-23.json), [baseline](evidence/article-taxonomy-writers-before-2026-10-23.json), [runtime preservation](evidence/article-taxonomy-writers-runtime-2026-10-23.json), [anonymous refusals](evidence/article-taxonomy-writers-http-2026-10-23.json). [Current task](../../CURRENT_TASK.md).
