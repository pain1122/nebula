# Owner and support profiles — October 13, 2026

Directory **Edit** now opens `/panel/users/{publicUlid}` instead of the existing-user modal. Header **Profile** opens `/panel/profile` for the authenticated owner. Both use the same retained Velzon card/grid overview, with a guarded inline display-name editor. The user explicitly approved both exact URLs and chose **status/summaries only** for support.

## Delivered behavior

- Real appointment/upcoming/completed/request/published-report/questionnaire totals, recent status/date previews and subject-owned operational activity. Each section previews at most ten records; counts cover all matching records. Archived/expired report contents remain excluded. This is an operational overview, not an exhaustive security log or general reporting dashboard.
- Patient/doctor owner links use their existing reservation/medical pages. Support provides the filtered administrative appointment shortcut and report/activity section shortcuts without clinical-body, answer or file-download links. Doctor filters use the doctor-profile ID, rather than the user ID. Back restores validated directory filters; unknown/private-sort parameters are removed.
- Support cannot read credentials, national ID, birth date, private contact/address/bio, medical histories, report bodies, questionnaire answers/scores/results or security/session details through these DTOs. Activity returns only public references, timestamps and supported event categories. Actual medical uploads map to the existing public “Attachment received” category, preserving older profile clients without exposing clinical labels or audit payloads.
- Inline edits accept only first/last display names, a required reason and the fresh opaque revision. Existing recent session password confirmation, transaction-owned role/state recheck, audit rollback, cancellation, duplicate protection, uncertain-delivery lock and explicit fresh recovery remain. Role/session/subject changes abort and discard the prior editor. There is no impersonation or account/session switch.
- Creation remains a separate existing dialog. Root administration retains its existing ownership boundaries and account lifecycle. The legacy general update API now rejects private fields, including explicit null values, and requires reason/revision for its remaining safe name/role/status operations. Root identity promotion remains root-only; the profile form offers no role/status change.

## Identity privacy closure

Legacy admin-user list/show/create/update responses retain nullable compatibility keys but return no private values. User search uses display names/public references; private contact/identity sorting and lookup are rejected or excluded. New identity audits contain safe names/roles/status, without contact values; historical audit rows are immutable and are not rewritten.

Related admin doctor responses exclude account contact fields and the doctor phone, including verification responses; reservation patient email and questionnaire submitter phone are masked. Corresponding private-contact search/sort paths are closed. The separately approved clinical-administration permissions remain governed by their existing policies; this profile decision does not impersonate a clinician or rewrite those clinical records.

## Acceptance

- Isolated profile/identity/root/step-up/lifecycle gate: **43 tests / 343 assertions**. Related reservation/medical/questionnaire regressions: **30 tests / 442 assertions**. Tests use existing pinned runtime, UID33, no network, read-only source, in-memory SQLite, bounded temporary storage and project-env/config bypass. No live database test or migration.
- Frontend: full **60 files / 492 tests**, sixteen dedicated profile-flow tests plus nine shared overview tests, TypeScript, governed/supplemental lint, fixtures, formatting and unchanged ownership/direction/debt ratchets (**2515/10/40/0**). Fourteen readiness safeguard tests pass. Existing dependencies, RTL generator, CKEditor adapter ownership and packages/lockfile are unchanged.
- Healthy static admin **f6a0de92**, **50 actual served assets**, lazy/deep-link/origin/compression/cache/404 and served/container byte equality. Retained tag: `checkupino-admin:user-profile-accepted-2026-10-13`.
- The retained eleven-group admin/root/owner-refusal and medical/questionnaire rehearsal passes. New **21 real-pointer groups / 98 API requests**, admin2/root1/patient4/doctor5 EN/Farsi, directory/profile/header navigation, Back, inline unsaved typing/cancel/fresh reset, role/API refusals and measured desktop/390px mirrored cards/header/breadcrumb pass. No runtime exceptions, external calls or blocked business requests in the accepted run.
- Read-only UID33 MySQL service/controller verification confirms shared DTOs, contact redaction and root-subject denial. Patient4: five reservations/one completed, two requests/two reports/one submission and two real attachment activity events. Doctor5: two assigned reservations/one completed. Worker remains idle/jobs0; all accepted booking/payment/medical/questionnaire/audit/outbox/protected fingerprints match the original completed checkpoint.

Immutable evidence: [served assets](evidence/user-profile-static-2026-10-13.json), [retained role rehearsal](evidence/user-profile-browser-2026-10-13.json), [new actual-pointer/geometry proof](evidence/user-profile-pointer-2026-10-13.json), [current activity/contact checks and corrected ENFA captures](evidence/user-profile-captures-2026-10-13.json), [final source/runtime binding](evidence/user-profile-acceptance-2026-10-13.json). Supplemental current captures pass three groups/twenty requests/four captures, with a verified scroll origin. Earlier failed pointer/capture attempts remain immutable: retained customizer remount/ordinary-close timing, Windows startup-file EBUSY, a capture selector and smooth-scroll capture origin were harness issues. Accepted checks use real ordinary close controls and bounded startup reads; no overlay/DOM removal or product CSS change.

The new controls are deployed and read/cancel/refusal acceptance is complete. **Successful live profile writes remain a separate guarded synthetic checkpoint**, alongside the other open positive admin mutations; the accepted demo/history is never replayed or edited. Isolated API success/audit rollback and mocked ordinary browser save/password/revision recovery are accepted. These checks do not establish real-patient readiness.

## Repeat checks and rollback

Read-only/repeatable commands:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-panel-profile.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-profile-linked-administration.ps1
node scripts/media/verify-panel-profile-readonly.mjs
node scripts/media/check-demo-readiness.mjs
```

The static/browser/pointer/capture helpers write one-shot immutable proofs and refuse overwrites; inspect existing evidence instead of replaying them unchanged. Exact delegated deployment performed: static-admin project `checkupino_prod`, `.env.production`, `docker-compose.prod.yml`, quiet config, cached `build admin`, then `up -d --no-deps --no-build --pull never admin`. No other service recreation/build/install or scanner/definition/worker operation.

Prior accepted `a5b45485` remains tagged `checkupino-admin:questionnaire-editor-accepted-2026-10-13`; earlier RTL/demo rollback tags remain. A static-only rollback can restore the previous admin image via a project-scoped image override and the same admin-only recreation, preserving backend privacy tightening and all data. The previous image lacks these profile routes and its retired private edit request is intentionally refused. Do not restore private-field access, reverse a live migration, erase audit history or reset data to imitate full rollback. Exact source compatibility is governed by the bounded safe DTOs and unchanged schema.

Prepared rollback commands, **not executed**:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.profile-admin-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Profile UI rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.profile-admin-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Profile UI rollback failed.' }
```

The override changes only the static admin image and its configuration passes quiet validation. Returning to the accepted profile image uses the base admin-only recreation with its current `checkupino-admin:local` tag, after verifying that tag still resolves to `f6a0de92`; never assume a mutable local tag remains unchanged.

Fresh-upload readiness remains false: scanner stopped/stale, current engine proof absent. Profile/history functionality does not activate scanning, consume a queue job or claim current definition acceptance.
