# Doctor practice, confirmed calendar and booking wizard - October 18, 2026

Authorized by the user's request for a doctor-owned appointment calendar, visible/manageable professional and working-day information, a service/doctor/location/time booking wizard, obvious active navigation and once-only theme-customizer introduction. The user explicitly chose **confirmed only** for the doctor calendar. Existing panel addresses, React 18/Bootstrap/Velzon surfaces, File Manager, English/Farsi, storage and session/privacy boundaries are retained; no dependency, migration or credential change.

## Before and after

| Before | Delivered behavior |
| --- | --- |
| Calendar exists only on the administrative dashboard. | Doctors get the same calendar widget on their own home. The server selects their exact profile's confirmed appointments with a matching successful canonical payment; completed, pending, cancelled, expired, unpaid and foreign-doctor bookings are excluded. The existing completed demo reservation never appears. Calendar navigation opens the existing owned medical page; View all opens assigned reservations. |
| Doctor profile/schedule APIs exist without panel controls. | The existing owner profile has professional cards and location-specific weekly working-day summaries/editors. A visible Professional profile & working days entry in the doctor's care submenu and a profile quick link make the controls discoverable. Specialties/primary specialty, experience, introduction and profile fee can be reviewed; each active location has service/day/time/duration/break/effective-date/window-price controls. |
| Booking uses simultaneous dropdowns. | Existing `/panel/book` now has four card/line stages: service with description, real doctor cards, locations, then actual times. Back/Next, step navigation, breadcrumbs, filtering and a retained selection/price summary work together. Parent selection changes invalidate dependent choices; booking retains the same idempotency key for uncertain retries and never posts simply because a choice changes. |
| Selected menu color is subtle; the doctor profile has no sidebar item. | Existing active state also has the Bootstrap primary background, text and rounded treatment, including the selected child and parent. Doctor profile presentation reuses the registered owner profile route through the product menu adapter; the core route/role contract is unchanged. |
| Theme customizer opens on every remount. | Introduction is remembered once per account in this browser. Later route loads/reloads/returning logins keep it closed; the original rotating knob opens it manually, including on mobile and keyboard. Another account retains its own first introduction. Blocked persistent storage uses a tab-local fallback. Server/cross-device preference synchronization remains separate. |

## Safety and compatibility

New GET `/api/doctor/dashboard/appointments` accepts only a validated, at-most-42-day range, caps results at 200 and rechecks current active doctor ownership. Its private/no-store response contains safe appointment labels and confirmed status only. Doctor owner/status context is also checked by the calendar client. Administrative calendar behavior stays unchanged.

GET/PUT `/api/doctor/practice` use fresh active doctor ownership, explicit projections and private/no-store responses. Saves require the current server HMAC revision, ordinary recent-password confirmation, trimmed reason and explicit confirmation. User/profile/location locks, bounded input, active specialties/offered services, transactional rule replacement and atomic audit apply. Revisions include current authority-owned profile/rule/reference state and audit sequence, so same-second value reversions do not revive an old revision. Nested collections are canonicalized. Stale/session/cancellation/uncertain-delivery paths fail closed; an explicit refresh recovers the browser's pending marker before another attempt. Verification cannot be self-granted, credentials/contacts are not editable, and the established separate verification decision is preserved.

The legacy PUT `/api/doctor/profile` now enters the same guarded save path and recent-password middleware; it cannot bypass revision/reason/audit controls. The prior bare update method is no longer routed. Static panel rollback does not restore an unguarded writer.

Weekly edits delegate to the existing DoctorScheduleService. They replace future weekly rules for the selected owned workplace, preserve booked slots/reservation/payment history, and permit explicitly closing all future windows. Invalid/overlapping/unoffered/foreign input is rejected. Profile fee edits do not rewrite published slot prices or booked money. Positive saves are accepted in isolated SQLite; no live doctor/profile/weekly save or new real-MySQL weekly-writer contention claim is made. The earlier accepted visit-slot contention/recovery implementation remains unchanged.

Booking cards expose actual specialty, experience and location base-price ranges; the chosen slot remains authoritative for the final price. Private doctor introductions/contacts are neither returned nor searchable through the public booking reader. Inactive services/categories/doctors are excluded. Descriptions render as plain text. No real published avatar or numeric rating source currently exists: initials and an explicit unavailable-rating label are used, with no fabricated score, stock identity or remote image fetch.

## Verification and retained failures

- Full frontend quality: 74 files / 759 tests, typecheck/lint/fixtures/format and existing ratchet limits pass. The final navigation/profile/booking/calendar/customizer delta adds a green 80 tests across nine affected files; explicit changed-page/customizer lint passes. The current token counts remain 2515/10/40/0, with dependency and build configuration pins unchanged.
- Isolated UID33 SQLite: eight tests / 83 assertions, followed by six canonical-revision/weekly/professional cases / 62 assertions, a calendar integrity case / 17 assertions and private-card-search case / 15 assertions pass. Evidence preserves each run; the targeted deltas cover later hardening without replaying live data. Six PHP files pass Pint.
- Read-only actual MySQL practice capture for synthetic doctors3/5 yields stable revisions, respectively two/one workplaces and five/three active windows. No project environment or credential is changed by tests; stateful SQLite fixtures use a public synthetic key and an empty isolated environment.
- Candidate `b1fae6ee` is healthy with 66 assets verified against served identity/gzip bytes and current feature/privacy contracts. Builds/recreation target only the previously delegated `checkupino_prod` admin service. Backend/database/worker/scanner Compose remain operator-owned.
- Native matrix and final visual proof are recorded in the evidence below. They use only synthetic accounts1-5, ordinary login/logout and GET, with a request guard refusing business saves, password confirmation, downloads and external requests. Professional/weekly modals are opened and canceled; no booking or profile save is replayed.

Final runtime acceptance: `b1fae6ee` / 66 assets; 20 patient/two-doctor/admin/root ENFA-width cohorts, 48 functional groups / 203 requests. The same-image doctor visual delta adds eight cohorts / nine groups / 68 requests / 24 captures. All exceptions/external requests/blocked writes are zero, and every current clinical/financial/catalog/schedule/audit/outbox/protected fingerprint matches before and after. The 16 original scrolled calendar/profile captures are superseded; 56 current accepted capture files combine the remaining 32 matrix captures with the 24 final visual captures. Original artifacts remain preserved.

One rejected navigation attempt repeated roles on the shared owner profile route, violating the registry contract. The first scoped shell command incorrectly continued after the JSON gate failed, briefly deploying that invalid panel candidate. The prior accepted `a3f0286a` was immediately restored; the conditional link moved to the product adapter, and a strict success-plus-suite-status gate guarded the corrected build. Initial failed JSON/build logs are preserved. No backend Compose, business or protected-data write occurred. Other retained harness corrections wait for asynchronously loaded service cards, normalize the root menu's trailing slash and capture scrolled sections without an out-of-viewport clip. The final visual proof supersedes those original scrolled captures; application behavior was not altered for capture coordinates.

## Evidence and rollback

- `evidence/doctor-panel-quality-accepted-2026-10-18.log`
- `evidence/doctor-panel-final-source-fixed-2026-10-18.json`
- `evidence/doctor-panel-backend-accepted-2026-10-18.log` and the three later `backend-*-delta` logs
- `evidence/doctor-panel-admin-build-fixed-2026-10-18.log`
- `evidence/doctor-panel-static-2026-10-18.json`
- `evidence/doctor-panel-browser-2026-10-18.json`
- `evidence/doctor-panel-visual-2026-10-18.json`
- `evidence/doctor-panel-acceptance-2026-10-18.json`

Retain the accepted candidate as `checkupino-admin:doctor-panel-accepted-2026-10-18`. The retained predecessor `checkupino-admin:questionnaire-history-accepted-2026-10-18` / `a3f0286a` is the static-panel rollback and includes the accepted session-history privacy guard. No data/schema rollback, credential replacement, migration or worker action is needed. Additive read APIs and the guarded legacy writer may remain deployed.

Separate gates remain: real live profile/weekly/admin saves, doctor avatar upload/validation/publication, authoritative patient rating collection/publication, current scanner recovery and continuous dedicated processing, archive/audio/video transport/content acceptance and questionnaire thumbnails. Two existing medical-scan jobs must remain untouched. Main environment defaults, both app read-only sockets, original app image, four media services, protected patients7/8, hazelnut2.0 and NebulaNV remain outside mutation scope.
