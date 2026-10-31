# Reservation action foundation — October 13

| Before | After this slice |
| --- | --- |
| Existing reservation page read-only; authority guard delivered. | Server returns current permitted actions and an opaque revision; page remains read-only until the next UI slice. |
| No admin replacement-slot reader tied to one reservation. | Bounded, paginated real-slot read for its same doctor/workplace/service, with Tehran dates and current conflict exclusions. |
| Admin writes lacked stale-view protection and reschedule returned raw models. | Fresh revision required, stale/duplicate delivery returns409, and successful isolated writes return the safe detail DTO. |

## Scope and contracts

The existing admin/root composition approval covers this reservation administration work. No new canonical panel route, visual change, dependency, schema or live business mutation occurs. The successful live profile-save rehearsal remains explicitly deferred to the user. Existing static admin `f6a0de92`/50 assets is retained without a build or recreation.

`GET /api/admin/reservations/{numericId}` adds `data.actions`: HMAC revision, generated time, `can_reschedule` and root-only `allowed_statuses`. Reads require current active admin/root authority. Eligibility is advisory; writes still authorize and validate under locks. Root transitions reuse the existing override service's exact transition rules; they do not set a payment summary to paid. Reschedule eligibility checks a live pending hold or permitted confirmed state and current offering availability. Completed/other terminal records remain unavailable.

`GET /api/admin/reservations/{numericId}/reschedule-slots` accepts only `from`, `to`, `page`, `per_page`. Dates require exact YYYY-MM-DD, at most31 inclusive calendar days, interpreted in the stored reservation timezone. Defaults: page1/per-page20; bounds: page1..1000/per-page1..100. Slot ownership comes from the reservation; supplied doctor/patient/workplace/service keys are rejected. SQL excludes the current slot, inactive rules/slots, past slots and overlaps with other confirmed or unexpired-pending reservations. It excludes the current reservation from conflicts, allows adjacent boundaries and does not materialize/update slots. Stable start/ID ordering precedes pagination. Output contains public slot ULID, times/duration, pagination, the action revision, timezone and unchanged booked amount/currency; replacement slot prices never rewrite booked money. Both detail and slot responses are private/no-store.

Admin PUT `/schedule` and `/status` keep ordinary reason/recent-password controls and accept only their exact slot/status, reason and required `expected_revision` fields. Unknown keys are rejected even when null. The revision binds reservation state/ownership/times/booked money, payment summary, latest schedule history and reservation audit; same-second state reversion cannot revive a prior token. It is compared under current actor/reservation/payment locks before mutation. Stale and duplicate delivery returns structured409; unavailable/conflicting offering remains422. A checkup deactivated or deleted between read and delivery refuses safely. Responses use the whitelisted detail DTO instead of raw schedule/audit/payment models.

## Verification

- New API plus retained authority/rollback suites: **26 tests / 166 assertions**; related reservation/medical/questionnaire regressions: **30 / 442**. Total56/608 isolated SQLite.
- Installed pinned validation runtime, UID33, network-none/read-only bind, masked live private storage, temporary storage, project environment/cache bypass. Pint7 and helper syntax/pre-Docker argument refusal pass.
- Coverage includes roles, completed/inactive/expired eligibility, password/reason/revision, strict keys, stale payment, same-second reversion, duplicate delivery, offered-slot conflict/removal, booked-money preservation, terminal refusal, pagination and Tehran boundaries.
- Initial malformed array-date input exposed Laravel cross-field date comparison throwing500. Strict type/date validation now finishes before comparing the validated dates; both array directions return422. No validation expectation or guard was weakened.
- `node scripts/media/verify-reservation-actions-readonly.mjs` passes real UID33 read-only MySQL controller/service checks for admin2/root1 on completed reservation8, safe revision/detail, disabled actions and slot refusal, zero jobs and unchanged data fingerprints. This is not HTTP middleware/browser or a positive live slot-query/mutation proof.
- `node scripts/media/check-demo-readiness.mjs` passes twelve services, fifty served assets, backend/parser/Redis/MySQL/both read-only sockets, actual idle worker/jobs0 and original completed/protected fingerprints. Scanner remains stopped/current real probe absent. No scanner/definition request, worker delivery or clinical write.

[Immutable source/runtime proof](evidence/reservation-actions-foundation-2026-10-13.json) binds13 files. Previous profile proof remains immutable:43 of45 bound source files are unchanged; only its reservation controller and API routes intentionally change in this approved successor. Previous authority proof remains historical; the current service revisions supersede its two service hashes while all14 authority tests still pass.

## Compatibility and next action

Detail metadata is additive, so the retained read-only frontend adapter continues to accept its existing DTO. Admin write callers must read the current revision; missing revisions now refuse422. Service signatures retain old callers through an optional final revision argument, including the existing doctor path, which retains its old slot/doctor/reservation lock sequence. The new admin reschedule path additionally locks the payment summary for its revision check. Reschedule responses now deliberately expose safe detail fields only; old consumers of raw schedule history must adapt.

No migration, reset, credential replacement or image rollback is needed. Keep the current safety checks during client UI refactors/static rollback; never broadly restore the dirty worktree or remove prior data/history. These deterministic SQLite cases and read-only MySQL refusals do not establish a new concurrent MySQL write proof.

Next wire the approved existing reservation-detail controls to this contract: real slot selection, root-only permitted states, explicit confirmation/reason/password, fresh pre-delivery reads, cancellation, role/session abort and manual refresh after uncertain delivery. Then accept source/deployed EN/Farsi/mobile/read-only controls; separately retain user-owned successful live save acceptance.
