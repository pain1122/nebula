# Recommendation MySQL: first schema/catalog slice

November7, 2026, Asia/Tehran. Source package: [recommendation source delivery](recommendation-rules-source-2026-11-07.md). This is isolated software acceptance, not actual clinical review or live activation.

## Scope and current state

Updated November8: all **eight corrected real MySQL cases passed** after operator-owned recreation and fresh admission. Fresh migration, empty recommendation down/up, MySQL8.0.46/repeatable-read contention, exact outcomes and atomic history/audit/catalog assertions pass. Operator-owned cleanup is complete; exact test container/network/project-member absence and unchanged accepted source bindings are verified. This closes the bounded catalog execution, not the remaining cross-module acceptance or activation. Never replay this accepted writer harness.

Files: `scripts/recommendations/probe-mysql.php`, `verify-mysql.mjs`, `mysql-cases.json`, `source-bindings.mjs`, and the scoped `test-source.ps1` receipt extension. Existing `scripts/media/start-schedule-acceptance.ps1`, `schedule-acceptance-guard.mjs` and `docker-compose.schedule-acceptance.yml` are reused without weakening their guards or changing Compose ownership.

## Gates and mechanics

- Successful recommendation plus affected-article source regression records an immutable receipt named by its exact source binding. Current binding `cd5342c8b3e6591e4ae336ac8fc718238d4ab4aabbff735d585277c0076084b5` covers52 files. The runner verifies the receipt and every bound source before SQL; changed source requires a new successful source gate, not an old acceptance override.
- JavaScript syntax, PHP syntax/Pint and the existing31 database-admission guard cases pass. Read-only preflight verifies installed pinned images, matrix/receipt and absence of the test project; it does not perform SQL or certify MySQL behavior.
- Only `checkupino_schedule_acceptance`, its exact healthy pinned MySQL8.0.46 container, sole internal network and tmpfs storage are admitted. No published port, durable volume, live bind, extra member, root identity, restart/OOM failure, uncapped resource or substituted project is allowed.
- The PHP client is UID33, read-only source/root, private bounded tmpfs and the sole acceptance network. It uses an empty environment, test-only key, array cache/session, null logs and the temporary service credential; nothing reads the project `.env` or joins the backend network.
- Before migrations/fixtures the database must be entirely empty. It migrates only that test schema, verifies empty recommendation down/up, and creates invented article/rule/reviewer records through ordinary domain services. Synthetic designation/attestation is explicitly not real qualification or clinical approval.
- Two PHP processes use cached request actors and the actual service transactions. The leader pauses only after acquiring the real recommendation catalog lock. The parent observes the exact follower connection waiting on the same lock through MySQL `Query` or prepared-statement `Execute`, then releases the leader. A scheduling delay alone does not establish contention.
- Exact outcomes, version/review deltas and one atomic audit/catalog commit are checked. Previous immutable versions/reviews/targets/article records remain unchanged. Blocked publication pointers stay null; retirement and grant revocation must persist. MySQL-normalized JSON must retain a readable canonical version hash.
- Unrelated clinical/finance/outbox/health tables and one synthetic queue sentinel are compared exactly. No worker or queue consumer is started. Failure evidence excludes raw SQL/environment/private values; no automatic reset, replay or cleanup occurs.

| Case | Required outcomes | Required history delta |
| --- | --- | --- |
| Competing draft saves | commit / stale conflict | one version |
| Exact duplicate delivery | success / success, same action key | one version, one audit/commit |
| Approval before edit | approval / stale conflict | one review |
| Edit before approval | draft / forbidden after assignment clears | one version, no approval |
| Grant revocation before publication | revoke / stale conflict | no publication |
| Exact review withdrawal before publication | withdraw / stale conflict | one withdrawal, no publication |
| Retirement before publication | retire / stale conflict | terminal retirement, no publication |
| Late audit failure before competing save | full rollback / commit | one winning version/audit/commit |

## Commands and ownership

The source gate can be repeated in an isolated network-none memory database to establish a new source receipt:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/recommendations/test-source.ps1 -WithArticleRegression
if ($LASTEXITCODE -ne 0) { throw 'Recommendation source gate failed.' }
node scripts/recommendations/verify-mysql.mjs --preflight
if ($LASTEXITCODE -ne 0) { throw 'MySQL preflight failed.' }
```

Operator startup was completed once using `scripts/media/start-schedule-acceptance.ps1`. After verified admission, assistant execution uses `node scripts/recommendations/verify-mysql.mjs` once. Do not interpret these recorded commands as permission to replay the populated fixture. Accepted/failure receipts are generated under ignored `docs/deployment/evidence/`; a successful receipt cannot be overwritten by the runner.

After acceptance, the operator retains cleanup:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/start-schedule-acceptance.ps1 -RemoveDisposable
if ($LASTEXITCODE -ne 0) { throw 'Disposable cleanup failed; stop here.' }
```

Verify exact container/network absence afterward. No current database or durable Docker volume is deleted by that guarded cleanup.

## Remaining boundary

This first slice does not close the full recommendation MySQL gate. Later bounded tests must cover real article-catalog publication/archive races, current patient health read/write interleavings, account/role/verified-profile changes and grant expiry without an artificial recommendation-catalog mutation, plus the negative composite-FK matrix and cross-review replacement cases. It also does not establish real scanner/parser/S3, HTTP/session/browser, actual clinical review, live migration, deployment, matching activation or the integrated four-role demo.

## First execution and correction

Retained failure: `docs/deployment/evidence/recommendation-mysql-catalog-failed-1794080715555.json`. No paired case completed. The admitted test schema contained three synthetic fixture users and zero articles, article versions, recommendation rules/versions or audit events after rollback. A separate guarded, read-only PDO count confirmed this; no current database was connected.

The fixture omitted `seo` and the legacy summary. The accepted article contract therefore selected schema1, whose publication requires a meaningful summary, and correctly refused publication. The fixture now includes `seo: []`, matching the current schema2 editor contract where summary is optional. A pure UID33/network-none content-preparation check proved the exact distinction: original schema1 had no publishable language; corrected schema2 had English. Production code, source binding and publication policy are unchanged. PHP syntax/Pint and runner syntax/preflight pass; diagnostics now record only safe HTTP status/application file/line in addition to the earlier generic stage.

The unchanged empty-schema guard refuses replay because migrations and fixture users exist. The operator was asked to run the existing `-RecreateDisposable` command; no assistant reset/recreation has occurred. Acceptance and cleanup remain pending until the corrected run and exact container/network removal are verified.

## November8 retry and authority expectation

The operator recreated the exact test project; the runner admitted its healthy pinned container and empty schema. Retained result: `docs/deployment/evidence/recommendation-mysql-catalog-failed-1794084135236.json`.

Three complete cases passed their observed real catalog contention, exact outcomes, immutable history and atomic audit/catalog assertions: competing drafts, exact duplicate delivery and approval-before-edit. The fourth executed an edit followed by attempted approval and stopped on the expected-outcome assertion.

A separately admitted read-only domain-service diagnostic confirmed version2, no assigned reviewer, no own review history for the old reviewer, HTTP403 from the real current reader and exact preservation of the version/review/audit rows during diagnosis. This is the intended privacy boundary: a pending reviewer whose assignment was cleared cannot inspect or approve the new draft. The harness now requires `committed / forbidden` for that case; other expectations remain strict. No production source or source-gate binding changed. Safe observed-pair metadata is now retained before outcome assertions to make later failures diagnosable without private payloads.

PHP style, JavaScript syntax and source-bound preflight pass. Another operator-owned recreation is required because the unchanged empty-schema guard refuses this populated fixture. No automatic retry/reset or cleanup was attempted.

## Accepted full rerun, November8

The operator performed the second guarded recreation. The exact healthy/pinned/internal/tmpfs project was admitted, and the parent verified an empty schema before migrations. All eight cases in the table above passed, each with an observed waiting contender and exact history/audit/catalog checks.

Immutable receipt: `docs/deployment/evidence/recommendation-mysql-catalog-2026-11-07.json`. Its design-date filename is retained; execution was November8 Tehran (recorded `2026-11-07T20:48:15.180Z`). It binds all52 accepted implementation files plus the exact harness, matrix, guard, startup and Compose sources. Receipt results confirm empty rollback, repeatable-read, preservation of prior immutable records, unrelated clinical/finance/health tables and queue sentinel, unchanged unrelated runtime and unchanged source bindings. The runner now refuses replay because accepted evidence exists.

The assignment-clear case requires `committed / forbidden`; duplicate delivery requires two successful responses but only one version/audit/catalog commit. Late audit failure requires full rollback followed by one valid competing commit. Revocation, exact withdrawal and retirement all prevent the waiting publication. Both failed receipts and their corrective diagnoses remain retained; they are not counted as additional accepted cases.

Separate read-only original-laptop checks after acceptance confirm UID33 MySQL/Redis access, false authoring/matching flags, absent live recommendation schema and two queued jobs. No live migration, reviewer grant, health write, scanner/parser/worker start or job consumption occurred. The operator ran the guarded removal, then read-only inventory confirmed exact container/network/project-member absence. Cleanup receipt: `docs/deployment/evidence/recommendation-mysql-catalog-cleanup-2026-11-08.json`. All accepted source hashes still match; nine normal services remain running. The bounded catalog acceptance lifecycle is closed.
