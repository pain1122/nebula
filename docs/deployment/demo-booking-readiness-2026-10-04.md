# Golden-Flow Booking Readiness

Date: 2026-10-04 (Asia/Tehran). Inventory sampled at 2026-10-03T21:26:30Z. Scope: the first slice of the [approved minimum golden flow](demo-golden-flow-2026-10-04.md). Source/fixture/runtime discovery is complete, with one discovered privacy defect repaired. Runnable booking presentation and the end-to-end golden flow remain open.

## Runtime And Existing Fixtures

The development app/nginx/db/Redis containers were stopped with exit 255 while the standalone admin was healthy. The user started only the existing development services. Afterward all five Checkupino containers were running, in their original projects, with restart counts zero. No rebuild, migration, cache reset, data reset, reseed or topology change was performed.

Laravel boot and DB SELECT pass as www-data; Laravel Redis PING succeeds. Inventory queries ran inside a MySQL READ ONLY transaction followed by rollback. No names, emails, credentials or medical content were read for this inventory.

| Existing fixture | Observed |
| --- | --- |
| Active accounts by role | 1 root admin, 1 admin, 2 doctors, 4 patients |
| Verified doctors | 2 |
| Active checkups | 6 |
| Workplaces / workplace-service links | 3 / 8 |
| Recurring rules / persisted slots | 8 / 130 |
| Future active slots | 62 |
| Eligible offerings with a free slot in the next 7 days | 8; each has one free slot in this sample |
| Reservations / payment summaries | 6 / 6 |
| Reservation states | 1 cancelled, 1 completed, 1 confirmed, 1 expired, 2 pending |
| Payment states | 2 paid, 4 unpaid |
| Fixed questionnaires | 1 |

No new fixture setup is required merely to discover a bookable offering. A concrete candidate is doctor 2/workplace 3/checkup 5, with an available slot on October 4 at 08:00 Tehran (04:30Z); checkup 6 has 09:00 Tehran (05:30Z). These are dated observations, not reserved slots. Recheck availability before presenting. Inspect the fixed questionnaire's suitability and fixture account access before final selection.

For a single booking-to-completion story, rehearse booking/payment shortly before the selected appointment starts, then perform completion only after that start. Respect the normal one-hour unpaid hold. Do not backdate patient bookings, alter the runtime clock, disable expiry or bypass paid/confirmed/start requirements. Presentation scheduling or documented additive fixtures may be needed once the actual demo time is known; neither has been changed here.

The queue driver is database. `docker top checkupino_app` shows only PHP-FPM master/workers, with no queue worker or scheduler process in that container. Development Compose declares neither service. `schedule:list` confirms hold expiry every minute and slot materialization daily at 00:05 are registered; this does not prove execution. Two pending holds are already overdue. Their state is preserved; external scheduling/worker execution is not established. Decide a scoped runtime arrangement before accepting asynchronous behavior.

## Source And Presentation Gaps

Existing Blade routes provide checkup -> doctor/workplace -> time selection -> booking -> own reservation list. API equivalents exist. Both controllers delegate creation to BookingService; persisted slot facts own price, currency, identity, timing and reservation/payment snapshots. Availability reads existing slots and does not materialize new ones.

| Gap | Required bounded action |
| --- | --- |
| Patient/doctor presentation choice | Resolved by the subsequent user instruction: all authenticated roles use specific versions of the established Velzon React/Bootstrap panel. Relevant Blade/resources workflows migrate there. Public SEO/subscription pages are excluded; no separate demo client or temporary Blade interface is selected. |
| Booking discovery through APIs | Doctor-list response contains no eligible workplace choices, although availability needs explicit workplace selection when multiple offerings exist. Add only the required discovery contract if an API client is selected; Blade already renders eligible workplaces. |
| Booking context | Blade POST binds checkup/doctor in the URL but creation uses only slot_id. Verify that the submitted slot matches the displayed selection and provide recoverable stale/conflict feedback; retain server authority. |
| Price and state presentation | Checkup cards show catalog price with hardcoded IRR; actual slots can carry resolved overrides/currency. The Blade reservation list shows neither snapshot price nor payment status/hold expiry. API nested checkup price is the current catalog price, while payment amount/snapshots represent booked money. Present authoritative booked facts. |
| English/Farsi | Root locale is en, no application Farsi catalog exists, and the Blade app layout hardcodes dir=rtl. Existing booking labels and raw status/error tokens are not complete bilingual presentation. Establish locale-owned direction and a bounded language control for the selected surface without silently redesigning the admin flag or geometry. |
| Root assets | Root Vite manifest exists and no hot file exists. Actual patient/doctor asset freshness and authenticated browser behavior remain to be verified. The Blade layout requests external Bunny fonts, separately from the already-isolated static admin. |
| Payment and medical continuation | Runnable sandbox checkout/callback and patient/doctor medical presentation/scan integration remain required in their subsequent slices. No paid-state or clean-file shortcut is permitted. |

## Privacy Fix And Verification

Local routes previously registered unauthenticated `/debug/res-last`, returning the latest reservation with user, doctor/user and checkup relations. This exposes unrelated records outside ownership/policy/safe-resource boundaries in the actual local demo environment. The endpoint was removed; no business route was renamed and no retained UI/assets were deleted. The read-only probe did not fetch its private response.

A regression boots local-only route registration while retaining explicit testing/SQLite :memory:. Before the fix, the expected 404 assertion fails with 500 because the old endpoint attempts a reservation query against the deliberately empty isolated database. After removal it returns 404 without needing database records. This test intentionally uses local route bootstrapping so the usual testing environment cannot hide the defect.

- Focused local-route/declared-slot/booking-risk tests: **12 tests, 45 assertions pass** (15.18 seconds), executed as www-data with explicit isolated testing settings.
- New regression passes Pint; routes/web.php passes PHP syntax validation.
- Actual unauthenticated JSON HTTP checks: `/debug/res-last` **404**; `/api/auth/me`, `/api/checkups`, `/api/my/reservations` **401**.
- Actual backend `/healthz` and static-admin `/panel/login`: **200**. Guest Blade `/book` and `/my/reservations`: **302**, consistent with auth middleware; authenticated booking has not been browser-accepted here.
- No live business records, patient IDs 7/8, credentials, cache or scheduled jobs were changed. Backend source is bind-mounted, so this fix needs no image rebuild. Frontend source/artifact is unchanged; earlier quality/performance evidence remains its last measured checkpoint.

Next: implement and verify/deploy patient booking/own reservations and doctor assigned reservations in the selected Velzon panel, then move to sandbox payment. The table's API/money/locale entries record discovery findings before this implementation; new source/deployed acceptance must be recorded separately. Final multilingual/visual/runtime/complete-walkthrough acceptance remains open.
