# Schedule administration: read foundation

The user authorizes schedule administration after catalog completion. This first bounded slice adds four admin/root JSON readers; it does not introduce a panel route, mutation or scheduling sweep. [The concrete page/control proposal](admin-schedule-proposal-2026-10-15.md) is awaiting the two canonical panel URL/composition decision required by AI_BOOT.md.

| Before | After |
| --- | --- |
| Schedules/rules/materialized slots exist in the doctor domain; admin has no dedicated safe schedule readers. | Dedicated workplace list/detail, paged recurring rules/breaks and paged dated-slot readers use explicit operational DTOs and fresh authority checks. |
| Doctor-only slot mutations cannot serve as administrative authority. | Doctor write ownership remains unchanged; no impersonation or new administrative write path is introduced. |
| A slot's enabled state does not explain conflicts or historical use. | Independent server flags distinguish enabled state, future time, blocking reservation, reservation history and rule/owner/service binding consistency. No flag claims bookability. |

## API contract

All endpoints require the existing active authenticated admin/root middleware, fresh database actor/roles before and after the read, and `Cache-Control: no-store, private`. The response has `meta.generated_at` and `meta.read_only: true`.

- `GET /api/admin/schedules/workplaces`: default20/max100 records, page1–1000, stable whitelisted sort, literal EN/Farsi search over display/hospital/doctor names or exact public identities; composed doctor-profile, hospital, checkup and current/active/inactive/archived/all filters. Current means nonarchived, including inactive workplaces.
- `GET /api/admin/schedules/workplaces/{workplaceId}`: numeric existing workplace ID; safe doctor/hospital metadata, counts and up to100 explicit service offerings with exact decimal price strings and pivot overrides. An oversized embedded collection refuses503 rather than truncating.
- `GET /api/admin/schedules/workplaces/{workplaceId}/rules`: independently paged, stable weekday/local-time/ID order, active/inactive/all, weekday and service filters; exact rules, effective dates, price/currency overrides and bounded sorted breaks. More than50 breaks on a returned rule refuses503. Historic inactive rules and archived checkup names remain readable.
- `GET /api/admin/schedules/workplaces/{workplaceId}/slots`: independently paged, stable occurrence-time/ID order; service/rule/enabled-state, conflict, reservation-history and past/future filters. Both local `from`/`to` dates are required together; default is today through six days later in the hospital timezone, maximum31 inclusive local calendar days, with exclusive next-midnight UTC bounds. Invalid hospital timezone refuses503. Offset-aware timestamps retain both offsets on a daylight-saving transition day.

Slot conflict flags reuse `Reservation::blocking`: confirmed reservations and unexpired pending holds overlapping the same doctor at any workplace block; expired holds and cancelled/completed/expired history do not. Historical use remains separately true even when a reservation no longer blocks. No reservation/patient identity, clinical body, doctor contact/bio, hospital contact/address, booking notes, credentials or audit payload is exposed. Prices are strings; slot time/currency/ownership are never changed.

Other privileged doctor-account identities are excluded from read/search scopes, including another root. Returned workplace visibility is rechecked against current owner roles before a response, alongside fresh actor roles/account state; mid-read promotion/revocation refuses instead of exposing previously selected metadata. Missing/hidden workplace IDs are404. Unknown fields, arrays in scalar filters, invalid IDs/dates/ranges/sorts and oversized pages reject.

This is a view of stored schedule facts. It neither creates missing slots nor promises availability. Booking/rescheduling must still use their existing transactional services and current eligibility/conflict checks. It does not expire holds or consume jobs.

## Verification and evidence

Final isolated SQLite/source acceptance: **22 tests /490 assertions**, comprising14 schedule cases and8 retained catalog-read cases. The runner uses the existing pinned validation image, UID33, no network, read-only project source, project environment/cache bypass, tmpfs SQLite/storage and a masked live private directory. Scoped Pint and whitespace checks pass. Tests cover role/privileged-identity denial and mid-read changes, private DTOs/exact prices, historical state, literal search/stable pages, composed filters, cross-workplace conflicts, expired-hold versus history semantics, DST boundary offsets, date pairing, default periods, hard bounds and unchanged schedule/booking/payment/audit/outbox/job rows.

Initial failures exposed an incomplete date-pair validation rule and an invalid duplicate workplace test fixture; both were corrected. A privacy test first triggered promotion during the pagination count, correctly yielding an empty200 list; its hook was moved after row selection to test the intended final403 guard without relaxing the assertion. The accepted raw MySQL proof predates only that test-hook correction: its controller/routes/runtime sources are unchanged; the final binding records the final isolated-test source separately. No accepted artifact was overwritten.

**Ten UID33 direct-controller checks in a live read-only MySQL transaction** pass for existing synthetic admin2/root1, plus **four actual guest HTTP401 refusals**. Exact schedule/doctor-reference/catalog and original completed/protected fingerprints match before/after. These checks do not establish authenticated browser acceptance, successful live mutations or concurrent MySQL writer acceptance. [Runtime proof](evidence/admin-schedule-read-runtime-2026-10-15.json), [final source/evidence binding](evidence/admin-schedule-read-acceptance-2026-10-15.json).

The accepted admin43f3 image and54 served assets remain unchanged; no frontend source/build/Compose operation occurred. The prior catalog binding retains49 of50 source hashes and all19 evidence/capture hashes; `routes/api.php` is intentionally superseded by the four additive readers. The catalog controller, mutation service, controls and data remain unchanged. Readiness safeguards14 pass; live readiness retains twelve services, idle worker/jobs0 and the original2 requests/2 files/2 reports/1 questionnaire. Scanner stays stopped/stale, no current engine proof or definition access is implied.

Repeat bounded checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-admin-schedule-read.ps1
node --test scripts/media/check-demo-readiness.test.mjs
node scripts/media/check-demo-readiness.mjs
```

The runtime proof writer refuses an existing evidence path. Inspect its accepted proof instead of overwriting or replaying it.

## Compatibility, rollback and next slice

No schema, dependency, environment or shared scheduling/booking/doctor-write behavior changed. Existing API payloads and accepted panel routes remain compatible. A reviewed source rollback may remove only the four new read routes/import and the new reader; preserve all other dirty route changes and every record. No migration/backfill/reset is needed. Keep admin43f3 and its existing0748 UI rollback available; static rollback is unnecessary for this source-only slice.

Next: connect the two proposed schedule pages once their exact canonical URLs/sidebar/composition are approved, accept EN/Farsi reads/refusals/current deployed artifact, then implement separately verified guarded slot controls under the approved composition. Positive live saves remain a separate synthetic checkpoint; the user-owned profile-save rehearsal stays deferred. Payment/settings/dashboard follow in the existing order. No new worker/scanner activation or closed-demo replay is authorized by these readers.
