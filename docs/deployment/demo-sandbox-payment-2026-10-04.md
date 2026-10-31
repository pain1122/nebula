# Local Sandbox Payment Candidate — October 4, 2026

## Status

The approved minimum golden flow has a deployed, browser-accepted local sandbox checkout. It uses the existing Velzon patient reservation screen, shared Dialog/fields/feedback, query service and CSRF transport. Backend PHP is bind-mounted and the live environment reports local sandbox enabled. After the user's October 5 resume and backend start, real failure/retry/success and persisted canonical payment/doctor-state acceptance pass. October 4 source/static checks below remain historical evidence; no product code or image changed during acceptance.

The previous role/booking candidate is already deployed and accepted: [booking acceptance](demo-role-booking-2026-10-04.md). Its reservation 7 initially expires October 4 at 14:50:34 Asia/Tehran; check the actual hold before using it. Never extend/backdate it or claim a future appointment is complete. The full medical/questionnaire/final walkthrough remains open.

## Behavior And Authority

- An eligible patient reservation offers **Pay in sandbox**. The shared Dialog identifies demo payment with no real charge, shows booked amount/currency and hold expiry, starts checkout, then lets the presenter choose success or failure. English/Farsi are paired; the existing flag owns direction.
- Backend `can_sandbox_checkout` controls availability. Checkout requires an active authenticated patient who owns the reservation. Other patients receive 404; doctors/admins cannot call these patient endpoints. Nested public-ID binding scopes attempts to the reservation, and only sandbox attempts can complete here.
- `LocalSandboxPaymentGateway` is enabled only in local/testing with a nonempty application key and the opt-out `DEMO_SANDBOX_PAYMENTS` flag. Production remains blocked even if the flag is true. This is an internal deterministic provider simulation, without an anonymous provider webhook, SDK, external charge or new infrastructure.
- Checkout uses `PaymentLifecycleService::createAttempt`; the browser supplies an idempotency header, and the backend derives the provider-scoped identity from the reservation plus that key. Amount/currency and expiry come from the existing summary/hold. Retry preserves the attempt; no retry extends the hold.
- The result endpoint accepts only a validated success/failure choice as its operational input. Trusted amount, currency, provider, owner, event, reference and signature fields are prohibited. The server builds an attempt-bound receipt, signs it with a purpose-separated HMAC derived from the existing application key, and passes it through `PaymentLifecycleService::processCallback`, including actual signature verification. Signatures/keys never enter response data, Redux or browser storage.
- The adapter locks summary, reservation and attempt in the lifecycle's order before processing. The first terminal result is immutable: duplicate/reversed outcome requests cannot downgrade a canonical success or revive a failed attempt. A failed payment stays unpaid/pending and permits a new attempt while the hold remains live; late or competing success follows existing reconciliation rules.
- Successful callback processing selects the canonical succeeded attempt and actually persists paid/confirmed states. The frontend refreshes scoped reservation queries and clears the older payment-required creation notice. It does not mark paid locally. Ordinary appointment completion still requires the appointment to have started.

## API And Source

| Method | Patient-owned path | Operational input |
| --- | --- | --- |
| POST | `/api/reservations/{reservation:public_id}/sandbox/checkout` | `Idempotency-Key` header; no trusted payment fields |
| POST | `/api/reservations/{reservation:public_id}/sandbox/attempts/{attempt:public_id}/complete` | `{ "outcome": "success" }` or `failed` |

Both endpoints retain session/CSRF, active-account, patient-role and throttling middleware. Checkout results are allowlisted attempt/reservation/payment states, server amount/currency, hold expiry and completion availability.

Source: `app/Services/LocalSandboxPaymentGateway.php`, `LocalSandboxPaymentService.php`, `app/Http/Controllers/Api/LocalSandboxPaymentController.php`; the reservation-attempt relation, scoped API routes, demo flag and patient list availability field; `frontend/src/pages/Booking/SandboxCheckout.tsx`, `ReservationList.tsx`, shared booking API and paired locale catalogs. The existing payment lifecycle implementation is unchanged. No dependencies, providers, schema, workers, credentials, topology or stylesheets changed in this slice.

## Fresh Source Verification

- Full frontend quality: **48 files / 260 tests pass**, 27.93-second test run; typecheck, lint, lint fixtures, unchanged debt ratchets and formatting pass. Additional booking-page lint and final page/API/locale formatting pass.
- Booking/checkout focused tests: **11 pass**, including both languages, real query refresh after success, removal of the stale creation notice, manual retries retaining checkout identity/attempt, failure followed by a new attempt, server-disabled checkout and doctor-only presentation.
- Docker-equivalent reference build: **5.41 seconds**, localhost:8080 origin, empty optional API base and explicit fa/en defaults set inside Node to avoid PowerShell empty-variable fallback.
- Backend focused tests: **31 tests / 190 assertions pass** in 13.51 seconds, as www-data with testing/SQLite `:memory:` and array cache/session. Includes 11 new sandbox API/signature/rollback/canonical-result tests plus existing payment lifecycle, booking risks, slot/discovery/snapshot, sorting and debug-route regressions. PHPUnit result caching is disabled for this run; no root-owned cache repair was performed.
- Pint passes on eight affected PHP files. Source formatting and `git diff --check` pass. Live read-only probe reports environment `local` and sandbox gateway enabled; no live checkout was executed.
- Repeated callback/attempt tests are functional in-memory evidence. Existing historical MySQL lock-contention foundations are preserved; this slice does not claim a fresh MySQL concurrency run or production payment guarantee.

## Deployed Artifact And Wrap-Up

The user completed the admin-only commands successfully. Image `sha256:8c8bb2e4b5b4ee40c4f593f6d6392ecbb0118fef570c2889bc27fc62265d9f64` is running/healthy, with entry `/panel/assets/index-KZt7P-Va.js`. Entry, transport and booking/reservation chunks match the reference source after platform import hashes are normalized. Redirects, deep links, asset caching, 404s and gzip body equality pass; initial linked compressed JS/CSS totals 364,139 bytes. Raw evidence: [static checks](evidence/demo-sandbox-payment-static-2026-10-04.json). Existing booking evidence was preserved separately.

Those October 4 checks established deployment freshness and static serving; payment acceptance was paused then. The user resumed October 5, and the functional evidence below completes this bounded sandbox slice. No further rebuild is needed.

## October 5 Runtime And Functional Acceptance

- User-run Compose start restored the existing app/nginx/MySQL/Redis. All five Checkupino containers run with zero restarts; admin is Docker-healthy. Development services have no Docker healthcheck, so readiness is established separately by both HTTP health endpoints returning 200 and Laravel's www-data MySQL/Redis probes. Local sandbox is enabled. [Runtime evidence](evidence/demo-runtime-health-2026-10-05.json).
- Historical reservation 7's expired hold correctly rejects a new checkout with 422. One new booking was created through the actual patient UI: **reservation 8**, public ID `01m44ah0fxjqz5mbpbabe1qj44`, patient account 4, assigned doctor account 5/profile 2, checkup 5/workplace 3, **7,000,000 IRR**. The selected appointment remains October 11 at **08:00 Tehran**; its original hold expiry was October 5 at **01:13:43 Tehran**. No hold extension, backdating or early completion was used.
- Farsi checkout failure leaves the booking pending/unpaid. A new English checkout attempt succeeds through the signed lifecycle and persists confirmed/paid. Reversing the failed attempt does not revive it; duplicate/reversed successful results retain the canonical success. The paid list removes the Pay action and stale creation notice; Farsi paid state survives deep-link refresh.
- Assigned doctor sees the confirmed/paid snapshot and has no checkout action. Other doctor/patient sessions cannot see it; another patient's result write returns 404. Controlled logout is acknowledged between roles. Writes retain CSRF, result bodies contain only outcome, browser storage has no credential keys, and no uncaught exceptions or unexpected/external network failures were observed. [Browser evidence](evidence/demo-sandbox-payment-browser-2026-10-05.json).
- MySQL inspection ran as www-data in an explicitly read-only transaction and rolled back. It confirms two attempts (failed ID 4, succeeded ID 5), one canonical successful attempt, two signature-verified/processed provider events and exactly three retained pending outbox intents: one reservation-created and two attempt-requested. Replays added no provider events or attempts and money/expiry remain unchanged. The temporary private probe was removed. [Database evidence](evidence/demo-sandbox-payment-database-2026-10-05.json).
- Verification resumed the same booking after the helper initially checked the Pay action before query refresh completed. The helper also now waits for acknowledged logout before navigation. [Retained partial evidence](evidence/demo-sandbox-payment-browser-2026-10-05-partial.json) preserves the first interrupted run; no duplicate booking or product fix was needed. The original client idempotency key was intentionally absent from saved evidence and unavailable after helper exit: same-key HTTP checkout replay was not repeated in this deployed run. Existing source tests cover it; the retained derived identity was separately verified through PaymentLifecycleService in the read-only transaction, returning the same attempt without another attempt/outbox intent.

This accepts local sandbox payment, without real money movement. Worker/scheduler execution remains unverified and outbox intents stay pending; no asynchronous-delivery claim is made. Medical request/private upload/actual scan/review/publication, the fixed questionnaire, time-correct appointment completion and the repeated final golden walkthrough remain open. Protected patient accounts 7/8 were untouched; reservation ID 8 belongs to patient account 4.

## Completed Deployment Commands

The user owns Docker builds/Compose and successfully ran these in the workspace, second after the first:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml build admin
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps admin
```

No further backend/admin rebuild, database reset/migration/reseed, worker start or credential change is needed for this accepted slice. Retain the live booking/payment history; recheck future fixture timing and validity before the next walkthrough. Protected patient accounts 7/8 remain untouched.

Related plan: [approved golden flow](demo-golden-flow-2026-10-04.md). The existing local-demo warm-up/latency exception remains documented; new-screen timings and broad visual/RTL review are part of final stabilization, not certified by these source tests.
