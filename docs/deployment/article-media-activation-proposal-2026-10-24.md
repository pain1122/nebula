# Editorial image library activation package

Completed October24: [real image acceptance and current next steps](article-media-real-acceptance-2026-10-24.md) supersede the earlier startup/positive-flow pending descriptions in this prepared package. Migration/activation are already authorized and delivered; do not request them again or replay them.

October24 execution update: the user authorized this activation by instructing us to start after the concrete plan. The exact migration and two flags are applied and verified. Read [the live checkpoint](article-media-live-activation-2026-10-24.md); remaining commands and earlier absent-schema descriptions below record the prepared package, not current absent schema. Scanner/parser startup/current engine and positive synthetic verification remain open.

October24, Asia/Tehran. The user deferred automatic scheduled-publication activation and prioritized File Manager, CKEditor insertion and a thumbnail grid above tags. Source/schema/design approval is already granted; this package covers the missing live boundary only.

## Ready source and current boundary

The existing article editor now has the thumbnail grid and the shared retained File Manager modal. Both native EN/Farsi editors use its toolbar action and restore their own selection. Purpose-separated staff-only image APIs support private JPEG/PNG admission, quarantine, automatic bounded scanner/isolated-parser preparation after upload, release, exact-version references and retirement. Patient documents and the direct-public legacy uploader are excluded. Existing article schemas1/2 remain readable/writable without this extension.

October24 seamless-action update: media16/147 plus retained article238/1823 and UI78 pass; see [the current UX/security contract](article-seamless-actions-2026-10-24.md). No live schema/flag activation follows from that UX change.

Historical source gates before that update: fourteen isolated SQLite media tests/133 assertions and retained237 article tests/1813 assertions pass. Ordinary source publication/edit/recovery retains exact manifests and the published pointer; reordered JSON object keys do not break identity. Validator doubles exercise application decisions; they do not establish real current scanner acceptance. Focused frontend73, typecheck/lint/format and unchanged quality ratchets pass. Native browser acceptance and its evidence are recorded in the companion delivery note after completion.

Read-only `scripts/content/migrate-article-media.ps1` preflight passes against the existing UID33/MySQL runtime: six foundation tables exist; extension tables/presentation column/migration record are absent; media/presentation/scheduling/publisher flags remain false. One article/three versions, three terms/versions, nine term links and both queued jobs are retained. Source migration SHA256 is pinned as `5fb1a8ff1866e15c89d1f008f5fd225c7258442b5b08ac2f39d4dae3ca88fc49`.

## Exact migration, only after explicit live approval

From `C:\Users\Pain\Desktop\work\checkupino`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/content/migrate-article-media.ps1 -ApplyExactMigration
if ($LASTEXITCODE -ne 0) { throw 'Exact media extension migration failed; stop here.' }
```

This repeats the read-only admission checks and executes only `2026_10_23_000001_create_article_scheduling_media_tables.php` as UID33 on the existing application. It adds the approved three tables and nullable presentation JSON, then verifies migrated/disabled state. It never resets, seeds, migrates another path, edits credentials, starts Compose or processes jobs. Any failure stops for inspection; MySQL DDL is not presented as transactionally reversible.

After migrated/disabled verification and preserved-row comparison, set only `ARTICLE_PRESENTATION_ENABLED=true` and `ARTICLE_MEDIA_ENABLED=true` in the main `.env`. Keep `ARTICLE_SCHEDULING_ENABLED` and `ARTICLE_PUBLISHER_ENABLED` false/unset. The agent may apply those exact flag edits only when included in the live approval. Configuration cache must remain absent; never run a general cache/build/deploy command to bypass this check. Verify:

```powershell
docker exec --user 33:33 --workdir /var/www checkupino_app php scripts/content/inspect-media-activation.php --expect-enabled
if ($LASTEXITCODE -ne 0) { throw 'Media activation verification failed; stop here.' }
```

The default `article-media` disk is private local storage under `storage/app/article-media`, separate from patient storage. Inspect root ownership/writability as UID33 before uploading. Do not replace credentials or use the public storage link. S3/SeaweedFS support uses a separate private editorial bucket/dedicated credentials; TLS is required unless the operator explicitly configures the dedicated insecure-HTTP opt-in for an intended local endpoint. Real S3 lifecycle/ACL acceptance remains separate.

## Scanner/parser and ordinary synthetic acceptance

The scanner/parser are currently stopped and definitions are not current acceptance. Enabling the library permits quarantined admission; it does not establish image release. Separate controlled recovery must inspect the latest cooldown and intended Docker route before any official definition request, then verify real clean/infected/error/stale behavior. No mirror/verdict shortcut and no general worker/queue consumer. The two existing medical jobs must remain untouched.

After genuinely current scanner/parser proof, separately authorize one new synthetic JPEG/PNG through ordinary direct upload -> automatic validation -> fresh File Manager selection -> direct article Save/Publish and ordinary version recovery. No password/reason/reconfirmation for File Manager or Save/Publish; archive/recovery/standalone review retain their existing controls. Bind the exact checksum/version/reference and verify metadata-only audits. Browser fixtures are not persisted-media or engine acceptance. Do not replay the earlier one-time article acceptance harness or modify an existing published version in place.

This package does not request automatic scheduling activation, new dependencies, new panel URLs, patient-health writes, account/profile saves or private medical file access. Backend/scanner/parser/database Compose ownership remains with the operator unless the user explicitly delegates the named commands.

## Rollback

Disable only `ARTICLE_MEDIA_ENABLED` and `ARTICLE_PRESENTATION_ENABLED`, return to the retained compatible panel image if necessary, and retain every populated extension table, JSON manifest, object, immutable version link and audit. Never run migration down on populated/history-bearing extension state. Legacy text authoring remains available; attempts to discard newer schema3 media with an older client are rejected. Retired/stale/missing media blocks serving and new publication while version history remains intact. Private orphan reconciliation after ambiguous admission, real MySQL interleavings and broader media formats remain explicit hardening items.
