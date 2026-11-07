# Recommendation MySQL: remaining cross-module and integrity package

November8, 2026, Asia/Tehran. Continues the approved source package and [closed eight-case catalog slice](recommendation-mysql-catalog-2026-11-07.md). The original writer and its accepted evidence remain unchanged and cannot be replayed.

## Current gate

**All16 real interleavings passed** on MySQL8.0.46 / repeatable-read at November8 01:24:05 Tehran. Every waiting follower was observed on its actual database lock; exact atomic deltas, immutable history and private-read boundaries pass. All five native1452 foreign-key refusals, canonical JSON, populated rollback refusal, expiry/health-state and independent-review replacement protocols pass. The unrelated runtime, tables and queue are preserved. Immutable evidence: `evidence/recommendation-mysql-cross-module-2026-11-08.json`. **The disposable test lifecycle is closed.** Operator-owned guarded removal is followed by read-only verification of exact container/network absence, zero project container/network members and all142 accepted source hashes. Cleanup evidence: `evidence/recommendation-mysql-cross-module-cleanup-2026-11-08.json`.

Offline isolated SQLite checks also pass **20 tests / 155 assertions**, covering fixture writers, serial outcomes, negative links, clock protocols and real-lock query matching. PHP syntax/style (five files), JavaScript syntax and the unchanged31 database-admission tests pass. Pre-start absence and subsequent healthy isolation/empty-schema admission were verified before the single native run; there was no failed MySQL attempt or replay in this package.

The fixture gate records an immutable135-file source receipt, binding `1c6afb099ca561661be6ab6a0ef9a783dddae9f961516e277f4dc31ef3ba4f23`. It includes the accepted application source, actual account/role/verification writers, policies, all current migrations/factories, fixture helpers and source tests. The runner also checks the old catalog acceptance/cleanup receipts and unchanged old writer. Source changes require a new offline gate; successful MySQL evidence cannot be overwritten.

This is isolated test acceptance under existing source authorization, not live schema deployment, reviewer designation, clinical approval or personal-matching activation. No production application, frontend, schema definition, dependency or main environment change was needed.

## Files and execution boundary

- `scripts/recommendations/cross-module-cases.json`: fixed sixteen-case ordered matrix.
- `CrossModuleFixture.php`: synthetic setup and operations through the actual article, recommendation, private health, account-state, identity/role and doctor-verification writers/controllers. Current actors are cached as in an authenticated request; domain services still obtain fresh authority under their normal locks.
- `CrossModuleIntegrity.php`: five native FK refusals, cross-rule withdrawal refusal, canonical JSON, populated rollback protection, grant/review expiry, health-state distinctions and exact independent-review replacement.
- `CrossModuleAnchor.php`: recognizes the real MySQL shared/exclusive article-catalog, owner/reviewer user, doctor-profile and recommendation-catalog queries. User anchors distinguish target IDs from the root actor's earlier lock.
- `probe-cross-module-mysql.php`, `verify-cross-module-mysql.mjs`: fresh-schema admission, bounded real two-process interleavings, exact invariants, safe receipts and no replay/reset.
- `cross-source-bindings.mjs`, `test-cross-source.ps1`, `tests/Feature/Database/RecommendationCrossModuleFixtureTest.php`: independent offline fixture gate. Existing catalog/source runners are not modified.

Only the existing pinned `checkupino_schedule_acceptance` internal tmpfs service is admitted. UID33 client, read-only project/root, capped memory/PIDs/CPU and private temporary storage are retained. Empty environment, test-only key and the temporary database credential prevent using current project configuration. The new client uses disposable database sessions so the real account-revocation path runs; it never connects to the live backend/Redis/storage networks. No scanner, parser or worker is needed.

The parent requires an entirely empty schema before migrations. It performs no reset or seed replay. Fixtures use invented self-reports and ordinary draft/review/publication/grant/health writers; test designation/attestation is explicitly not real clinical qualification. Prior fixture rules are retired through the normal audited action before the next case, rather than clearing publication/verdict columns manually. The old catalog cases are not rerun.

## Accepted real concurrency matrix

| Order | Leader -> waiting follower | Expected result |
| --- | --- | --- |
| 1 | Article publication -> rule publication | article commits; obsolete rule context conflicts |
| 2 | Rule publication -> article publication | both commit in order; subsequent match unavailable for the obsolete target |
| 3 | Article archive -> patient match | unavailable; no health read |
| 4 | Patient match -> article archive | initial match; subsequent read unavailable without health access |
| 5 | Health save -> match | current no-match |
| 6 | Match -> health save | initial match; subsequent no-match |
| 7 | Health clear -> match | insufficient information; cleared is not false |
| 8 | Patient suspension -> match | forbidden before health read |
| 9 | Doctor role change -> approval | forbidden, no approval |
| 10 | Doctor verification revoke -> approval | forbidden, no approval |
| 11 | Doctor verification revoke -> patient match | unavailable without health read |
| 12 | Doctor suspension -> patient match | unavailable without health read |
| 13 | Designation revoke -> patient match | unavailable without health read |
| 14 | Exact review withdrawal -> patient match | unavailable without health read |
| 15 | Health audit failure -> waiting match | complete health rollback; original match remains |
| 16 | Article audit failure -> waiting rule publication | complete article rollback; original target can still be published/recommended |

Both processes use the actual writer/reader transaction. The leader pauses after acquiring the relevant real lock. The parent observes the exact waiting follower connection and locking statement through `Query` or prepared-statement `Execute`, then releases the leader. A sleep or artificial recommendation lock is not proof of a cross-module wait.

Each case checks exact audit, article/rule catalog, health-history and review deltas; no incidental rule/article versions may appear. Prior immutable content/review/reference/encrypted health rows remain unchanged. A forwarding observer counts real `PatientHealthService::read` calls without replacing data or policy; ineligible/unauthorized results require zero health reads. Fresh owner results after both operations must reflect the committed state. Only safe outcome/read-count summaries enter evidence.

## Additional integrity and lifecycle protocols

Five inserts/updates must fail with native MySQL FK error1452, not a duplicate-key or unrelated exception: missing target rule version, missing article version, missing reviewed rule version, mismatched reviewer/grant owner and another rule's published-review pointer. Every refused statement runs in its own transaction and must preserve all recorded rows. Cross-rule withdrawal is also refused by the actual domain action without writes. Canonical hashes must survive native JSON storage, and populated migration rollback must stop before DDL/data changes.

Clock checks are isolated PHP application clocks, never machine/Docker time changes or stored-date shortcuts. A designation expiring at its exact deadline refuses pending approval; review expiry is tested while designation remains current. Unknown, negative, cleared, restored and stale self-reports retain distinct owner outcomes while content/review eligibility remains valid. All self-reports use the normal encrypted health writer; existing observation dates are not silently refreshed.

Independent replacement uses ordinary review/publication/withdrawal actions. Withdrawing an old doctor's review must preserve another doctor's current exact approval; withdrawing the current approval must stop matching without falling back to the old review. Original review rows remain immutable.

These are synthetic software/protocol checks. They do not supply clinical criteria or attest real review. Separate live HTTP/session/browser acceptance, actual clinical review and authorized migration/activation remain open.

## Commands and operator ownership

Already completed offline:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/recommendations/test-cross-source.ps1
if ($LASTEXITCODE -ne 0) { throw 'Offline fixture gate failed.' }
node scripts/recommendations/verify-cross-module-mysql.mjs --preflight
if ($LASTEXITCODE -ne 0) { throw 'Cross-module preflight failed.' }
```

Operator starts only the fresh disposable database after that preflight:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/start-schedule-acceptance.ps1
if ($LASTEXITCODE -ne 0) { throw 'Disposable startup failed; stop here.' }
```

Assistant then verifies health/isolation and runs `node scripts/recommendations/verify-cross-module-mysql.mjs` once. The runner refuses populated schemas and accepted-evidence replay. Failure preserves safe diagnostic/partial evidence and requires investigation; it does not recreate, retry or clean up automatically.

After verified acceptance the operator retains cleanup with `scripts/media/start-schedule-acceptance.ps1 -RemoveDisposable`; exact container/network/project absence and accepted source hashes must be verified afterward. No current database or durable volume is deleted.

## Closeout

November8, 2026, Asia/Tehran: the operator removed only the verified disposable project. Independent read-only verification confirms the exact container and network are absent, no project containers/networks remain, and the immutable acceptance receipt and135-file fixture binding still match all142 accepted source hashes. No assistant Docker mutation, current database write, worker or queued-job processing occurred during closeout. Both accepted MySQL writers remain closed to replay. Actual independent clinical review and a separately authorized live migration/flags/static-admin/served package remain open.
