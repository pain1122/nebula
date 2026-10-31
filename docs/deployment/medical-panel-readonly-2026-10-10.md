# Read-only role-specific medical File Manager

October 10, 2026, Asia/Tehran. The operator explicitly approved both canonical medical routes and the first read-only retained File Manager composition. Source, operator admin-only rebuild and actual served/browser read-only acceptance now pass. [Current deployed evidence/next slice](medical-panel-deployed-2026-10-10.md) supersedes pending deployment statements below while preserving this source checkpoint.

## Delivered source

The existing manifest/registry adds lazy patient `my/reservations/:reservationId/medical` and doctor `doctor/reservations/:reservationId/medical`, each restricted to its own role. Existing reservation tables link to the corresponding route through their Actions cell; patient sandbox checkout remains present. Existing panel basename/navigation and role fallbacks remain intact; generic admins/root gain no medical access. Breadcrumb returns to the respective reservation list.

`frontend/src/pages/Medical/MedicalFiles.tsx` connects the four existing safe GET queries. The retained File Manager sidebar selects issued requests, its responsive content table displays only server-eligible files and its detail surface shows doctor drafts/published reports or patient published history as escaped plain text. Mobile sidebar/detail close controls use existing Velzon/Bootstrap classes. There is no fake folder CRUD, storage usage/chart, sharing, preview, rename/delete, upload, download or publication action in this read-only slice. The original root toolbox File Manager remains intact.

Available attachment rules show exact server-owned per-MIME bytes; unavailable policy has an honest blocking message and no invented limit. Open patient requests show a pending-outcome message; no pending-file list/status is fabricated. Backend publication/ownership remains authoritative. Patient results reject non-completed/draft/cross-request or mismatched history, files with `available=false` are omitted, and wrong-reservation/detail responses are not displayed. Selection/overlay state remounts across reservation URLs; currentData/fresh subscriptions and hiding while fetching/error prevent the previous request/report from leaking into a new context or failed refresh. The existing shared identity/role cache reset includes medical queries.

`medical.scss` is an import-only lazy loader for the **unchanged** retained File Manager rules and existing Sass variables; it defines no new CSS/RTL overrides and does not import the entire toolbox stylesheet. Sass source compilation emits2,812 CSS bytes. Actual emitted-bundle/loading behavior remains a deployment check, not inferred runtime acceptance.

## Verification

TypeScript and full Vitest pass **51 files/321 tests**. Thirteen new File Manager cases cover bilingual requests/exact bytes, role entry, safe/draft/published separation, escaping, unavailable rules, cross-request/reservation transitions and refresh failure. Eight new canonical-router cases cover authorized deep-link refresh and guest/admin/root/cross-role denial; one actual shared-store test adds patient-change/logout medical-cache clearing. Existing booking/sandbox tests pass; focused first UI/registry/booking gate passes3 files/32 tests before the additional router/cache cases.

Final governed lint, supplemental page/entry/registry lint, fixtures, unchanged quality ratchets and formatting pass. The initial test harness accidentally returned its mock as a beforeEach cleanup; corrected without changing assertions/deadlines. The prior exact-router expectation was updated for the approved new paths. Supplemental lint required semantic request buttons and a file-cell accessible label; fixed. One unused test import was removed after the final full321-test run; lint/fixtures/ratchets/format then all pass. No dependency, test deadline, lint policy or retained editor change. Known existing browser-data/Tailwind/jsdom warnings persist.

Source hashes/evidence: [read-only source gate](evidence/medical-panel-readonly-2026-10-10.json). No source tests substitute for deployed browser acceptance. No backend medical rule/env/schema/clinical write, worker, scanner retry, image build or Compose operation occurs in this source slice.

## Operator deployment

From `C:\Users\Pain\Desktop\work\checkupino`, update only the static admin:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Admin Compose configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml build admin
if ($LASTEXITCODE -ne 0) { throw 'Admin build failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Admin recreation failed.' }
Write-Host 'PASS: admin-only rebuild/recreation completed.'
```

Verify actual image/served chunks, lazy File Manager CSS, HTTP/deep-link refresh/missing assets and the ordinary role/bilingual browser. Existing reservation8 patient4/assigned doctor5 has one open request/quarantined file and no report: patient shows issued1 MiB PDF rules/pending outcome; doctor sees the request/empty eligible-file list. Do not invent published/clean rows to populate the screen. Use synthetic mocks only for report/history source tests; live publication follows the ordinary flow later. Protected patients7/8 stay untouched.

## Rollback

Before this rebuild, admin image is `sha256:1626d714ad5cdc4e3d40259c640a50a731cbfc864b915185f9359a2111136247`. Keep it available. If this deployment fails, operator can temporarily set `CHECKUPINO_ADMIN_IMAGE` to that exact installed image for the same admin-only config/up command with no build/pull/deps, then remove only that temporary variable; do not overwrite a pre-existing variable. No database, volume or credential rollback is involved. Keep the accepted source recoverable for correction.

The operator's [golden-flow recalibration](demo-golden-flow-recalibration-2026-10-10.md) makes ordinary write/scan/review/report/questionnaire/rehearsal the next priority and parks deeper large-file/production media work without relaxing existing safeguards.
