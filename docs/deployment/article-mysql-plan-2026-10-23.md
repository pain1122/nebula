# Focused article MySQL acceptance plan

Historical planning matrix; the bounded eleven-case runner is now accepted in [the MySQL execution record](article-mysql-2026-10-23.md), with guarded cleanup verified. Category-cycle and copy-specific audit-failure permutations below retain isolated source coverage, not extra real-MySQL claims. The clinical19 and health8 suites remain closed and must not be replayed. Subsequent exact article activation/ordinary authoring also passed; see [live acceptance](article-authoring-layout-2026-10-23.md).

Use the existing exact `checkupino_schedule_acceptance` pinned internal/tmpfs disposable database and its admission/start/recreate/remove guard. Database Compose startup/recreation/cleanup remains operator-owned. Prepare the harness and isolated fixture/contract preflight **before** requesting startup; do not ask the operator to create a database for unfinished scaffolding.

| Case | Required result |
| --- | --- |
| Two edits from the same draft revision | One commit, one stale refusal; one new version/audit |
| Competing duplicate article slugs | One identity; second operation safely refuses, no orphan version/references/audit |
| Concurrent category reparenting toward a cycle | Shared catalog ordering prevents a cycle; stale/current-parent checks refuse the loser |
| Taxonomy label change before reviewed publication | Old catalog/action revision refuses; retained previous version labels remain unchanged |
| Retirement before publication | Fresh promotion cannot use retired references; published pointer/history remain unchanged |
| Publication before retirement | Published exact snapshot remains intact; retirement invalidates later promotion contexts |
| Copy older version versus normal edit | One new draft winner; stale loser; immutable source/current publication retained |
| Archive before competing promotion | Archive remains terminal; no later publish pointer change through stale context |
| Late audit failure in publish/copy/taxonomy update | Entire transaction rolls back state, versions, references, catalog revision and audit |
| Deactivation/role revocation before write | Fresh locked authority refuses despite a previously valid context/password |

The harness must use ordinary bound request/session services with cached authenticated actors, persisted/reloaded model representations and stable typed JSON comparisons. Earlier clinical/health harness corrections showed why these details need source rehearsal first. Assert exact connection/user lock waiting using PDO's actual `Execute` process status as well as `Query`; prove the intended barrier, not merely elapsed time. No arbitrary sleeps as race proof.

Use accepted implementation hashes, fresh synthetic users/taxonomies/articles and a sentinel job in the disposable schema only. Exercise current MySQL isolation/foreign keys/unique constraints and catalog -> authority -> target/reference lock order. Assert append-only version lineage, exact published/reviewed/source hashes, one valid audit per success, preserved unrelated sentinel rows and metadata-only errors. No manual clinical/paid/clean/completed states or live API/health reads are needed.

Require exact empty-schema admission; never automatically reset or rerun a populated fixture. Preserve failure receipts and diagnose read-only before arranging guarded recreation. On success, record source/MySQL/image/lock/outcome evidence and arrange guarded cleanup, then verify exact test container/network absence. Do not claim network/worker/scanner or live writer acceptance.

Only after that gate: separately authorize the [exact article activation/rollback package](article-panel-activation-proposal-2026-10-23.md), then accept ordinary synthetic authoring/publication/history. No new patient-library URL or reviewed recommendation rule is included.
