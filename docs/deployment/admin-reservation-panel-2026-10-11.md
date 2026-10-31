# Admin reservation panel — first approved administration slice

The October 11 routes/navigation and retained Velzon composition are approved in [the coverage proposal](admin-feature-coverage-proposal-2026-10-11.md). Admin/root-admin now have **Reservations** in Product Admin, `/panel/reservations` and numeric `/panel/reservations/:reservationId`. Presentation/adapters remain separate from service rules for the client's expected UI refactor. The subsequent explicitly requested [grouped detail boxes](admin-reservation-boxes-2026-10-11.md) replace the long detail layout on650041b9; this report retains the preceding e375 acceptance/rollback and the new report records the observed shell-overlay visual limitation.

## Accepted behavior

- Read-only server list/detail, exact reservation numeric/public reference and patient name/email/doctor/specialty/checkup search, stable sorting, pagination (20 default/100 cap), manual refresh and clear filters.
- Doctor **profile** ID, patient **user** ID, workplace/checkup, appointment/payment state and inclusive Tehran date filters compose. Clicking a displayed doctor/patient opens their filtered reservations; name lookup pickers and dedicated operational profiles follow in later slices.
- Today, Upcoming, Awaiting payment, Paid, Completed, Cancelled and Reconciliation presets map to visible server filters. Applying a preset retains identity/search/page-size scope, resets the page and clears conflicting date/status/payment filters. Upcoming uses the server clock and only pending/confirmed appointments; Today uses Tehran's calendar day.
- URL-owned filters survive refresh/detail/back. Detail shows booked amount/currency snapshots, canonical payment summary, patient/doctor/checkup/workplace and lifecycle timestamps. It never substitutes a changed catalog price for the booking price.
- English/Farsi controls, accessible labels, keyboard detail entry, flag-owned direction and retained Bootstrap responsive table/card geometry. No stylesheet, dependency or schema addition.
- Typed response validation rejects missing booked facts, malformed IDs/states/times/money, reversed appointment times, oversized/duplicate pages and mismatched detail identities; undeclared fields are dropped. Current rows disappear during fetching/errors so an old result is not presented as a fresh filtered result. Invalid date order/overlong search prevents fetching and shows corrective feedback.

This is the reservation **read** slice. Medical contents/permissions/actions, reservation reschedule/root overrides, questionnaire administration, doctor/patient operational pages, activity and real product dashboard remain open. The ecommerce fixture dashboard remains until the measured dashboard slice replaces it. No menu-only or container-only claim of complete administration is made.

## Verification and deployed candidate

- Isolated network-none UID33 PHP/SQLite gate: **7 tests/112 assertions**, including existing admin/root/non-admin contracts, preserved read fingerprints, composed filters, exact IDs, Tehran boundary and server-clock presets. Pint:2 files. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-admin-reservations.ps1`.
- Full frontend quality: **55 files/429 tests**, typecheck/lint/fixtures/format; ratchets unchanged **2515 any/10 ambient/40 legacy Apex/0 undeclared**. Supplemental lint of both new pages/registry passes. The first full run found expected route/menu assertion changes and a retained editor timeout; updated assertions and subsequent full gate pass without relaxing the timeout.
- Fourteen Node readiness safeguards pass, including reviewed successor/rollback selection and rejection of missing/failed/mismatched rehearsal, changed clinical fingerprints and unbounded/duplicate asset manifests.
- Existing delegated static-admin-only Compose config/build/recreate succeeds. Cached dependencies were reused; no backend/worker/scanner build or activation. Candidate **`sha256:e3759db81de7060b4a39c5c97930e68adf1398fb3e06ace02203d2967a70122f`**, retention tag **`checkupino-admin:admin-reservations-accepted-2026-10-11`**.
- Entry `/panel/assets/index-BYO7Zzom.js`; **36 served assets** match container bytes, compression and immutable-cache behavior. Admin deep links, prior golden-flow routes/markers, lazy retained File Manager CSS, redirects and404 checks pass. [Exclusive static proof](evidence/admin-reservation-static-2026-10-11.json).
- **11 live read-only browser groups** pass for synthetic admin2/root1 and patient4/doctor5: composed API/preset/date refusal/booked price; ENFA list/detail/keyboard/refresh/back; quick filters/reset/mobile; route/navigation/API denial.81 API requests, only GET/OPTIONS and ordinary login/logout; no business write, blocked request, external endpoint or browser exception. [Exclusive browser proof](evidence/admin-reservation-browser-2026-10-11.json).
- The first browser attempt focused a row while refresh intentionally cleared it. The harness now waits for the fresh response and completed refresh; product code was unchanged. Its failed proof remains alongside acceptance and records unchanged clinical/protected fingerprints; no historical proof was overwritten.

[Source/runtime successor proof](evidence/admin-reservation-panel-2026-10-11.json) binds the reviewed source and new served/browser evidence. Historical reservation contract6/104 and admin8db6aa7e proofs remain untouched.

`node scripts/media/check-demo-readiness.mjs` now recognizes this accepted successor through **both** its static and11-group role rehearsal proofs while retaining the original completed-story fingerprints. It reports `admin_reservation_panel_ready: true` on this candidate and false on the prior rollback; that flag covers this read slice only. Its own existing-history/fresh-pipeline/fresh-upload semantics and scanner cooldown/exact-job safeguards remain unchanged. Twelve services run, worker sleeps, jobs0; scanner stays stopped until the latest cooldown and subsequent supported recovery/current real probe. No scanner probe or updater retry occurred in this slice.

## Source and rollback

Owned UI: `frontend/src/pages/Reservations/AdminReservations.tsx`, `AdminReservationDetail.tsx`, `frontend/src/modules/checkupino/reservations/admin.ts`; lazy registry/manifest and paired locale keys. Existing `AdminReservationController` gets only additive period/generated-time reads; old fields/endpoints remain. No medical policy/service mutation was added.

Prior accepted image `checkupino-admin:demo-completion-controls-accepted-2026-10-11` remains **8db6aa7e**. To roll back this UI only, from the project root:

```powershell
if (Test-Path Env:CHECKUPINO_ADMIN_IMAGE) { throw 'Image override already exists; inspect it before proceeding.' }
$env:CHECKUPINO_ADMIN_IMAGE = 'checkupino-admin:demo-completion-controls-accepted-2026-10-11'
try {
    docker image inspect $env:CHECKUPINO_ADMIN_IMAGE --format '{{.Id}}'
    if ($LASTEXITCODE -ne 0) { throw 'Accepted rollback image unavailable.' }
    docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Rollback configuration failed.' }
    docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps --no-build --pull never admin
    if ($LASTEXITCODE -ne 0) { throw 'Admin rollback failed.' }
} finally {
    Remove-Item Env:CHECKUPINO_ADMIN_IMAGE -ErrorAction SilentlyContinue
}
node scripts/media/check-demo-readiness.mjs
if ($LASTEXITCODE -ne 0) { throw 'Read-only rollback checkpoint verification failed.' }
```

Wait for the ordinary admin health check before the final command if still starting. This removes the new UI access without changing rows/audits/policies/clinical history or the backend compatibility fields. Source rollback must preserve unrelated dirty edits; never reset the whole controller/tree. Static/browser acceptance writers intentionally refuse an existing success proof; inspect accepted JSON instead of replaying them. Repeatable read-only readiness remains the routine operator check.
