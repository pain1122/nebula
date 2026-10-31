# Patient health disposable MySQL acceptance

Status: **all eight MySQL8.0.46/repeatable-read cases pass; guarded final cleanup and exact container/network absence are verified.** Final counts:13 snapshots,10 observations,13 audits. Existing health implementation matches all20 original source bindings;29 accepted implementation/harness/dependency bindings were verified at closeout. The operator performed startup/recreations; the assistant used the earlier exact final RemoveDisposable delegation for cleanup. Nine normal services run, static admin is healthy and all six helpers remain stopped. No live schema/save/environment change, scanner or worker operation occurred. Earlier failed/diagnostic receipts remain immutable below.

Accepted [execution receipt](evidence/patient-health-mysql-2026-10-22.json), [cleanup/runtime receipt](evidence/patient-health-mysql-closeout-2026-10-22.json). Do not replay the accepted writer or repeat completed cleanup. Next is the separately authorized [health activation package](patient-health-activation-proposal-2026-10-22.md).

## Bounded cases

| Case | Expected result |
| --- | --- |
| Competing first saves | One snapshot/measurement/audit; second current-user locking read refuses stale revision. |
| Later fact saves | First fact commits; second refuses stale revision; prior measurement and assertion time stay unchanged. |
| Measurement before fact | New dated measurement commits; stale fact save cannot overwrite it. |
| Fact before measurement | Fact commits; stale measurement cannot append or refresh existing history. |
| Duplicate measurement delivery | One new observation/snapshot/audit; duplicate refuses. |
| Late audit failure | Leader inserts then audit creation throws; transaction rolls back and waiting follower commits against the original revision. |
| Account deactivation before save | Synthetic authority fixture holds the user row, deactivates and commits; waiting health save rejects its cached former authority. |
| Patient-role revocation before save | Same real user lock; waiting save freshly rejects the removed role. |

Each pair uses two independent Laravel/PHP processes with cached authenticated user objects resolved before the transaction. The leader pauses after obtaining the actual production user lock. The follower crosses a pre-query barrier; the parent observes its live user-lock statement with `SHOW FULL PROCESSLIST` before releasing the leader. Only booleans/outcomes/counts leave the container, not query text or health payloads. No global MySQL privilege is requested: the same test database user can see [its own connections](https://dev.mysql.com/doc/refman/8.0/en/processlist-access.html).

Expected whole-run counts:13 snapshots,10 observations,13 health audits. Earlier encrypted rows, exact assertion/measurement dates, safe audit fields and unrelated lifecycle tables must remain unchanged. A default-queue sentinel must remain unreserved/unconsumed; no medical job is dispatched. Unexpected SQL errors/deadlocks/timeouts fail rather than being accepted as a conflict.

Revocation transactions are synthetic fixture setup under the real row lock, not a claim of new administration endpoint acceptance. This harness exercises the health service; HTTP/session/password/browser behavior retains separate source/served gates. No sustained-load, forced-deadlock recovery, live activation or clinical review claim.

## Admission and failure controls

- Reuse `schedule-acceptance-guard.mjs`: exact project/container/database/user, pinned MySQL8.0.46 and PHP image, healthy UID999 tmpfs-only MySQL,1GiB cap/no extra swap, no published ports/durable mounts/capabilities and one internal network/member. The PHP process runs UID33, read-only/no capabilities, bounded tmpfs/storage and only that internal network.
- PHP verifies explicit environment before boot, bypasses project environment/cache, then checks the effective database and empty schema before applying source migrations/core role fixtures. Neither reset/fresh/refresh nor populated replay exists. Child processes inherit only explicit test configuration. No live private storage is exposed.
- Parent/child deadlines and cleanup of child processes are bounded. Test database cleanup is never automatic. Success evidence uses exclusive create at `evidence/patient-health-mysql-2026-10-22.json`; failures receive separate timestamped receipts. Raw SQL, environment, health values and credentials are suppressed.
- Completed clinical-writer and earlier health source receipts are immutable. The runner checks implementation hashes and rejects source changes rather than silently rebasing accepted proof. New hardening/source changes need their own accepted binding before this harness can claim that candidate.

## Operator startup - historical execution commands

From `C:\Users\Pain\Desktop\work\checkupino`:

```powershell
node scripts/health/verify-mysql.mjs --preflight
if ($LASTEXITCODE -ne 0) { throw 'Health MySQL preflight failed.' }
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/start-schedule-acceptance.ps1
if ($LASTEXITCODE -ne 0) { throw 'Disposable database startup failed; stop here.' }
```

These commands record the now-completed execution, not instructions to repeat it. The user retains database Compose/startup/recreation ownership. The script accepts only the absent pinned disposable project and requests startup without pulling/building. After the result, the assistant verified health/isolation and ran:

```powershell
node scripts/health/verify-mysql.mjs
if ($LASTEXITCODE -ne 0) { throw 'Health MySQL acceptance failed; preserve the database for diagnosis.' }
```

This command performs isolated migrations/fixtures only after admission and the empty-schema guard. Do not run it twice after a partial failure. Inspect failure evidence first; prepare the guarded `-RecreateDisposable` command only when a diagnosed correction requires a clean fixture and ownership is satisfied.

After accepted evidence, arrange scoped cleanup using `start-schedule-acceptance.ps1 -RemoveDisposable` under the applicable exact operator delegation, then verify both container and network absence. Prior delegation of final cleanup does not authorize startup/recreation. No health live activation follows automatically.

## Following gates

Additional focused health contract gate now passes6 tests/61 assertions in a separate network-none/read-only UID33 SQLite-memory process: foreign snapshot/observation ciphertext and missing/foreign references; unsupported schema/catalog and unreadable key without blank fallback; Tehran date/birthday boundary; bounded history with retained selection; hidden serialization/observation immutability; and exact encrypted backup/restoration with retained key/correction lineage/API revision/audits. The first5/46 receipt remains historical; the restore delta has its own readiness receipt. The first key test retained Laravel's cached Crypt facade; explicitly rebuilding both container and facade instances corrected that test setup, with an assertion on the effective isolated key. No production change or weakened assertion.

Repeat this isolated delta with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/health/test-contract.ps1`. Original11/126 and frontend41 acceptance remain unchanged source evidence. PHP Pint on both new PHP files and project quality ratchets pass. Three direct unsafe-context probes (live host, live database and project config-cache path substitutions) refuse before application boot/SQL with network disabled. The31 reused Docker/DB admission tests remain intact.

Broader taxonomy editing still requires backward readers and retained IDs/labels before it can be enabled in the blog/taxonomy slice; the current health release uses the fixed approved catalog1 only. The activation/rollback/served ENFA package is now prepared and awaits separate live authorization/backup readiness. No health data or schema is active yet. Blog/article taxonomies and reviewed recommendation rules follow that gate.

## First-attempt diagnosis and guarded retry

The immutable `patient-health-mysql-failed-1792693712895-2026-10-22.json` records a first-pair barrier refusal, no accepted cases and no production-source change. The harness required process-list command `Query`; PDO's native prepared locking statement appears as `Execute`. The read-only `--inspect-lock` diagnostic repeats only two locking SELECT/rollback operations on the existing synthetic fixture, compares user/health/audit/job row hashes and proves actual `Execute`/locking-query visibility with zero business writes. Its receipt is `patient-health-lock-diagnostic-1792694201783-2026-10-22.json`.

The corrected harness accepts Query/Execute while retaining connection-ID, exact user-lock SQL and unfinished-contender checks. Connection IDs are explicitly obtained from the write PDO used by transactions. No production policy or lock is weakened. Source preflight and PHP syntax/Pint pass after correction. The empty-schema guard still refuses the populated fixture; no automatic reset/replay occurred.

Operator recreation, after reviewing this correction:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/start-schedule-acceptance.ps1 -RecreateDisposable
if ($LASTEXITCODE -ne 0) { throw 'Disposable recreation failed; stop here.' }
```

The existing guard rechecks exact project ownership/pin/internal network/tmpfs/sole membership before replacement. After operator completion, verify health and run the corrected health harness once; retain both original failed/diagnostic receipts.

## Audit JSON comparison correction

After operator recreation, `patient-health-mysql-failed-1792694943694-2026-10-22.json` stopped at first-case audit-key ordering. The contention barrier, one-commit/one-stale outcome, snapshot/observation/audit counts and exact fact/measurement checks had passed; the case remains unaccepted because its final checks did not finish.

MySQL [normalizes JSON object keys](https://dev.mysql.com/doc/refman/8.0/en/json.html#json-normalization); object insertion order is not an integrity property. The new assertion sorts keys on both metadata maps, then compares **exact keys, scalar types and values**, including snapshot/version/schema/change/observation counts, action/actor and null reason. It does not coerce values or allow additional fields. Pair outcomes are now emitted before later assertions so failures retain the observed interleaving.

Read-only receipts `patient-health-lock-diagnostic-1792695036404-2026-10-22.json` and `patient-health-lock-diagnostic-1792695124756-2026-10-22.json` confirm key-set/actor/null reason and final typed metadata respectively, with unchanged row hashes. One intervening diagnostic wrapper rejected a concurrently finishing temporary Pint container as an unrelated inventory change (`patient-health-mysql-failed-1792695095049-2026-10-22.json`, process exit0). It made no business writes and was repeated sequentially; future acceptance/inventory checks must run without overlapping disposable helper containers. All receipts remain immutable.

Production implementation was unchanged; preflight/Pint passed. The operator then recreated the guarded database and the corrected full execution passed all eight cases. The assistant performed guarded final cleanup under the earlier exact removal delegation and verified absence. Never bypass the populated-schema guard or replay these now-accepted writers.
