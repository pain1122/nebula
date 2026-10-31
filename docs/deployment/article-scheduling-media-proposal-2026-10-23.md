# Article scheduling and File Manager integration proposal

Requested October23, Asia/Tehran. Existing article pages and original Velzon/Bootstrap components remain; no new panel URL or dependency. This package supplies real persistence and media eligibility rather than wiring the toolbox's fake file list into authoring.

Current status October24: source/schema/design approval is retained. Shared File Manager, thumbnail grid and native editor adapter are now source/UI accepted on e03d9719/44 assets; see article-file-manager-2026-10-24.md. The user deferred automatic scheduling and prioritized media. Exact live extension migration and media flags remain unapplied pending their existing authorization gate; no current scanner or persisted-media acceptance is claimed. Next media activation/current scanner-parser proof/ordinary synthetic upload acceptance, then patient library/rules. Source approval does not authorize live activation, and no duplicate source/design approval is needed.

## Author controls

- Operations card: optional **Publish on**, explicitly labelled Asia/Tehran, stored in the draft and shown during exact-version review. Saving a preferred time alone does not publish. After review, ordinary password/reason/revision/confirmation controls arm the exact version for scheduled publication. Staff can reschedule or cancel through fresh signed contexts. Immediate publication remains available.
- Thumbnail card: **Choose from File Manager**, localized alternative text, preview and Remove. The editor's **Insert media** control opens the same modal. Selection preserves the active editor/selection and chosen language. Cancel does not mutate the draft. Thumbnail/media references survive ordinary version recovery.
- Retain the original File Manager search/grid/list/file detail styling in the modal, using real admin/root authoring-library data. No patient/doctor private documents, medical file rows, arbitrary URL imports or fake selectable assets. First accepted kinds are JPEG/PNG thumbnail and inline images, matching the accepted isolated decoder contract. Video/audio/WebP/SVG/archive activation remains explicitly unavailable until its own validators/transport acceptance; installed toolbar plugins are not proof of safe media processing.

## Additive source migration requiring named approval

One new guarded migration, separate from the previously approved six-table migration:

1. `article_publication_schedules`: public ULID; article/version identity and exact content hash; requested UTC instant and explicit timezone; scheduling actor; current state/revision, lifecycle timestamps and safe blocker code. One current schedule per article; complete changes/results are append-only audited. Foreign keys and service ownership checks prevent cross-article versions. Concurrent delivery is idempotent.
2. `article_media_assets`: public ULID; editorial-purpose owner/uploader; private disk/object identity and checksum; original display name, real MIME/size/dimensions; quarantine/validation/release/archive state; policy/scan evidence revisions and lifecycle timestamps. No patient linkage or private medical import. Paths/credentials/raw evidence stay out of browser resources/audits.
3. `article_version_media`: exact immutable article-version/asset/checksum references with thumbnail/inline usage and language. Restrictive relations retain used assets/history; selection and publication recheck fresh eligibility.
4. Nullable `presentation` JSON on `article_versions`: strict content-schema3 publication preference and server-owned thumbnail/media snapshots. Existing content schemas1/2 and their hashes remain byte-compatible; no backfill or rewrite. A preference is not an armed schedule.

Rollback disables the new feature/runner and retains every populated table/column/version/reference/audit. Migration down refuses existing data/history. No reset/reseed, key/credential change, existing six-table migration edit or medical-schema extension is included.

## Publication execution

A dedicated bounded `articles:publish-due` command processes only due, armed article schedules. It does not call `schedule:run`, dispatch general jobs, start a queue consumer or consume the two existing medical jobs. Store instants in UTC and display Tehran explicitly; reject malformed, ambiguous or past input. Source contract uses a bounded scheduling horizon rather than an unbounded future timestamp.

At execution, lock catalog -> current authority -> article/schedule/references consistently; recheck current scheduling actor/reviewer authority, exact reviewed version/hash, active taxonomy, safe released media, cancellation/archive and due time. Draft changes/recovery/archive invalidate the old schedule atomically. Each outcome is audited without article bodies/private data. Repeated ticks cannot double publish. Failures stay blocked/visible; no late silent publication of another version. A real supervised once-per-minute invocation/heartbeat and clock/restart acceptance are required before the panel claims automatic timing is active. Missing runner access is shown honestly.

## Media admission

Reuse server-owned section/type/size limits and existing bounded scan/parser interfaces against a verified private copy. Storage is behind the existing local/S3-compatible abstraction with a separate editorial purpose; preserve SeaweedFS/AWS support and existing credentials. Never reuse patient buckets/objects. Quarantine first; require current real engine/content evidence and exact checksums before select/serve/publication. Scanner/parser outage, unsupported kind, stale proof or tampering leaves the asset unavailable.

The current `PublicMediaService` validates MIME/size then writes directly to the public disk; it has no scan/release contract. Do not expose it as the new library upload endpoint. Existing article/questionnaire sanitizers deliberately remove images/media; implement article-specific media allowlists/manifest resolution without weakening questionnaire or arbitrary-URL protections. JSON-LD still remains non-executable data.

## Verification and live boundary

Implement in bounded slices: timezone/preferences contract -> additive source schema/scheduling integrity tests -> exact-version dedicated runner -> guarded image-library APIs/storage contract -> reusable modal and article-only editor adapter -> isolated MySQL contention/rollback -> separate deployment/activation package. Synthetic files only; preserve current data and both queued jobs.

This proposal requests **source migration, implementation and isolated tests only**. It does not authorize live migration/backfill/content save, new credentials/dependencies, scanner/parser recovery, scheduler/worker deployment, queue consumption or new disposable Compose lifecycle. Those operations require their own concrete activation package after gates pass. Existing static-admin build delegation remains available when a compatible bounded candidate is ready.
