# Resume recommendations after the November8 source checkpoint

Current checkout: original Windows/WSL laptop, `C:\Users\Pain\Desktop\work\checkupino`, Asia/Tehran. Repository: `pain1122/nebula`, branch `main`. This checkpoint continues imported commit `ac57e6d` (patient library/showcase); it does not include a new deployment or database activation.

## Changes since the other-PC pull

| Area | Delivered change | Verification and limits |
| --- | --- | --- |
| Rule protocol | Bounded typed conditions, include/exclude trees, stable health terms, explicit freshness/units, exact age/BMI arithmetic and unknown-state handling | Pure synthetic tests; no built-in diagnostic thresholds or approved clinical rules |
| Persistence and authority | Six additive recommendation tables, immutable versions/reviews/withdrawals, reviewer designation, exact article targets, separate working/published versions, fresh role/account checks, atomic metadata audits | Source plus isolated native MySQL; migration has not run on the original app |
| Staff interface | Approved `/panel/recommendation-rules`, `/new`, `/:ruleId`; retained Velzon author/review controls, synthetic preview and root reviewer-access controls | Frontend source tests pass; this candidate has not been deployed or accepted in a browser |
| Patient interface | Owner-only personal-suggestion API and article sidebar, separate from general Recommended reading | Private eligibility precedes health access; flags remain disabled; no real clinical result is activated |
| Shared integration | Recommendation route/registry/menu/transport/paired locale additions; shared article sanitizer with compatibility export; audit allowlists | Preserve other feature code in these shared files; see the impact map |
| Acceptance tooling | Source-bound isolated runners, eight catalog interleavings, sixteen cross-module interleavings and integrity/expiry/replacement protocols | Both disposable lifecycles passed and operator cleanup was independently verified; accepted MySQL writers are closed to replay |
| Handoffs | Ordered CURRENT_TASK, source/MySQL reports and dependency/conflict map | Earlier dated checkpoints describe history; this page and CURRENT_TASK give the current next action |

No dependency, general worker, scanner/parser startup, main credential replacement, original-laptop reset/reseed, live health write, clinical grant or personal matching was included. Other-PC installation/reset/worker/publisher instructions remain machine-specific.

## Accepted gates

- Backend recommendation and affected article regression:158 tests /1,118 assertions. Frontend affected regression:117 tests across five files, with TypeScript/lint/format/quality gates recorded in the source report.
- Cross-module offline fixtures:20 tests /155 assertions; unchanged disposable admission guard:31 tests. These counts are different scoped gates, not a single full-suite total.
- Native MySQL8.0.46 / repeatable-read: eight catalog and sixteen cross-module observed lock interleavings. DDL/empty rollback, five native FK refusals, canonical JSON, populated rollback refusal, exact immutable/audit deltas, account/profile/grant/review changes, article/health races, expiry and independent-review replacement pass.
- Both operator-owned disposable cleanups are complete. Exact container/network absence and zero project members were verified; the final acceptance's142 source hashes still match. Unrelated runtime/tables/queue were preserved by the native runner.
- Original-app read-only checkpoint: nine intended services; helpers stopped; HTTP/MySQL/Redis healthy; both recommendation flags false, schema absent, two pending jobs. These are dated observations, not instructions to assume today's runtime state. Reinspect before any runtime work.

## Resume order

1. Read `AI_BOOT.md`, `CODEX_RULES.md`, `CURRENT_TASK.md`, then this page and the [change-impact map](recommendation-change-impact-2026-11-08.md). Start with read-only container/worktree/config sanity. Do not restart accepted writers or general workers.
2. Prepare the initial review dossier: exact intended article/version, criteria/exclusions, paired explanations, evidence sources, population/limitations, freshness and review validity. A qualified independent reviewer must supply actual clinical assessment. Synthetic fixtures and developer/root approval do not provide that assessment. Rule criteria are versioned records, not new evaluator constants.
3. Prepare the exact live activation proposal and rollback commands. Reuse the existing single six-table migration; inspect its current status, effective flags/cache and static candidate. Separate authoring deployment from patient matching: authoring can be accepted while matching remains disabled. Do not add a new dependency, route or schema merely to activate the delivered source.
4. Obtain the separate live scope authorization before migration/configuration/deployment, reviewer designation or synthetic live writes. Prior source/schema/routes/reviewer-model approvals remain valid and must not be asked again. Database Compose ownership stays with the operator unless explicitly delegated for that operation.
5. After authorization, accept the same deployed candidate through ordinary bounded author/reviewer/publish/withdraw and patient owner flows, including EN/Farsi desktop/mobile, role/session refusal, stale/duplicate/uncertain delivery and quiet unavailable personal suggestions. Activate personal matching only after actual independent review. Preserve general library reading and published history on rollback.
6. Complete CURRENT_TASK section6: integrated patient/doctor/admin/root rehearsal, walkthroughs, release limits and identifiable candidate freeze. Broader media/scheduling, attended profile/health saves and other unproven mutations remain separately listed; do not silently mark them complete.

If no real clinical reviewer is available, continue activation-package preparation and the general demo/release work without inventing approval or enabling personal matching.

## Files and conflict boundaries

The [dependency map](recommendation-change-impact-2026-11-08.md) identifies direct edits, downstream consumers, shared hotspots and test implications. There were no unmerged Git entries before publication; origin/main matched `ac57e6d` at the November8 fetch. Source/tests/docs from this package are committed together rather than importing a second copy over modified files.

Changing application sources covered by the52-file source or135-file cross-module binding requires fresh evidence for that new candidate. Existing receipts remain historical and immutable. Do not change stored expected hashes, overwrite successful receipts, relax populated-schema guards or replay an accepted MySQL writer. Documentation-only edits outside those bindings do not invalidate their source proof.

## What a new PC receives

Git contains application source, tests, migration definitions, disabled flag examples and readable acceptance/runbook summaries. It does not carry the current database/key, private `.env`, uploads, local images/dependencies, browser captures or generated JSON receipts under `docs/deployment/evidence/`.

Consequently, a clean clone is not an activated deployment and receipt-bound acceptance runners may refuse to start because prior local artifacts are absent. Do not fabricate those receipts or copy private machine configuration to bypass a refusal. Use the deployment manual for setup, keep a distinct authorized acceptance plan for the target candidate, and retain local proof on its originating device. The completed historical MySQL cases do not become pending simply because their receipts are not in Git.

## Authoritative references

- [Current queue](../../CURRENT_TASK.md) and [build/deployment manual](BUILD_AND_DEPLOY.md).
- [Approved recommendation contract](recommendation-rules-proposal-2026-11-05.md).
- [Source behavior and scoped checks](recommendation-rules-source-2026-11-07.md).
- [Eight-case catalog acceptance](recommendation-mysql-catalog-2026-11-07.md).
- [Sixteen-case cross-module acceptance and cleanup](recommendation-mysql-cross-module-2026-11-08.md).
- [File/dependency map](recommendation-change-impact-2026-11-08.md).

This handoff is the source publication checkpoint. A successful push must be confirmed separately against the remote commit; no deployment, migration or clinical activation follows from pushing Git.
