# Doctor medical request controls

**Latest:** operator explicitly authorizes the assistant to run the posted admin-only rebuild; deployment/ordinary synthetic issuance is accepted in [medical-request-deployed-2026-10-10.md](medical-request-deployed-2026-10-10.md). Current checkpoint is two requests/one quarantined file/zero jobs-reports. Prior read-only image digest356a4aae no longer resolves locally; its source rollback requires an admin rebuild and retains all data. Current accepted image has a separate retention tag for future rebuilds. The source-only/pending/old-image-availability statements below preserve the earlier checkpoint and are superseded for this accepted deployment.

October10,2026, Asia/Tehran. The operator explicitly approved all remaining medical controls in [the concrete proposal](medical-golden-controls-proposal-2026-10-10.md). This is the first small source slice under that approval; existing URLs and original File Manager remain intact.

## Delivered source

`frontend/src/pages/Medical/DoctorRequestModal.tsx` adds the ordinary assigned-doctor request modal. `MedicalFiles.tsx` supplies New request in the existing content toolbar and as the empty-request action. Both English and Farsi labels, including the modal close control, use the existing locale. No stylesheet, URL, dependency, schema or backend change.

The form submits a fixed document request/PDF MIME with title, optional plain-text instructions and an editable integer limit from1 to1,048,576 bytes. This is the approved bounded demonstration form; the configurable server foundation remains authoritative. Assignment/list access is reread immediately before the ordinary POST. A failed or wrong-reservation read prevents delivery. No client-owned policy/revision/owner/status/audit/scan facts are submitted. Successful responses must match the reservation before selecting the issued request; server-returned current rules render through the existing safe list.

The ref guard disables rapid duplicate submissions across preflight and delivery. Definite422 validation failure remains editable; the next explicit attempt performs a fresh read again, without widening limits. Other failed or wrong-context acknowledgements block another submission even after closing/reopening the dialog. Only an explicit successful matching-reservation list refresh releases that block; the user must inspect the list before deciding to create another request. No automatic replay or fabricated receipt. Navigating away before preflight completes prevents POST; an in-flight mutation is aborted on unmount, which does not imply a server rollback.

This modal is mounted outside the request list so ordinary refetch/success invalidation cannot discard it while a write is pending. Patient pages expose no doctor request action. Existing read-only role/currentData/scope/publication/hide-on-error checks remain intact.

## Verification

[Sanitized source/runtime evidence and source hashes](evidence/medical-request-controls-source-2026-10-10.json) preserve the accepted read-only deployment record separately.

Full frontend quality passes **52 files/340 tests**, including twelve new request-control cases in the actual shared-session store/transport harness. Final focused medical view gate passes25 tests after semantic accessibility correction; final TypeScript, supplemental page/test lint and formatting pass. Fixtures remain1 valid/6 rejected; ratchets remain2515 textual any occurrences/10 ambient/40 legacy Apex/0 undeclared after removing a test-description-only token, no added type escape. The known installed browser-data/Tailwind/jsdom warnings are unchanged; no dependency update.

Coverage: EN/FA first request from empty view, exact smaller server-returned limits and whitelisted POST, oversized/fractional/zero limits, changed access/wrong reservation before POST, current-policy422, uncertain delivery/reopen/manual refresh/no replay, double submit/unmount before delivery, in-flight abort, mismatched acknowledgement/no receipt. The previously accepted read-only UI cases also pass.

Read-only container sanity and `node scripts/media/verify-attachment-api.mjs --verify-existing --scanner-ready` pass. Twelve required services run; admin and scanner are healthy, no worker. One existing open request/quarantined-unscanned1MiB synthetic file and zero jobs/reports, scanningfalse/private local, historical integrity/audits/protected accounts/settings/booking/payment/outbox remain unchanged. No clinical POST, build, Compose, live migration, environment or credential change by the assistant.

## Operator deployment

Run from `C:\Users\Pain\Desktop\work\checkupino`:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Admin Compose configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml build admin
if ($LASTEXITCODE -ne 0) { throw 'Admin build failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Admin recreation failed.' }
Write-Host 'PASS: medical request admin rebuild/recreation completed.'
```

The operator reserves builds/Compose. This changes only static admin and starts no backend/scanner/worker. After their result, verify emitted assets/retained read-only authority and actual synthetic doctor modal/ordinary request issuance without replaying existing evidence or changing the existing request. Source tests do not establish deployed POST/browser acceptance. The old pre-write browser verifier deliberately guards the one-request checkpoint: do not run it unchanged after creating a second request.

## Rollback and next slice

The accepted read-only admin image `sha256:356a4aae37878f9433f7bcd6be8ec6c42d27ab020b85c86d1247db0782a9f4e9` remains available. A rollback uses only an operator admin override/recreation with that exact image and `--no-build --pull never`; prepare/verify the concrete override if needed. Source rollback removes only the request modal/import/actions and preserves the underlying read/write adapters and prior read-only layout. No files/requests/policies/audits/reports/volumes are deleted. If a request was issued, retain it and its history.

Next approved work is owner-only aggregate receipt/checking progress plus fresh issued-rule upload UI; then eligible download/review and plain-text draft/publication/history. These controls need no repeated UX approval. Dedicated bounded medical worker/activation, ordinary complete pipeline, questionnaire and final rehearsal remain open, with MondayOct12 priority and deeper video/ZIP/multipart/peak/update-aging/crash-orphan/SEO work deferred. Main scanningfalse and no worker remain intentional until their separate runtime acceptance.
