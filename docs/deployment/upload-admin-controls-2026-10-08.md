# Upload Admin Controls

October 8, 2026, Asia/Tehran. This slice connects saved root-admin size limits to existing uploads and implements the user-approved `/panel/upload-limits` surface. Source, static-admin delivery, served artifacts, real-browser read/negative controls and now ordinary live audited save/reset pass. Medical/public defaults are restored to 10/5 MiB; the new medical setting definition/value and both audits remain intact. Attachment-rule persistence, multipart/content/scanner/worker remain open.

## Backend Contract

Known setting keys are `uploads.medical` and `uploads.public_media`, scoped only to platform `marketplace`. Existing `PUT /api/admin/settings/{settingKey}` retains active-account/root authority, recent-password confirmation, required reason and a high-risk before/after audit. A root-only `GET` on the same setting path provides the two upload policies' current override value, effective default/type sizes, configured fallback default, allowed MIME types and operator/scanner ceilings. Unsupported keys have no read model. Reads never provision definitions or values and contain no storage credentials/paths or patient data.

An override is a JSON object with optional `max_bytes` and `type_limits` fields:

```json
{
  "scope_type": "platform",
  "scope_key": "marketplace",
  "value": {
    "max_bytes": 10485760,
    "type_limits": { "application/pdf": 1048576 }
  },
  "reason": "Document upload policy reviewed",
  "expected_revision": "<64-character revision from the preceding GET>"
}
```

All sizes must be positive integer whole-file bytes. Reject unknown fields/types, numeric strings, booleans/floats, other scopes and limits exceeding configured capacity. Medical sizes also cannot exceed the configured scanner stream bound. MIME authority, scanner freshness/security, operator capacity, ownership and scan requirement are not writable settings. Current formats remain medical PDF/JPEG/PNG and public JPEG/PNG/WebP.

The GET includes `revision`, `policy_state` and normalized `type_limit_overrides`. Upload PUT requires the GET's revision; other existing settings retain their contract. The revision binds the stored override/presence, section and format configuration, operator capacity and applicable scanner capacity. Check before validation and again under the definition/value lock. A mismatch returns the existing structured 422 `expected_revision` validation error without persistence/audit. This prevents overwriting another admin's changes or saving an old form after deployment policy changes. The page requires explicit reload/review; password confirmation retries the same reviewed revision.

Each saved value replaces the previous override object. Omitted fields inherit operator config; a supplied `type_limits` map replaces that config map. An empty `value` array (`[]`, consistent with the existing array-valued setting API) resets overrides to operator config with the same reason/password/audit requirements. Reads validate stored values again; invalid stored policies fail closed instead of falling back to looser limits. Limits describe configured ceilings, not proof of larger-file engine/transport acceptance.

If saved overrides become invalid after a capacity/type change, root-admin GET returns `policy_state: review_required` with an explicit repair suggestion at current capacity. Upload resolution continues to reject the stored policy, including an invalid null value; the suggestion is never an upload fallback or automatically applied. An admin must review/save a valid correction with a reason. Reset still validates deployment defaults, so invalid deployment defaults require operator correction. Structurally invalid operator configuration also requires operator repair.

Only the two known upload keys may provision their missing definition during a validated, authorized setting write. Definition creation, value and audit share one transaction, so audit failure rolls back all three. Existing definitions are not reseeded or rewritten; this setting path needs no migration. The successful live acceptance below exercises that ordinary first write and retains its medical definition/value/audits after reset.

`UploadPolicySettings` resolves the persisted policy for medical request validation and private/public upload services. `FileUploadPolicy` keeps pure config/override/field validation separate from database access. Verified historical downloads still use operator snapshot capacity and existing clean/ownership/integrity safeguards, not the limit for new uploads.

## Approved Panel Source

The user approved **`/panel/upload-limits`**, root-admin only, with **Upload limits** in Product Admin after Users on October 8, and requested continued viability when policy shifts. The named AI_BOOT path/navigation/composition gate is satisfied. The implemented page preserves the inert System slot and lazy Developer Toolbox, Velzon container/breadcrumb/Card/form components, cookie transport, session-owned query cache, validation feedback and recent-password dialog. No dependencies or stylesheets changed.

The page has **Medical files** and **Public images** cards with a section default, optional overrides for every backend-allowed MIME type, read-only operator/scanner ceilings and configured default, required reason, **Save limits** and **Reset to deployment defaults**. Blank type inputs inherit the section default. Byte/MiB inputs convert with integer arithmetic, accept Persian/Arabic digits and reject fractional-byte rounding and unsafe numeric overflow. Overrides can differ from the section default within capacity. Writes bypass Redux/password storage, retain CSRF and refresh the authoritative model after success. A failed post-save refresh keeps the successful write acknowledged and disables another save until an explicit read succeeds. Unmount/identity change aborts pending work and drops drafts.

Allowed types, capacity, defaults and type override inputs come from the read model. If a new revision arrives while editing, preserve the draft and disable saves until **Reload policy and discard edits** explicitly loads the current policy. Repair suggestions carry a visible upload-blocked warning. Paired English/Farsi labels use the existing locale flag and direction; no RTL geometry changes. The page configures sizes only; it uploads no files and grants no type/scan/storage authority.

```text
Product Admin > Upload limits                 [root-admin only]

Medical files                                 Public images
  Server ceiling: read-only                     Server ceiling: read-only
  Scanner ceiling: read-only                    Default limit: [value] [unit]
  Default limit: [value] [unit]                  JPEG / PNG / WebP overrides
  PDF / JPEG / PNG overrides                    Change reason: [text]
  Change reason: [text]                         [Save] [Use configured defaults]
  [Save] [Use configured defaults]
```

Route/navigation/composition approval, source verification and the user-run static-admin build are complete. Real-browser access/read/negative controls pass below; successful save/reset/audit is covered by isolated source tests, with no live policy changes during delivery verification.

## Verification

The latest backend gate passes **116 tests / 555 assertions** in 31.658 seconds, 60.50 MiB peak PHPUnit memory, extending the prior 112/524 backend slice. Coverage includes stale config/override rejection, missing first-write revision, reduced-capacity repair and null-policy fail-closed behavior, alongside existing marketplace controls/settings/resolution, medical policy/API/service/integrity, public media, scanner protocol and high-authority route contracts. Tests run as www-data/testing/SQLite `:memory:` with isolated writable storage, array cache/session, synchronous test queue and scanning disabled. Existing tenant resolver tests use a disposable SQLite connection. Pint passes the five PHP files touched in this continuation; the previous eleven-file gate remains recorded.

Frontend full quality passes **49 files / 293 tests**, typecheck, lint/fixtures, ratchets and formatting; supplemental page/panel/menu/router lint passes. New coverage checks exact byte/Persian conversion, future large-file MIME policies as mocks only, dynamic policy reload, stale-write protection, reset/reason, password retry/cancellation, refresh failure, abort and identity-draft cleanup. Manifest/menu/router tests verify root access and guest/admin/doctor/patient denial. No dependencies or lock changed. The first run required updating route inventory expectations and encountered the previously recorded Quill timeout; focused Quill/router retry and the final full quality gate pass without deadline changes. Internal route identifiers follow the existing lowercase manifest contract; navigation derives roles from its route.

The first gate exposed a GET route mismatch: an unknown key matched only PUT and returned 405. Aligning GET's key pattern with the existing setting path lets the root-only controller reject unsupported keys with 404. The final gate above includes that fix and complete read-model assertions; no other failure remains.

The original 01:12 Tehran source-runtime check confirmed MySQL/Redis, HTTP, JSON guest-401 and unchanged policies/counts/images. After the user rebuild and browser matrix, the read-only verifier passes again: defaults 10/5 MiB, settings 3/3/no upload definitions, medical/database jobs zero, scanning false/private local. App image remains `18eb9257`; only admin changes to `1626d714`. Scanner stays exited 17/zero restarts/checker running. No live settings/file writes, assistant Compose/build/install, scanner retry, worker or other-project action. The verifier requests JSON explicitly; an HTML guest read follows the existing login redirect. [Current runtime evidence](evidence/upload-policy-panel-runtime-2026-10-08.json), [previous backend evidence](evidence/upload-admin-runtime-2026-10-08.json).

Backend/panel and ordinary live setting audits remain accepted, as do attachment source/migration/rollback and now [ordinary synthetic attachment APIs](attachment-api-acceptance-2026-10-08.md). Current medical counts are one request/quarantined file, zero reports/jobs. Earlier zero-count runtime checks remain historical. UI/content/large capacity/multipart/scanner/worker remain open; preserve cooldown through October 8 20:37:34 Tehran.

## Deployed Artifact And Browser Acceptance

The user reports the admin-only build completed in 20.7 seconds and recreation succeeded. Running/healthy image is `sha256:1626d714ad5cdc4e3d40259c640a50a731cbfc864b915185f9359a2111136247`; entry `/panel/assets/index-D2fKOBAS.js` links `/panel/assets/UploadLimits-Co4c7k92.js`. Twenty-three served assets match the new container byte-for-byte with recorded SHA-256. Page/shared policy markers, localhost:8080 transport, redirect/deep-link refresh, immutable asset caching, gzip equality and missing/outside 404 checks pass. This compares the actual container to served bytes; no assistant reference build was run. [Static evidence](evidence/upload-policy-panel-static-2026-10-08.json).

Isolated headless Chrome 154 executes **15 acceptance checks** against the served artifact. Existing demo accounts root 1/admin 2/doctor 3/patient 4 use ordinary form login and acknowledged JSON logout; protected accounts 7/8 are untouched. Root sees Upload limits after Users and actual medical/public 10/5 MiB read models. Guest redirects/401 and admin/doctor/patient hidden link, role fallback and both setting-read 403s pass. English/Farsi and flag-owned direction, exact Persian decimal conversion, deep-link refresh, required reason, one-byte-over/fractional-byte rejection, reload/discard, real backend 423, existing password dialog/Escape cancellation and correct-password retry pass. No uncaught exceptions, external page HTTP, credential-storage keys or read preflights; all setting PUTs carry CSRF. [Browser evidence](evidence/upload-policy-panel-browser-2026-10-08.json).

To preserve live settings, the isolated browser interceptor replaces every outgoing setting PUT's revision with a guaranteed stale 64-zero revision before it reaches Laravel. Actual responses are 423, 423, 422, 422, 422; none can persist. Password-confirmation POST succeeds ordinarily; the retry uses the same reviewed client request, then actual stale rejection disables saving until explicit reload. Reset submits an empty override plus reason through the same rejection. Future PDF/video/ZIP capacities (1/50/256 MiB, within a fixture 1 GiB ceiling) are supplied through one intercepted GET model only. The UI adapts after reload; this is browser-only model acceptance, with no live MIME/capacity change or large-file transfer/scan acceptance. Successful live writes/audits and an actual deployment-config shift are not claimed.

The first helper run matched a retained hidden template dialog before the password response arrived. The verifier now waits for the actual `#recent-password` input; the complete repeat passes without product edits, another build or settings writes. [Retained partial evidence](evidence/upload-policy-panel-browser-partial-2026-10-08.json).

## Completed User-Run Admin Delivery

The user completed these project-root PowerShell commands. Existing `.env.production` safe origin/locale keys were read-only verified as localhost:8080, optional API base empty, fa/en and port 3000. Only admin was built/recreated; no backend or workers were started. No further build is pending for this source slice.

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml config --quiet
if ($LASTEXITCODE -eq 0) {
    docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml build admin
    if ($LASTEXITCODE -eq 0) {
        docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps --no-build --pull never admin
    }
}
```

Delivery and live setting save/reset remain complete. Current attachment API/runtime verification uses `node scripts/media/verify-attachment-api.mjs --verify-existing` and `node scripts/media/verify-attachment-policy.mjs --activated --after-api`. Old negative/zero-medical runtime evidence and upload-policy helper are historical; do not replay clinical writes or recreate old counts. [API acceptance](attachment-api-acceptance-2026-10-08.md); UI/content/multipart/engine/worker remain open.

## Successful Live Audited Save And Reset

The user said “ok continue” after resolving the execution order. Scope: one ordinary medical-policy save, readonly verification, then ordinary UI reset; no public-policy write or file upload. A fresh Chrome profile used existing root account 1, current CSRF/revision, a nonmedical synthetic reason and the existing password-confirmation dialog. The request guard allowed only the reviewed key/body/revision and forwarded bytes unchanged; it did not rewrite requests or manufacture success. Wire responses are 423, 200, 200. Both UI success states and authoritative refetches were observed.

English Save set `max_bytes: 2097152` and PDF `1048576`. Root GET and live `UploadPolicySettings::forSection('medical')` independently resolved PDF 1 MiB and JPEG/PNG 2 MiB. Audit **5** (`01m4c7926xzw7e5zmryc6swf9f`) records null-before/that exact after, root actor 1, platform/marketplace scope, high risk, succeeded outcome, reason, ordinary PUT route and correlation ID. Atomic first-write registration adds exactly one medical definition/value: counts 3/3 become 4/4.

Farsi Reset submitted `value: []` with a separate reason and the saved revision after checking no intervening edit. Audit **6** (`01m4c79af82km5gz3nm66zmjk3`) records the saved before and empty override after, with the same subject and all authority/audit metadata. Medical effective limits return to 10 MiB for all three types; public remains 5 MiB. Both audits, the medical definition/value and empty override are retained; nothing is deleted to recreate the old counts. Presence means the opaque revision differs from the original absent-setting baseline, despite equal effective defaults.

Readonly postchecks confirm 4 definitions/4 values/one upload definition, zero medical file/request/report/database-job rows, scanning false/private local, DB/Redis access and healthy HTTP. Protected accounts 7/8 and all other setting values match their baseline fingerprints. App/admin pins remain 18eb9257/1626d714; no migration, reset/reseed, credential change, scanner retry/worker/Compose/build or other-project operation. [Live acceptance](evidence/upload-policy-live-2026-10-08.json), [post-acceptance runtime](evidence/upload-policy-live-runtime-2026-10-08.json).

The first helper completed and verified both writes but checked guest status before logout POST acknowledgement, seeing the still-authenticated response. It now waits for acknowledged JSON logout. A readonly `--verify-existing` continuation verified the same audits/restored state and completed refresh/CSRF/storage/exception/logout checks without repeating writes. [Retained partial evidence](evidence/upload-policy-live-partial-2026-10-08.json). The one-shot live script refuses a new run against the now-registered baseline; do not rerun save/reset to replace evidence. Its readonly continuation preserves the same acceptance run.
