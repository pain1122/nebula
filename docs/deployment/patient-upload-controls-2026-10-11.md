# Patient upload and receipt progress

October 11, 2026, Asia/Tehran. Approved medical golden-flow control slice on the existing patient/doctor File Manager routes. No new URL, dependency, schema, stylesheet or upload-policy setting.

## Behavior and verification

The patient request list adds optional `upload_progress` with only `received_count` and `awaiting_checks_count`. Counts are bound to the authenticated owner, request and reservation, private medical classification, non-deleted records and current retention. Quarantined files count as awaiting checks; no unsafe file identities, paths, scan details, active-processing claim or eligibility verdict is exposed. Doctor resources omit this field. Earlier resources remain compatible because the frontend accepts its absence.

The retained toolbar opens a bilingual patient upload modal for open requests with available rules. It accepts a non-empty PDF within the actual issued/current limit, capped at the existing 1 MiB demo bound. A fresh authorized request read immediately precedes sending. Changed revisions/rules or inaccessible/closed requests stop the POST and show updated requirements. Ordinary multipart sends only File/optional label; server content, ownership, policy, audit, quota and scan authority are unchanged.

Reception is separate from checking and eligibility. The modal stays mounted during the preflight/list refresh; duplicate submissions are guarded, page unmount aborts the browser request, and ambiguous delivery blocks another upload across modal close/reopen until an explicit matching receipt refresh. No automatic retry. A browser abort cannot undo a server commit. A successful upload is never represented as a clean or downloadable file.

Source checks pass: full frontend **52 files / 361 tests**, focused medical/editor **47 tests**, TypeScript, governed/supplemental lint, fixtures, formatting and unchanged ratchets **2515/10/40/0**. The first full run hit the unchanged editor timeout; focused and later full gates pass. Two new test-selector failures were corrected without a product workaround. Isolated UID33/network-none/read-only-source/tmpfs SQLite progress tests pass **4 tests / 55 assertions**; empty environment path and config guard run before schema setup. The composite database key prevents reservation/request mismatches; the initial test fixture attempted an invalid pair and was corrected. Three touched PHP files pass Pint.

The live UID33 **read-only controller/resource** check passes: original request has one receipt/one pending check, the new 512 KiB request has zero/zero; assigned-doctor progress is absent and the wrong owner receives404. No HTTP authentication/upload, audit or queue write is implied. Existing two-request/file/policy/history/protected checkpoint passes unchanged. [Runtime proof](evidence/patient-upload-progress-runtime-2026-10-11.json).

## Deployment and actual browser acceptance

Admin artifact deployment/browser verification is accepted: assistant runs the same delegated config/build/recreate sequence, dependency layers are cached, and Vite builds in 5.55 seconds. Healthy image `c33f9e73` serves 21 byte-matched assets; entry `index-BvhhAlN_.js`, page `MedicalFiles-z4n245Mm.js` and unchanged lazy CSS `MedicalFiles-CR21OHT8.css`. Eleven actual browser groups pass, including EN/FA receipt/check counts, exact-limit modal, in-memory synthetic oversize refusal without a medical POST, cancellation, mobile/refresh, assigned/opposite roles and preserved table/protected fingerprints. The first static probe correctly refused Docker's temporary starting state; acceptance followed ordinary healthy readiness without a service change. The user's earlier “run them yourself” delegates this same static-admin sequence within the approved medical controls; it does not delegate backend/scanner/worker activation or unrelated installs.

```powershell
Set-Location 'C:\Users\Pain\Desktop\work\checkupino'
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Admin Compose configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml build admin
if ($LASTEXITCODE -ne 0) { throw 'Admin build failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Admin recreation failed.' }
```

The accepted optional commands are `node scripts/media/verify-patient-upload-static.mjs`, then `node scripts/media/verify-patient-upload-browser.mjs`. The browser permits only ordinary login/logout writes and refuses medical POSTs; it cannot accept a successful upload/pipeline. New evidence paths preserve the older request proofs. Full success delivery is reserved for a fresh bounded PDF after dedicated-worker/producer activation is separately prepared and accepted; main scanning remains false today. [Source/deployment completion](evidence/patient-upload-controls-2026-10-11.json), [served assets](evidence/patient-upload-static-2026-10-11.json), [actual browser groups](evidence/patient-upload-browser-2026-10-11.json). The older request completion checker still verifies all medical/audit history against its original accepted proof; its printed image is historical and does not describe the new admin artifact.

Repeat isolated source checks with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-patient-upload-progress.ps1`. Repeat the current two-request controller proof with `node scripts/media/verify-patient-upload-progress.mjs`; it refuses arguments and writes only its current read-only JSON evidence. These checkpoint guards intentionally need revision after authorized clinical state changes; never weaken or replay older write/one-request harnesses.

## Rollback and next step

The prior accepted doctor-request artifact is retained under `checkupino-admin:medical-request-accepted-2026-10-10`; current upload controls are retained under `checkupino-admin:patient-upload-accepted-2026-10-11` (verified image `c33f9e73`). Removing only new upload/modal/progress source and rebuilding is also compatible. The aggregate field is additive/optional; no columns, original files, issued policy revisions or audit/history rows are removed. Preserve stronger backend release safeguards and pause processing if a rollback cannot enforce them.

Next: eligible download/review, plain-text draft/publication/history controls; then dedicated bounded medical-scan producer/socket/worker activation and ordinary successful pipeline; one questionnaire and final bilingual rehearsal. Large/video/ZIP/multipart and deeper media remain deferred. No worker, real patient file, manual verdict or booking completion is authorized by this control deployment.
