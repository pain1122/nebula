# Medical Upload Admission

October 8, 2026, Asia/Tehran. This slice adds configurable admission safeguards to the existing bounded medical upload path. It follows the accepted attachment API and isolated content-parser slices. It adds no dependency, schema change, endpoint, panel surface or large-file transport activation.

## Behavior and operator controls

The patient attachment POST has separate authenticated-user and IP request limits. Failed validation attempts also consume the request allowance. The service checks account and request file-count/byte allowances before private storage. Account capacity belongs to the reservation's patient, including uploads performed by an assigned doctor through existing internal service paths. Other patients have separate capacity. Existing per-file settings and immutable issued attachment rules remain independent constraints.

`config/medical_uploads.php` and `.env.example` document these operator controls. The live `.env` was not edited; defaults are visible through the development bind mount. No quota-management panel is added.

| Variable | Default | Accepted bounds |
| --- | --- | --- |
| `MEDICAL_UPLOAD_ACCOUNT_MAX_FILES` | 100 | 1–10,000 |
| `MEDICAL_UPLOAD_ACCOUNT_MAX_BYTES` | 104,857,600 (100 MiB) | 1 byte–1 TiB |
| `MEDICAL_UPLOAD_REQUEST_MAX_FILES` | 10 | 1–10,000 |
| `MEDICAL_UPLOAD_REQUEST_MAX_BYTES` | 26,214,400 (25 MiB) | 1 byte–1 TiB |
| `MEDICAL_UPLOAD_REQUESTS_PER_USER_PER_MINUTE` | 10 | 1–1,000 |
| `MEDICAL_UPLOAD_REQUESTS_PER_IP_PER_MINUTE` | 30 | 1–10,000 |
| `MEDICAL_UPLOAD_CONCURRENT_UPLOADS` | 4 | 1–16 |
| `MEDICAL_UPLOAD_LEASE_SECONDS` | 120 | 30–300 seconds |
| `MEDICAL_UPLOAD_GUARD_CACHE_STORE` | `database` | Configured shared database/Redis store; array only in testing |

Only canonical positive integers are accepted. Unknown/missing policy keys, invalid bounds and unsuitable lock stores fail closed. These configuration bounds do not establish accepted runtime capacity: deployed files/bodies remain 10/12 MiB and no video/ZIP type is enabled. Lowering admission quotas blocks new uploads without rewriting issued rules, historical files or authorized historical reads. Changes to shared store/slot topology require quiescing admissions and waiting for outstanding leases; this slice does not provide live distributed policy revision propagation.

## Transactions, leases and safe failures

`MedicalUploadAdmission` acquires one owner-aware shared account lock and one of the bounded shared slots, without waiting for a busy slot. It then locks the existing patient row and performs a locking read of private medical file metadata across that account's reservations. Archived and expired rows conservatively continue consuming capacity until a durable audited disposal/accounting mechanism exists. Count/byte boundaries are exact and arithmetic checks avoid overflow.

Storage, file metadata, existing audit and optional encrypted scan-job dispatch run inside the admission transaction. Rules, lease ownership/deadlines, account ownership and quotas are checked again before commit. A post-write failure rolls back database facts and compensates the newly staged blob. Existing audit/storage failure behavior is retained. Lease release is owner-aware; cleanup-reporting failures cannot turn an already committed upload into an apparent failure. No force-release, cache clearing or unrelated-key cleanup is used.

Busy account/slot and HTTP rate limits return the existing safe 429 envelope with `Retry-After`. Quota exhaustion returns the existing generic 422 domain error. Invalid admission configuration at the HTTP limiter returns a safe 503 `upload_unavailable` response. Lock-backend errors fail closed with a generic admission error. Responses contain no owner IDs, filesystem paths or backend exception text.

The shared locks follow [Laravel 12 atomic-lock ownership requirements](https://laravel.com/docs/12.x/cache#atomic-locks); endpoint limits use [Laravel 12 rate limiting](https://laravel.com/docs/12.x/rate-limiting). The bounded, authorized upload approach follows the [OWASP File Upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). These references support the implementation choices; no independent human expert review or compliance certification is claimed.

## Verification

The existing user-built isolated image is unchanged: `sha256:a48b0c0b60fc1e5b59685dd0d6a6fece0aec8119b9b5f854dbd1f3f2497b3094` (PHP 8.3.35, qpdf 12.4.2, GD JPEG/PNG and prlimit). The expanded network-disabled, read-only, UID-33, resource-bounded SQLite gate passes **206 tests / 1,079 assertions**, no skips, in **55.061 seconds**, peak **64.50 MiB**. This includes the existing real-parser, scan/audit/integrity, request/report and policy regression files plus 27 new admission/API cases. Touched PHP formatting passes seven files.

New coverage includes exact count/byte boundaries, owner-wide capacity across reservations and doctor uploads, independent request allowances, archived/expired accounting, account/slot contention, ownership-safe release, quota/rules/lease failure compensation, storage/audit/job rollback, backend/configuration rejection, release-reporting failure, user/IP HTTP throttling, expiry and safe status/envelope behavior.

The existing shared database lock backend passes a two-process synthetic probe: a contender cannot acquire or release the owner's lock, ownership remains valid, reuse succeeds after owner release, and the exact temporary key has zero remaining rows. This is shared-lock acceptance, not concurrent live upload/transaction acceptance. The probe uses only a random `medical-upload:acceptance:` key and never writes clinical/settings/queue records.

Readonly existing-attachment verification also passes: one open request and one exact 1 MiB quarantined/unscanned file remain, zero reports/jobs, and protected accounts, booking/payment/outbox/settings, integrity and retained audit fingerprints are unchanged. Nine required services run; scanner/check remain stopped. Live app/worker image pins still lack qpdf/GD. Scanning stays false and private storage stays local. The recorded ClamAV cooldown has elapsed; successful official definition access is still unestablished and no retry ran.

Evidence: [source/test manifest](evidence/upload-admission-source-2026-10-08.json), [shared-lock runtime probe](evidence/upload-admission-runtime-2026-10-08.json). Earlier [content-validation evidence](medical-content-validation-2026-10-08.md) remains a historical checkpoint; this gate covers the subsequent service/provider/test-runner changes.

Repeat without clinical writes from `C:\Users\Pain\Desktop\work\checkupino`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-content-parser.ps1
node scripts/media/verify-upload-admission.mjs
node scripts/media/verify-attachment-api.mjs --verify-existing
```

The first command uses the already-built isolated image, no network/live database or worker. Execution-policy bypass applies only to that child process. The admission verifier is read-only by default; its explicit `--probe-shared-lock` option repeats only the temporary synthetic lock operation and records evidence.

## Remaining acceptance and rollback

- Accept actual multi-process MySQL upload races, shared-slot peak load and latency separately. SQLite tests and the database-lock probe do not prove these workloads.
- A slot lease bounds admitted transactional work and fences commit after expiry/ownership loss. It does not terminate stalled storage I/O after lease expiry or provide a hard OS process bound. Scan/download read concurrency remains open.
- The current short, at-most-10-MiB storage write holds the patient-row transaction. Future large-file multipart needs durable session/part capacity reservations, expiry/abort/in-flight cleanup and checksum completion; do not hold this transaction throughout a large video transfer.
- HTTP throttling runs after PHP receives/spools multipart bodies. It cannot prevent initial network/body spool usage. Large-file preflight, transport/spool capacity and direct private multipart are separate work.
- Crash recovery and durable orphan/disposal accounting remain open. Compensation only addresses the newly staged file during a handled failure; a storage delete failure or process crash requires targeted reconciliation.
- Accept parser runtime activation/isolation, metadata/previews, targeted recovery, supported scanner definition access and dedicated worker execution before the complete medical flow. No general worker, implicit requeue, retrospective clean status or freshness bypass.

No migration or data conversion is needed for this slice. Rollback must preserve the stronger content-release gate, issued policy/audit history and existing quarantine. Do not roll back to code that admits unrestricted writes: if the admission implementation must be withdrawn, pause new uploads until equivalent safeguards are available. Do not clear global caches or remove another process's lease.
