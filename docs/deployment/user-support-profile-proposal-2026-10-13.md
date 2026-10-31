# Shared owner/support profile — October 13, 2026

Status: both exact URLs explicitly approved by the user; the shared pages, inline controls and legacy privacy transition are now deployed/accepted. See [the final acceptance](user-profile-acceptance-2026-10-13.md). The source-only/pending statements below preserve the original proposal checkpoint and are superseded by that report.

The user requests that directory Edit opens the user's profile page instead of a modal, with the same overview owners see, activity/report previews and an additional edit option. The subsequent explicit privacy decision is **status/summaries only** for support: no clinical contents or private identity fields. This narrows the new support surface; it does not silently revoke the separately accepted medical-administration scope.

## Concrete route decision

- `/panel/profile`: authenticated owner overview, accessible to patient, doctor, admin and root-admin. The header's existing profile entry opens this registered product page rather than the currently unregistered placeholder.
- `/panel/users/:userId`: admin/root support overview. `userId` is the user's existing public ULID, not the numeric database key. The directory Edit link opens this page and preserves validated directory filters for Back. Ordinary admins cannot inspect admin/root identities; root can inspect ordinary admins, never another root through user management.
- Both use the prepared `ProfileOverview.tsx` card/grid presentation. No impersonation, session switch, new sidebar entry, dependency, custom CSS or schema. Owner clinical drill-downs use the already approved role-specific medical pages; support previews do not link to clinical contents, file downloads or questionnaire answers.
- Editing is inline on the profile page, limited to **first and last display names**. It cannot edit credentials, email/phone, national ID, birth date/address, private biography, medical history, roles or account status. Save uses the ordinary recent-password session coordinator, explicit reason, freshly read opaque revision and transactional audit. Cancellation/uncertain delivery require fresh recovery; never automatic replay.

AI_BOOT.md, “Phase 2,” requires human approval before finalizing “canonical `/panel/*` URLs, redirects, and deployment base-path behavior.” CODEX_RULES.md likewise says “Stop for user approval before … canonical route changes.” The requested presentation is already authorized; **only these exact new URLs remain the named approval gate**. No registry/navigation change or static-admin deployment has occurred for this proposal.

## Prepared source foundation

- `PanelProfileService` and `PanelProfileController` provide `GET/PUT /api/panel-profile` for the current owner, and `GET/PUT /api/admin/users/{publicId}/support-profile` for authorized support. Support remains an admin API operation, never an owner's session or clinical endpoint.
- The server builds explicit DTOs. Counts include subject-owned or doctor-assigned reservations, requests, current retained published reports and owned questionnaire submissions. Each preview is bounded to ten recent records with stable ordering; counts cover all matching records. No medical titles/instructions, report bodies, scores/results/answers, filenames, patient identities, private identity values or credentials are returned.
- Activity contains only allowlisted event types/public references/timestamps for that subject as actor. Security events, audit payloads/reasons, routes, IPs, tokens and sessions are absent. These are operational event previews, not a comprehensive access/security log.
- Revision binding includes names, current roles/state, timestamp and latest subject audit identity, protected by the application HMAC key. Same-second name reversion cannot revive a prior token. Update rechecks active actor and target authority under locks; the shared audit transaction rolls back on audit failure.
- The frontend adapter independently strips unsolicited fields from every DTO section, rejects drafts/security actions and enforces the ten-row bound. The unused overview renders the same metadata card grid in English/Farsi without clinical links or untrusted HTML. No existing route is wired to it yet.

## Remaining work after URL approval

1. Close the legacy user-management privacy path in the same transition: old `AdminUserResource` currently exposes email/phone/NID/birth date/address/bio, and old update permits private identity replacement. Redact private identity responses, remove private-identity search inference, and prevent the old edit API from bypassing the new restricted/reason/revision path. Existing creation and root administrative lifecycle ownership need explicit regression coverage; no live credential replacement or clinical action.
2. Wire both registry-owned pages, header profile entry, directory links, URL-owned Back filters and role-aware operational quick access. Keep creation separate from the existing-user edit path. Owner and support share composition, with owner-only medical navigation and support metadata restriction.
3. Connect inline display-name edit with native forms and the existing password coordinator. Check fresh revision, reason, cancellation, duplicate/uncertain/unmount/session reset, role/privacy refusals and matching EN/Farsi behavior.
4. Run isolated PHP/privacy regressions and full frontend quality. Reuse the explicitly delegated static-admin build/recreate only after source checks, retain the prior accepted image, then accept actual browser navigation/roles/metadata/RTL/mobile and current served assets against unchanged protected/demo fingerprints.

## Verification and rollback

Immutable source binding and accepted limits: [foundation evidence](evidence/panel-profile-foundation-2026-10-13.json).

Accepted source gate: isolated PHP **12 tests / 105 assertions**, Pint **5 files**, TypeScript/full frontend **59 files / 469 tests**, final focused profile **9 tests**, lint/fixtures/format and unchanged ownership/direction/debt ratchets (**2515/10/40/0**). UID33 live MySQL **READ ONLY** service verification passes shared owner/support DTOs, redaction and root-subject denial: patient4 has **5 total reservations / 1 completed / 2 requests / 2 published reports / 1 submission**; doctor5 has **2 assigned reservations / 1 completed**. The first checker incorrectly assumed only the golden-flow reservation existed; its expected totals now come from independent subject-scoped database counts, with no data change. This is service acceptance, not HTTP/browser or successful live edit acceptance.

`node scripts/media/verify-panel-profile-readonly.mjs` performs that bounded read-only service check and emits safe counts only. `node scripts/media/check-demo-readiness.mjs` passes the unchanged completed/protected checkpoint: twelve services,47 accepted existing assets, idle worker/jobs0, recorded history ready; fresh scanning still blocked. No new frontend deployment or business write.

Source-only isolated acceptance command: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-panel-profile.ps1`. It uses the already installed pinned image, UID33, no network, read-only source, in-memory SQLite, bounded tmpfs storage, project-env/config bypass and a masked live private-storage mount. It starts no Compose service, worker or scanner and installs nothing.

The prepared endpoints/DTOs do not modify existing user data or schema. Source rollback removes only the new profile routes/controller/service/adapter/overview and new audit allowlist entries; retain any subsequently accepted privacy tightening rather than restoring private-field exposure. Current deployed static admin remains accepted `a5b45485` / 47 assets, rollback tag `checkupino-admin:questionnaire-editor-accepted-2026-10-13`. Prior RTL and demo rollback tags remain untouched.

Do not describe this foundation as deployed support UI or complete legacy privacy enforcement. Successful live edits, profile navigation/browser acceptance and the old-endpoint privacy transition remain pending. Only synthetic isolated data is mutated during source tests; the accepted completed demo and protected patients remain unchanged.
