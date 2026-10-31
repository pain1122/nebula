# Velzon Role Panels And Booking Candidate — October 4, 2026

## Status

The user selected the existing Velzon React 18/Bootstrap panel for authenticated patients, doctors and admins. Required Blade workflows are being migrated into that framework. Public SEO/subscription pages are excluded from the demo.

This first booking presentation slice is implemented, deployed and verified through the real browser. The user rebuilt/recreated admin on October 4; static health, artifact freshness and functional acceptance are recorded separately below. The full business golden flow remains open, with deterministic sandbox payment next.

## Delivered Candidate

| Role | Landing and screens | Access boundary |
| --- | --- | --- |
| Patient | `/panel/book`, `/panel/my/reservations` | Checkup → doctor → eligible workplace → available public slot; create a pending/unpaid hold and view only own reservations |
| Doctor | `/panel/doctor/reservations` | View assigned reservations, booked money, payment state and pending hold expiry |
| Admin | Existing `/panel/` and `/panel/users` | Existing admin capabilities and backend policies remain authoritative |
| Root admin | Existing admin screens and lazy `/panel/dev/*` | Developer Toolbox remains root-only; System remains inert |

Shared login now accepts supported patient/doctor roles and sends each role to its landing. Unauthorized routes return to that role's landing. Menus derive from the existing manifest; no separate auth client, store, query service or UI stack was added. The original home still displays ecommerce fixtures rather than business reporting.

Booking uses the existing transport and RTK Query service. Writes retain CSRF and send only `slot_id` plus an `Idempotency-Key` header; uncertain outcomes permit a manual retry with the same key. Selection changes reset dependent choices and that key. Credentials never enter Redux arguments. Existing identity/role/logout cache clearing also covers the new queries.

The API now exposes only eligible workplaces for doctor discovery, offset-aware slot timestamps, and reservation public ID, immutable booked amount/currency and hold expiry for the existing scoped lists. The server retains ownership, eligibility, conflict, price, hold and payment authority. Booking creates a pending/unpaid reservation; it does not simulate paid/confirmed state.

English and Farsi labels use the existing flag and product date/number formatters. New screens use existing Velzon cards, forms, tables, feedback, breadcrumbs and icons. No stylesheets, logos, assets, dependencies or Blade inventory were removed or replaced. Broader RTL visual acceptance remains open.

## Fresh Verification

- Full `npm.cmd run quality`: **48 files / 254 tests pass**; typecheck, governed lint, lint fixtures, unchanged debt ratchets and formatting pass. Final test duration: 27.70 seconds.
- Additional lint for booking pages, registry/menu and route guards passes. Patient booking tests cover both languages, slot-only submission, idempotent manual retry, dependent selection reset and the doctor-only list. Role/auth/route/menu tests cover landing and access denial.
- Docker-equivalent reference build with backend origin `http://localhost:8080`, empty optional API base and explicit fa/en defaults: **passes in 5.26 seconds**. Windows-local chunks include `PatientBooking-LjdXTZy8.js`, `PatientReservations-O5aS8WJT.js`, `DoctorReservations-B26_oG48.js` and `ReservationList-glAGYRY_.js`; platform import hashes may differ. The earlier 5.48-second build passed compilation, but PowerShell removed its empty API-base environment variable and Vite loaded the existing 127.0.0.1 value. Corrected only the local verification invocation to set the empty value inside Node; the deployed Docker configuration was already correct. No product configuration/source change or further image rebuild was needed.
- Backend focused checks: **16 tests / 70 assertions pass** for `DeclaredVisitSlotTest`, `BookingPaymentRiskTest`, `ListingFilterSortTest` and `LocalReservationDebugRouteTest`. Run as `www-data`, explicit testing/SQLite `:memory:`, array cache/session; Pint passes on the two affected PHP files.
- Backend tests cover eligible-workplace discovery and booked-money preservation after catalog price changes alongside the existing booking/payment/ownership protections. The unauthenticated local debug export remains removed.
- The existing backend services are running following the user's start command; static admin is healthy. Isolated source checks did not write live business data. Subsequent browser acceptance created one ordinary demo reservation, documented below. No data reset/reseed/migration, worker/scheduler start or credential replacement occurred. Verification patient accounts 7/8 remain untouched.

The full test run initially reproduced the retained editor's five-second import timeout under four jsdom workers; the editor passes in isolation. Reducing concurrency to two resolves the full run without changing assertions, deadlines or debt budgets. Existing browser-data, retained style and large-chunk warnings remain; no dependency update is inferred.

## Deployed Acceptance

- Admin image: `sha256:77eeab38f407d197fc1b8be82c0c8a4079b30b28dc1bed5557bfad7e3a9f4187`, running and healthy. Development app/nginx/db/Redis remain running.
- Served entry: `/panel/assets/index-D4l3s26a.js`. Entry, transport and all four booking/reservation chunks match the reference build after platform import hashes are normalized. Compiled transport uses localhost:8080 with the empty optional API base. Raw evidence: [static/artifact checks](evidence/demo-role-booking-static-2026-10-04.json).
- Canonical redirects preserve port 3000, patient/doctor/admin deep links refresh, referenced assets return 200 with immutable caching, missing assets/outside paths return 404, and gzip decodes to the original bytes. Initial linked JS/CSS gzip bodies total **363,532 bytes**; this verifies delivery, not new interaction latency budgets.
- Real Chrome acceptance covers patient form login/landing, existing-flag English/Farsi labels and direction, patient-only menus, backend admin/doctor 403s, booking, own list, refresh, forbidden route fallbacks and controlled JSON logout. Assigned doctor sees the new reservation and booked money; the other doctor and second patient cannot see it. Admin directory remains available, normal admin cannot access patient/toolbox screens, root can access the lazy toolbox, and guests cannot open private routes. No uncaught exceptions, external HTTP requests or read preflights were observed in the final matrix; credential storage keys are absent. Raw evidence: [browser checks](evidence/demo-role-booking-browser-2026-10-04.json).
- Created reservation **7**, public ID `01m436vzctnm8baezk2b3w7vtr`, for existing seeded patient **4** and assigned doctor account **5** (doctor profile 2), checkup 5/workplace 3. The UI submitted only the selected slot ID with CSRF and an idempotency header. Persisted booked amount is **7,000,000 IRR**; state remains **pending/unpaid**. Slot starts **October 11 at 08:00 Asia/Tehran**, and the initial hold expires **October 4 at 14:50:34 Asia/Tehran**. Do not treat this historical hold as permanently payable or complete a future appointment early.
- Patient accounts 7/8 were not modified; reservation ID 7 is a different entity. No payment, fake confirmation, cancellation, completion or medical state was manufactured. The created reservation remains in the demo database.
- The first matrix completed patient/doctor/isolation checks but its helper incorrectly required a trailing slash on the admin SPA landing. Corrected the helper to accept `/panel` and `/panel/`, then completed admin/root checks and repeated the full read-only role matrix against the same reservation. No second reservation was created. The prior partial evidence is retained in [the partial matrix](evidence/demo-role-booking-browser-partial-2026-10-04.json); the final matrix records 17 checks including the original creation evidence.

## Completed Deployment Commands

The user successfully ran these in the workspace, second command after the first:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml build admin
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps admin
```

Docker builds/Compose remain user-run under the original request. Bind-mounted PHP changes require no backend image rebuild. Preserve the development backend and the separate hazelnut stack.

These deployment and browser gates now pass for this bounded slice. No further frontend rebuild is pending. Broader RTL visual review and new-screen performance measurement remain part of final demo stabilization.

## Next Boundary

Continue with deterministic sandbox payment through the existing lifecycle service, then private medical request/upload/scan/review/publication/outcome and the fixed questionnaire. Worker/scheduler execution remains unverified and must be addressed where required. Preserve time-correct completion and the accepted earlier local-demo warm-up/latency limitation; the earlier performance evidence does not certify new role screens.

Related evidence: [approved golden flow](demo-golden-flow-2026-10-04.md), [initial booking discovery](demo-booking-readiness-2026-10-04.md), [earlier demo performance acceptance](demo-readiness-2026-10-02.md).
