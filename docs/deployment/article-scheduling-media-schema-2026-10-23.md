# Scheduling/media additive schema: source acceptance

Update: the following [scheduling/preferences/API/publisher and ENFA source slice](article-publication-schedules-2026-10-23.md) now passes230/1764 and frontend53. This document records the earlier schema-only checkpoint; its then-next implementation notes are historical. Live extension migration/flags/runner and the File Manager/media slice remain unaccepted.

October23, Asia/Tehran. User explicitly approved the [three-table/nullable-presentation source package](article-scheduling-media-proposal-2026-10-23.md) and isolated tests. That approval is recorded; do not request it again. It is separate from live migration/activation.

Implemented [the additive migration](../../database/migrations/2026_10_23_000001_create_article_scheduling_media_tables.php):

- `article_publication_schedules`: one current row per article, exact article/version ownership, content hash, UTC time/explicit timezone, scheduling actor, revision/status/blocker and lifecycle timestamps.
- `article_media_assets`: separate editorial purpose, private storage/object identity, checksum/MIME/size/dimensions, uploader, quarantine/validation/release/archive lifecycle and policy evidence.
- `article_version_media`: exact article/version and asset/checksum references, usage and language; restrictive foreign keys and duplicate-use protection.
- Nullable `presentation` JSON on `article_versions`. Existing content rows are untouched; no backfill, six-table migration edit or schema1/2 hash rewrite. Content-schema3 readers/writers are not yet implemented by this migration.

The migration preflights parent tables and refuses preexisting/partial extension state before DDL. Down preflights every table/column and refuses any operational row, presentation/schema3 row or retained schedule/media audit, before dropping anything. Application rollback retains populated state. One current schedule is a coordinated state record; changes/results will use append-only audit in the following service slice.

## Verification

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/content/test-scheduling-media-schema.ps1` passes **35 tests/136 assertions**: nine new schema/rollback cases, eight retained article-foundation cases and eighteen timezone cases. Initial narrower gate32/124 also passed. PHP style passes all four PHP files (new migration/schema tests and prior time helper/tests).

The runner uses the existing pinned PHP image, UID33, no network, read-only source, isolated empty environment/cache, SQLite memory and masked private storage. No Docker Compose, MySQL service, live `.env`, database reset or queued-job consumer is used. Synthetic job/health/business fingerprints stay unchanged inside the tests.

Assertions cover exact parent-version and asset-checksum constraints, duplicate schedule/link refusal, deletion restrictions, bilingual reuse, initial quarantine state, empty up/down preserving old versions/business/health/job data, populated schedule/asset/history/audit rollback refusal, partial-state refusal and no partial DDL. SQLite verifies these source contracts; real MySQL contention/migration acceptance remains a later named gate.

## Runtime and next slice

Read-only before/after evidence verifies all current business/protected/audit fingerprints, health counts, two medical jobs and service images/states unchanged. Nine normal services run; six helpers remain stopped. Static panel remainsccc631be/45 assets. None of the three new tables/column is applied live. No scheduling/media API, scheduler command, File Manager modal or media insertion is presented as delivered yet.

Continue under the already approved source scope: versioned Publish on preferences/schema3 snapshot compatibility; fresh signed arm/reschedule/cancel; exact reviewed-version dedicated publisher; then validated purpose-separated image admission/read/serve/reference contracts and the shared thumbnail/editor File Manager modal. Preserve immediate publication, explicit Tehran/UTC semantics, article-only processing and both unrelated medical jobs. Never start the general scheduler/queue to implement automatic article publication. Fresh scan/parser proof and actual supervised runner availability are still live acceptance prerequisites.

The [current expanded checklist](../../CURRENT_TASK.md) retains every remaining stage. The immutable acceptance/source/runtime receipt is `docs/deployment/evidence/article-scheduling-media-schema-2026-10-23.json`. Earlier pure-time-only pending-approval receipt remains historical evidence.
