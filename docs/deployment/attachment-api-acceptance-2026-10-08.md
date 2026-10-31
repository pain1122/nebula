# Synthetic Attachment API Acceptance

October 8, 2026, Asia/Tehran. The next approved golden-flow slice is accepted through ordinary session-cookie/CSRF HTTP APIs: assigned doctor creates a bounded medical request; its patient uploads one synthetic private file that remains quarantined. This does not accept File Manager/form UI, content parsing, real scanning/worker delivery or the full medical flow.

## Container Recovery And Readiness

Read-only inspection initially found app/Nginx/MySQL/Redis stopped with exit 0, no OOM and zero restarts. Scanner retained its recorded exit 17/zero restarts; scan-check was also stopped, exit 131. The stopping cause is unestablished. Static admin and four SeaweedFS services were running. No stale unrelated container targets were found or removed.

The user completed the existing-service recovery command, preserving images/volumes:

```powershell
docker compose --project-name checkupino --file docker-compose.yml start db redis app nginx
```

Afterward, nine required services run: four backend, static admin and four media. Admin remains healthy on image 1626d714; app remains pinned to 18eb9257. Backend `/up` and admin `/healthz` return 200, guest auth returns 401, and www-data MySQL/Redis and approved two-column schema checks pass. Scanner and scan-check remain stopped; no worker/retry/definition access was attempted. Preserve the October 8 20:37:34 Tehran cooldown and freshness guards. Media running state is not new S3 functional acceptance.

## Accepted Ordinary API Flow

[Raw API/checkpoint evidence](evidence/attachment-api-live-2026-10-08.json), run `checkupino-attachment-1791459868753`, final verification October 8 at 15:15:29 Tehran. Seven grouped checks pass. Native HTTP requests use the actual session cookies, Sanctum CSRF cookie, ordinary login, matching Origin/Referer and X-XSRF-TOKEN. Password/cookie/token values stay in memory and are excluded from evidence. No bearer token, impersonation, database mutation or mocked response supplies authority. This API harness does not establish browser CORS/preflight or UI acceptance.

Use the existing paid/confirmed reservation **8**, patient account **4**, assigned doctor account **5**. Its October 11 08:00 Tehran visit remains future and uncompleted. Unassigned doctor account **3** supplies negative controls; protected accounts 7/8 are never logged in or modified. The baseline contains zero medical records/jobs, settings 4/4 and restored medical/public defaults 10/5 MiB.

- Patient attempt to create a doctor request returns 403; unassigned doctor create returns 404; assigned-doctor unsupported MP4 rule returns 422. No medical request or audit is persisted for these rejects.
- Assigned doctor POST creates request `01m4dn9fq2d38xxrh4wtkyf6s4`, open/retained, **PDF only, exactly 1,048,576-byte limit**. It stores the immutable server-owned snapshot and issued revision; critical audit **7** records the ordinary doctor route/actor and safe policy revision. No clinical content is included in the audit.
- Patient discovery returns that effective field policy/revision. Unassigned doctor read and wrong reservation/role uploads return 404; forged `scan_status: clean`, PNG content and a PDF of **1,048,577 bytes** return 422. Counts/audit checks confirm no file or job for these rejects.
- Patient POST of an actual synthetic PDF of **1,048,576 bytes** returns 201 and `available: false`. Its text says there is no patient data; the remaining bytes are an unused padding stream with valid PDF object/xref offsets. File `01M4DN9XK0Z7CKQ2GFBHSACA6H` is stored once in private quarantine. Actual SHA-256, exact bytes, canonical filename/path metadata and captured private-byte integrity verify; ownership/reservation/request and retention match server records.
- High-risk upload audit **8** belongs to patient 4 and records matching issued/effective policy revisions. File resource omits storage paths/disk/original filename/checksum/scan state/owner internals. No manually supplied clean state is accepted.
- Doctor detail lists no eligible files. Direct doctor download returns 422; patient download and unpublished outcome return 404. File remains `quarantined`, `scanned_at: null`; request remains open. No review/publication/completion/report or clean verdict occurs.
- All POSTs carry CSRF. Each account's logout is acknowledged with 200, then `/api/auth/me` returns 401. Booking/payment/provider-event/outbox, protected-account, settings and earlier audits 5/6 fingerprints are unchanged. Final counts: **one medical request, one file, zero reports/jobs**, settings/definitions 4/4. Scanning remains disabled and private storage local, so no scan job is enqueued and no later processing is claimed.

The 201 upload request takes approximately **2,445 ms** in this local run, including HTTP/service/storage work. This is not isolated transfer time or a latency guarantee; there is no queue/scan timing measurement while scanning is disabled. Full multipart/upload/checking progress and timing acceptance remain open.

## Reverification And Retained History

The helper `scripts/media/verify-attachment-api.mjs` refuses a fresh run when evidence already exists and records checkpoints after accepted writes. Do not delete evidence or create duplicate requests/uploads to repeat acceptance. Read-only continuation passes against the same objects, checksums, policy/audit history and current container state:

```powershell
node scripts/media/verify-attachment-api.mjs --verify-existing
node scripts/media/verify-attachment-policy.mjs --activated --after-api
```

The second command saves separate [post-API schema/runtime evidence](evidence/attachment-policy-post-api-runtime-2026-10-08.json). Earlier zero-medical pre-migration/activation/settings/runtime evidence remains historical. `verify-attachment-policy.mjs --activated` without `--after-api`, and the old upload-policy runtime helper, assert that historical zero-record baseline; they must not be run as current-state checks. No records/audits/blobs are deleted to recreate earlier counts.

No production application/frontend code changed for this acceptance. Node syntax and diff checks pass; source tests remain the accepted 129/716 with rollback follow-up 24/134, and frontend 49/293/admin build unchanged. No unnecessary test/build rerun, assistant Compose/build/install, live migration/backfill/reset/reseed, credential replacement or unrelated project action occurred.

## Next Bounded Work

Continue supported PDF/image content validation, encrypted/malformed-file handling and metadata/preview policy, with upload throttling/quotas/concurrency before UI exposure. Keep MIME/byte/ownership/integrity/freshness/audit and quarantine safeguards. Existing fixtures may be read for later acceptance but cannot be retrospectively declared parsed/scanned/clean.

Resumable SeaweedFS/AWS multipart and session/resume/abort/in-flight cleanup, actual scanner/worker acceptance, retained bilingual Velzon File Manager and doctor/patient form wiring, review/publication/outcome, questionnaire and final rehearsal remain open. Preserve 10/12 MiB transport, local private storage and disabled scanning; large-video/ZIP configuration fixtures do not accept actual large-file transport/content/capacity. Rollback retains issued policy/audit history; schema `down()` now refuses while this request contains a policy. See [migration/rollback acceptance](medical-attachment-policy-2026-10-08.md).
