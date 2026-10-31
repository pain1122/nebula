# Article publication scheduling: source acceptance

Update: the user-requested [one-page composer](article-composer-2026-10-23.md) supersedes the separate-step editor UX below. Draft/Publish/Schedule now lives on the editor; one explicit confirmation runs ordinary reviewed actions atomically. Its immediate draft/publish UI is deployed on a85a88d4. Scheduling source guarantees remain; live extension schema/flags/dedicated publisher are still inactive. This document retains the original source-only checkpoint and does not authorize replay or activation.

October23, Asia/Tehran. Implements the scheduling portion of the already approved [scheduling/media package](article-scheduling-media-proposal-2026-10-23.md). No additional source approval is needed. Live activation is separate and has not occurred.

## Result and ordinary workflow

The existing article operations card has an optional **Publish on (Asia/Tehran)** input. A schema3 version stores its strict Tehran wall-clock time and server-calculated UTC instant in the immutable presentation snapshot and content hash. Saving the preference does not create a schedule or publish anything. The preferred time appears in version previews and editorial review. Schema1/2 hashes and historical readers remain compatible; an older client cannot silently discard schema3 presentation data.

After ordinary submit/review, admin/root can confirm an exact-version schedule using the existing password/reason/confirmation dialog and a fresh signed context. Arming requires a future time (one minute through366 days), current reviewer authority, active taxonomy and a recent successful article-publisher heartbeat. The server derives the time from the reviewed snapshot, never from an arbitrary action payload. Cancellation works while the publisher is unavailable. To reschedule, edit the preferred time, submit/review that new version, then confirm its schedule. The same current schedule identity is retained with a new revision and append-only audit.

Draft edits, version recovery, archive and immediate publication cancel an armed schedule inside the same transaction as their ordinary action and audits. Immediate publication remains available after review. Failed audits roll back both the content operation and schedule invalidation. Metadata-only audit snapshots contain schedule identity/version/hash/time/status, without article bodies, private health or storage details.

The English/Farsi scheduling card shows the selected time, schedule state, exact version and publisher availability. Both confirmation paths refetch their signed context before password-confirmed submission. Session/cancel/uncertain-delivery handling reuses the established shared action dialog; writes are never automatically replayed. The editor retains the approved Add Product composition, native language tabs and adjacent action buttons. Media references remain explicitly refused in this slice: only null thumbnail/empty inline manifests can be stored until the separate verified asset resolver is implemented.

## Dedicated publisher and feature boundaries

`articles:publish-due --limit=20` is a source-defined bounded command (allowed limits1–50). It queries only due armed article schedules, locks catalog/authority/article/schedule/references, and rechecks current scheduling actor/reviewer authority, exact reviewed content hash/version, stored instant, archive/state and taxonomy eligibility. It updates the publication pointer and result audit atomically. Duplicate ticks skip completed schedules. Revocation, changed binding and invalid content block delivery with safe codes; unexpected transaction failures roll back and fail the command. It neither dispatches nor consumes queued jobs and is deliberately absent from the application's general scheduler.

Three new configuration flags default false:

```dotenv
ARTICLE_PRESENTATION_ENABLED=false
ARTICLE_SCHEDULING_ENABLED=false
ARTICLE_PUBLISHER_ENABLED=false
```

The main `.env` has not been edited. Existing article administration remains enabled. New scheduling routes refuse503 while disabled or when the exact extension schema is absent. Legacy draft/review/immediate-publication operations still work without the extension tables/column. Historical schema3 data remains readable if new controls are later disabled; no down/reset/history deletion is an application rollback strategy.

After a fully successful bounded tick, the publisher writes a short-lived cache heartbeat. The panel requires a success within120 seconds and all relevant flags before advertising publisher availability. This is source behavior, **not evidence of a deployed supervised runner**. No command shown here authorizes a live invocation, general `schedule:run`, queue worker or scanner/parser activation.

## Verification

Run the source-only gate from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/content/test-publication-schedules.ps1
if ($LASTEXITCODE -ne 0) { throw 'Isolated scheduling source gate failed.' }
```

Final **230 tests/1,764 assertions** pass:27 scheduling/preference/API/delivery cases,18 pure timezone cases,168 retained content/SEO/draft/editorial/read tests and17 retained/extension schema tests. Initial210/1,600 and expanded213/1,652 passes preceded final schema regression integration. Tests cover role/privacy refusals, version/time tampering, stale/duplicate requests, recent password, no implicit scheduling, new-version rescheduling, cancellation, ordinary invalidation, actor/reviewer revocation, retired taxonomy, bounded due delivery, duplicate ticks, audit rollback, legacy unmigrated authoring, version recovery and an unchanged unrelated job sentinel. They are isolated SQLite tests; **real MySQL contention is still unaccepted**.

The runner uses pinned PHP18eb9257, UID33, network none, read-only source, masked private storage, isolated empty environment/cache and SQLite memory. No Compose, live credentials/database/storage, downloads or actual queued-job consumer. PHP style passes15 affected files. Focused frontend **53 tests** pass, including ENFA preference submission without browser UTC conversion, exact ownership/manifest rejection and fresh-context/password-coordinator scheduling. Type checking, lint, formatting and quality ratchets pass. Source tests do not substitute for native served UI/clock/restart acceptance.

Read-only preservation proves30 business/protected/audit fingerprints and health counts unchanged, both medical jobs retained, nine normal services running and six helpers stopped. Static admin staysccc631be/45 assets; no build/recreation/deployment. New tables/column/migration and all three flags remain absent/false live. Receipts: `evidence/article-publication-schedules-preservation-2026-10-23.json` and `evidence/article-publication-schedules-2026-10-23.json`. Earlier immutable acceptances are retained; this source slice supersedes their modified source bindings only.

## Next and activation gate

Continue the approved source work with the private editorial image library: server-owned admission policy, exact checksum, current real scan/parser evidence, release/retirement and immutable asset manifests through local/S3-compatible storage. Then connect the real shared File Manager thumbnail/active-language editor modal and article-only sanitizer without changing questionnaire safety. Do not use toolbox fake files, arbitrary URLs, medical documents or the direct-public legacy upload path.

After media source verification: separately authorized disposable MySQL contention/rollback, native served ENFA/role/width acceptance and actual synthetic media acceptance; then prepare the exact live migration/flag/static-admin/supervised publisher activation package. Current source approval permits none of those live operations. No need to request the already granted source/schema/design approval again.
