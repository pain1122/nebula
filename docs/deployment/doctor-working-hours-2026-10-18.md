# Doctor working days, shifts and rest periods

October 18, 2026, Asia/Tehran. User explicitly requests a real working-day editor after the previous service-window form made a thirty-minute demo rule look like a whole working day.

## Behavior

Existing `/panel/profile` now groups the location schedule by all seven weekdays. Each day is explicitly working/off. A working day contains complete shifts, each with its own start/end, rest periods and service sessions. Appointment duration belongs to a service session, separately from the shift's hours. A newly enabled day creates an **unsaved, editable** 08:00–16:00 draft with lunch 12:00–13:00 and thirty-minute appointments. Existing stored short rules are read faithfully; they are never silently expanded, reseeded or saved by opening this editor.

A shift can offer one service for the whole time or divide its time into consecutive service sessions with distinct durations and prices. Moving a session boundary moves the next session's start. Removing a session gives its time to its neighbor. Additional shifts support morning/afternoon patterns. Rest applies across sessions; crossing breaks are clipped into the corresponding persisted service rules. No parallel doctor capacity is invented.

The recurring preview lists actual template starts and totals for work/rest/appointments. An 08:00–12:00 shift with a 10:00–10:30 break yields seven thirty-minute appointments. An 08:00–16:00 shift with lunch 12:00–13:00 yields fourteen. Preview follows the server cursor behavior, including restarting at the end of an intersecting break. It excludes incomplete appointment tails and is explicitly not a claim about free dated slots or existing reservations. Effective dates, other bookings and existing slot overrides still apply on the server.

Invalid same-day ranges, overlapping shifts/breaks, breaks outside a shift, service gaps/overlaps, inactive services, unsupported duration/price/currency, reversed validity dates, empty capacity and the eight-service-sessions/day bound disable submission with translated feedback. Price and effective-date overrides remain available under optional sections. Existing saved rest periods also appear on the read-only profile cards. EN/Farsi use the retained Bootstrap/Velzon controls, with isolated LTR clock fields and no new CSS/dependency/navigation/URL/schema.

## Persistence and safeguards

This is an editor over the existing weekly-rule API, not a second scheduling system. Consecutive stored rules with identical validity are reconstructed into a shift; genuine gaps remain separate shifts. Rules with too many combined breaks remain separate rather than losing rest periods. Independent shift identifiers are not stored. The existing sequential service-window model remains authoritative and compilations round-trip its service rules, prices, dates and clipped breaks.

Existing own-location authority, fresh HMAC revision, reason, explicit confirmation, ordinary recent-password step-up, uncertain-delivery marker, cancellation/session abort and atomic audit remain intact. Existing booked slots, original prices and payment/reservation history remain protected by the unchanged server implementation. Closing a day removes its future rules only through an explicitly reviewed ordinary save. Live positive profile/weekly saves remain a separate acceptance gate; none are performed here.

## Verification

- Full frontend quality: 75 files / 777 tests; typecheck, lint, fixtures, unchanged ratchets (2515/10/40/0), formatting and explicit changed-page lint pass. Focused source delta: 29 tests. Final layout/overlay delta: 34 tests, strict success/suite-status receipts, typecheck, lint and unchanged ratchets. The opt-in Bootstrap `modal-lg` size affects only the weekly editor; all other dialog defaults/focus/busy behavior are retained and tested.
- UID33 SQLite isolated backend: 9 tests / 92 assertions. Added actual full-day/lunch/two-service materialization checks produce precisely the previewed starts. Existing booked-money preservation, authority, stale revision and atomic rollback cases remain green. PHP style passes. The initial CLI emitted a harmless permission warning attempting its default result-cache path; no project cache was written.
- First static/native candidate `28af32b7` passes 66 served assets and nine groups/60 requests/16 captures. Visual inspection finds narrow mobile break clocks; the final `c3458981` candidate stacks these fields and uses the larger Bootstrap dialog on desktop. Its 66 served assets and both doctors × EN/Farsi × 1440/390px native checks pass nine groups/60 requests/24 captures. Canceled drafts leave exact saved practice DTOs and all clinical/financial/catalog/schedule/audit/outbox/protected hashes unchanged. No JS exception, external request, blocked writer or unexpected server error. Final drafts remove other shifts in the selected day before expanding its hours, so the demonstrated full-shift capacity is valid without overlaps; these removals are unsaved and canceled too. Original captures/evidence remain preserved.
- Final no-result-cache UID33 materialization delta passes one test / five assertions without the earlier harmless CLI cache-path warning.

Evidence: `evidence/working-hours-quality-2026-10-18.log`, `evidence/working-hours-source-delta-2026-10-18.json`, `evidence/working-hours-backend-2026-10-18.log`, `evidence/working-hours-admin-build-2026-10-18.log`, `evidence/working-hours-static-2026-10-18.json`, `evidence/working-hours-browser-2026-10-18.json`.

Final evidence: `evidence/working-hours-layout-delta-2026-10-18.json`, `evidence/working-hours-backend-final-delta-2026-10-18.log`, `evidence/working-hours-final-admin-build-2026-10-18.log`, `evidence/working-hours-final-static-2026-10-18.json`, `evidence/working-hours-final-browser-2026-10-18.json`, `evidence/working-hours-acceptance-2026-10-18.json`. Successful writers are immutable; inspect rather than replay them.

## Runtime and rollback

Only the explicitly delegated static-admin service is rebuilt/recreated. Backend/database/scanner/parser/worker Compose remain operator-owned. No live save, password confirmation, credential/environment/schema change, download, scanner/worker activation or job consumption. Two existing medical-scan jobs and protected accounts7/8 remain untouched.

Healthy final image: `sha256:c34589816b7d618e4a4e418e8f462308cb0ef13f07a2f00a681397047031a03f`, retained as `checkupino-admin:working-hours-accepted-2026-10-18`. Retain prior accepted `checkupino-admin:doctor-panel-accepted-2026-10-18` / `b1fae6ee` for static rollback. No data rollback or migration is needed. Existing backend image/both read-only socket mounts and nine running services are preserved; parser/scanner/checker/worker remain stopped. Successful live weekly saves and real-MySQL contention acceptance for this weekly writer remain separate.
