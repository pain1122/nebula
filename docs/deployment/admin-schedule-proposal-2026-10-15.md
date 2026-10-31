# Schedule administration: proposed panel routes and controls

**Approved October15:** the user explicitly selected “Approve the proposed schedule routes and controls,” covering both URLs, retained read-only pages/navigation and the stated bounded slot-control modal across verified slices. Do not request this approval again. Successful live saves remain separate.

The user authorizes schedule administration after catalog completion. The October11 feature-coverage proposal explicitly reserves exact additional schedule URLs and controls for proposal before wiring. This document defines that narrow composition decision; backend read foundations can proceed under the existing feature authorization.

| Page | Proposed canonical URL | Retained composition |
| --- | --- | --- |
| Schedules | `/panel/schedules` | Admin/root Product Admin sidebar entry, existing server table, search/doctor/hospital/service/state filters, refresh/reset and paged workplace rows. |
| Workplace schedule | `/panel/schedules/workplaces/:workplaceId` | Existing numeric workplace ID; reservation-style cards for safe doctor/hospital/service metadata, paged recurring rules/breaks and bounded dated slots. Back retains workplace-list filters. |

Use the original React18/Bootstrap/Velzon shell, table, DetailBox cards, form fields and dialogs. English/Farsi labels and existing flag-owned direction remain. No new stylesheet, library, schema or alternative calendar stack. Presentation stays separate from server adapters to accommodate the client's expected later UI refactor.

First wire read-only pages. Doctor and hospital filters use existing server-owned identities. Rules include checkup, weekday/local working hours, duration, effective dates, optional price/currency and breaks; historical inactive rules remain readable. Slots use the hospital timezone, offset-aware timestamps and exact price/currency strings, bounded local date ranges and server pagination. Separate enabled state, future time, blocking reservation and historical reservation use; none alone is a booking promise. Do not expose patient identities, clinical contents, doctor contact/credentials or internal notes.

The proposed subsequent control composition is an explicit selection plus retained modal for price/active-state changes to an occurrence or bounded day/week of one workplace/service. Preview exact server-owned eligible targets and exclusions; require fresh actor-bound revision, active authority, reason, confirmation and recent password, with atomic audit, cancellation and ambiguous-delivery-safe refresh. Preserve reserved slots and all booking/payment snapshots. Admins act as themselves, never impersonate the doctor. Source and isolated acceptance precede activation; live successful saves stay separate. These controls are not delivered by the read-only slice.

No automatic materialization, scheduling sweep, worker/scheduler startup, bulk deletion, time/currency/owner reassignment, weekly-rule replacement, hospital/workplace editor or patient booking change is included in this composition approval. Such follow-ups require their own concrete scope when needed. Existing booking/reschedule services remain authoritative and current guards stay enforced.

Approval is required before wiring these two canonical URLs, sidebar and page/control composition because AI_BOOT.md explicitly reserves approval for canonical `/panel/*` URLs and navigation/page composition/component UX. The broad feature authorization and already approved catalog routes do not supply these two schedule URLs. No repeated permission is needed for the authorized backend read contracts or their isolated/read-only verification.
