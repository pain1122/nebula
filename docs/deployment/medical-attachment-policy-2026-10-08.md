# Medical Attachment Policy Source Acceptance

October 8, 2026, Asia/Tehran. The user first approved the exact [two-column source proposal](attachment-policy-proposal-2026-10-08.md), then explicitly approved applying it live with rollback compatibility. **The live additive migration is applied and verified.** Backfill, resets/reseeds, new UI and scanning/storage activation remain excluded. The ordinary live upload-setting save/reset acceptance is complete separately, with audits 5/6 and restored medical/public defaults 10/5 MiB.

Latest continuation: [ordinary synthetic attachment APIs](attachment-api-acceptance-2026-10-08.md) now pass. Current state is **one open PDF-only 1 MiB request, one quarantined/unscanned file, zero reports/jobs**, retained audits 7/8 and unchanged settings/protected/booking/payment/outbox/earlier-audit fingerprints. User-run backend recovery passes; nine required services run while scanner/check remain stopped. The zero-medical snapshots below record the earlier migration acceptance, not current counts. Current rechecks use `--activated --after-api` and `verify-attachment-api.mjs --verify-existing`; never replay writes to recreate old counts.

## Delivered Source

The new additive migration `2026_10_08_000000_add_attachment_policy_to_medical_requests.php` adds nullable `attachment_policy` JSON and `attachment_policy_revision` char(64) to medical requests. Existing migrations and records are preserved; there is no backfill. Default test factories remain legacy records; an explicit `withAttachmentPolicy()` state creates issued synthetic fixtures.

Assigned-doctor request creation accepts optional `attachment_rules` with `allowed_mime_types` and integer `max_bytes`. The service validates narrowing against current medical section/type/operator/scanner authority and derives the reservation, owner and fixed `file` purpose from server records. Omitted rules capture current defaults. Reject unknown fields, unsupported/duplicate/empty types, noninteger/nonpositive sizes and raised authority. Client policy snapshots and revisions cannot be mass assigned.

`MedicalAttachmentPolicy` writes a versioned, canonical snapshot and SHA-256 revision with request creation and its minimal audit in the existing transaction. Model saving rejects later snapshot/revision mutations, including force-fill updates; missing legacy policies are not manufactured. Changing requirements requires a new ordinary authorized request. This is application immutability, not a database trigger or a signature protecting against privileged database tampering. Invalid shape or digest fails closed on upload.

The common resolver uses canonical server records for both patient FormRequest validation and direct upload-service calls. It checks owner, same reservation, open status and retention before validation or storage. The response authorizes full canonical ownership even when the calling resource has projected reservation fields, and exposes only field/state, allowed types, effective exact-byte limits and opaque issued/effective revisions. Legacy or unusable policies return `state: unavailable`; they cannot accept uploads.

Current section types intersect issued types; each effective size is the smaller of issued/current limits. Later global increases do not enlarge an issued request; decreases and removed types restrict new uploads. Invalid current configuration fails closed. `UploadPolicySettings::capture()` reads policy and revision from the same stored value and supports the writer's definition/value lock order inside a transaction, including the indexed absent-definition lookup. The effective revision binds issued/current revisions and resolved limits.

Before staging, validate actual MIME and exact whole-file bytes against that effective policy. After staging, recheck canonical request and current policy under the request/settings locks. A changed revision rejects acceptance and uses existing object compensation, with no file/audit/job committed. Accepted uploads remain quarantined, with issued/effective revisions in their minimal audit. Existing scan freshness/provenance/checksum, verified historical reads, private storage, replacement compensation and lifecycle guards remain intact. Generic private/public uploads retain their existing section policies; this does not extend questionnaire or public-asset forms.

## Verification

As www-data with `APP_ENV=testing`, SQLite `:memory:`, array cache/session, sync test queue and isolated writable `/tmp` Laravel storage/config/routes/events paths:

- **129 tests / 716 assertions pass**, 36.195 seconds, 62.50 MiB. The 13-file suite covers the new 21 attachment cases plus existing request/file APIs and services, settings/byte policies, integrity, medical jobs, review/outcomes and schema/migration lifecycle.
- Cases include default/PDF narrowing, immutable snapshot/digest, API and direct-service authority rejection, exact boundary/one extra byte, global tightening/relaxation, removed types/invalid capacity, legacy/tampered policies, cross-owner/reservation denial, transfer-time revision change/object cleanup, existing audit rollback and additive migration round trip.
- The first bounded run exposed authorization against a projected reservation; canonical full-record authorization fixes it. The subsequent affected suite passes. SQLite covers revision-change compensation deterministically; concurrent MySQL gap-lock behavior and live DDL are not accepted by this suite.
- **Pint passes 18 touched PHP files**, fixing only two formatting issues. Node syntax checks pass for live/runtime/attachment verifiers. No frontend application source changed; the accepted 49-file/293-test frontend and deployed image 1626d714 remain current, with no rebuild pending.

The [pre-migration evidence](evidence/attachment-policy-runtime-2026-10-08.json) preserves the earlier inventory. The [initial activation evidence](evidence/attachment-policy-activation-runtime-2026-10-08.json) verifies exactly two nullable JSON/char(64) additions and one migration record, with all earlier columns/migrations unchanged. At that migration acceptance, settings were 4/4, limits 10/5 MiB, audits 5/6/protected/other-setting fingerprints unchanged, and medical/jobs zero, with scanning disabled/local storage and DB/Redis healthy. No backfill/seed/worker/retry/Compose/build/install ran in that slice. Later accepted API writes and user-run backend recovery supersede its zero-record/container state; [current post-API evidence](evidence/attachment-policy-post-api-runtime-2026-10-08.json) preserves the same schema/settings/audits plus one synthetic request/file and zero reports/jobs.

## Activation Boundary And Next Work

Source and live schema are ready, and ordinary synthetic request/upload API acceptance is now complete. The issued policy is retained on the one open request; legacy missing policies remain explicit and cannot accept new uploads. Historical clean reads retain their safeguards; the new synthetic file is quarantined and cannot be read through doctor/patient download endpoints. No conversion/backfill occurred.

After explicit live approval, pending status, read-only baseline and SQL review confirmed the exact scope. The SQL preview contained only the two nullable additions. The exact command below completed in 405.15 ms and recorded **batch 3**. No blanket migrate/reset/reseed/backfill ran; do not rerun this completed migration:

```powershell
Set-Location C:\Users\Pain\Desktop\work\checkupino
docker exec --user www-data checkupino_app php artisan migrate --pretend --path=database/migrations/2026_10_08_000000_add_attachment_policy_to_medical_requests.php
# Executed after explicit live approval and SQL/runtime review:
docker exec --user www-data checkupino_app php artisan migrate --path=database/migrations/2026_10_08_000000_add_attachment_policy_to_medical_requests.php --force
```

Use `node scripts/media/verify-attachment-policy.mjs --activated --after-api` and `node scripts/media/verify-attachment-api.mjs --verify-existing` for current read-only schema/state/integrity checks. Default pre-migration and initial `--activated` zero-record modes are historical and will reject current counts. Live API acceptance is established by its separate actual HTTP evidence; medical UI/content/scanner/worker acceptance remains open.

## Rollback Compatibility

Prefer reverting application changes while **retaining the two nullable columns and all policy/audit history**. The columns have no new constraints on the old field set. Disposable SQLite verifies old-column insert/read/update against the expanded schema and verifies that legacy policy absence remains explicit. This establishes SQL compatibility, not a full old-release deployment acceptance.

Before running application code without attachment-rule enforcement, pause medical request creation and uploads at the gateway and drain in-flight operations. Earlier upload code could apply only global limits and ignore a narrower issued request; retaining columns alone does not make that behavior acceptable. Resume writes only after enforcement is restored. Do not reset or clean the dirty worktree as a rollback method; prepare a scoped code change against the exact deployed version.

The migration's `down()` checks all request rows, including soft-deleted rows, and refuses if **either** policy column contains data. The accepted synthetic request now contains policy data, so retain the columns; the schema-removal command below is presently blocked by design. Never clear fields/delete records to bypass the guard. Schema removal is only a separately requested operation with quiesced writers and confirmed absent policy data; the guard is not a concurrent-writer lock. No live rollback or column drop was executed.

Focused rollback/legacy compatibility and migration lifecycle verification passes **24 tests / 134 assertions**, 11.729 seconds, 54.50 MiB, as www-data/testing/SQLite `:memory:` with isolated storage and array cache/session; Pint passes the two changed PHP files. These tests include safe nullable legacy round trip and refusal to discard either column on archived policy records. The earlier 129/716 source gate remains historical; it was not unnecessarily repeated. [Exact migration execution and rollback scope](evidence/attachment-policy-migration-execution-2026-10-08.json) records the command/result without credentials.

If schema removal is later explicitly requested after quiescing writers and confirming both fields are empty, the recorded batch is 3 and Laravel supports the exact scoped rollback below. This is a recovery command only; it has **not** been run. Recheck the recorded migration/batch before use and preserve a recovery copy of schema/history. Prefer retaining the columns whenever reverting application code:

```powershell
docker exec --user www-data checkupino_app php artisan migrate:rollback --batch=3 --path=database/migrations/2026_10_08_000000_add_attachment_policy_to_medical_requests.php --force
```

Multipart transport, complete-file content checks, quotas/throttling/concurrency, real scanner/worker acceptance, retained bilingual Velzon File Manager integration, questionnaire and final rehearsal remain open. Keep 10/12 MiB transport and disabled scanning/local storage. Scanner definition access remains blocked by the recorded official HTTP 403; preserve the October 8 20:37:34 Tehran cooldown and do not retry automatically.
