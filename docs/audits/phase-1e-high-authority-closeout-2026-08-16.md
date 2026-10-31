# Phase 1E High-Authority Closeout

Date: 2026-08-16

Scope: corrected Phase 1E item 20 only. This report does not authorize Phase 2/Vite work, a credential-delivery provider, MFA, bulk mutations, or tenant-local product behavior.

## Outcome

The remaining named high-authority gaps are implemented and green on SQLite. Admin identity creation no longer has a shared fallback password. Admin identity and catalog mutations now have explicit policy, recent-password, reason, transaction, and fail-closed audit boundaries. A route-level regression fixes the privileged mutation inventory and rejects speculative bulk routes.

The user-confirmed clean full disposable-MySQL suite passes. The later documentation/Working Mode reconciliation also passed, so all items before Phase 2 are closed. Overall evidence is `docs/audits/phase-1-verification-gate-2026-08-16.md`; this report remains scoped to item 20 and does not claim Phase 2 implementation.

## Approved Credential Contract

The root administrator controls the final initial password. A future admin-panel popup may suggest a memorable passphrase, but it must:

- generate locally with `crypto.getRandomValues`, never through a backend suggestion endpoint;
- choose at least six uniformly random words from a reviewed local wordlist while remaining within the backend limit;
- allow regeneration and manual override by the root administrator;
- avoid telemetry, persistence, automatic clipboard writes, API responses, and audit/log fields containing the suggestion;
- submit only the final password plus confirmation over the authenticated TLS session.

The implemented backend requires 15-64 characters, confirmation, and a local common/account-context rejection rule. It hashes the final value before persistence and never returns or audits it. The general admin-user update endpoint prohibits credential changes; password reset/change retains its own existing boundary.

This is a strong Phase 1 baseline, not a claim of complete production password compliance. NIST emphasizes length, blocklists, rate limiting, and usability over composition rules; OWASP also recommends breached-password screening and MFA. A production breached-password corpus/provider and MFA require a later explicit decision. No external password provider was silently selected.

References:

- NIST SP 800-63B: https://pages.nist.gov/800-63-4/sp800-63b.html
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

## Mutation Evidence Matrix

| Mutation family | Policy/authority | Reason | Transaction and fail-closed audit | Route step-up | Primary regression |
| --- | --- | --- | --- | --- | --- |
| Admin identity create/update | `UserPolicy` plus `AdminIdentityService`; only root can touch admin identities; root identities remain inaccessible | required when creating, promoting, updating, or demoting an admin identity | user/role mutation and allowlisted audit share one transaction; create and update rollback tests | yes | `AdminIdentityCredentialTest`, `AdminAuthorityBoundaryTest`, `AdminUserAuditTest`, `AdminUserStepUpTest` |
| Account state | `UserPolicy::changeAccountState` and `AccountStateService` | required | locked state/session/token mutation plus audit; rollback/fail-closed session-driver tests | yes | `AdminAccountStateTest`, `AccountStateServiceTest` |
| Doctor verification | `DoctorProfilePolicy::verify` | required | locked profile verification and audit; rollback test | yes | `DoctorVerificationSecurityTest` |
| Questionnaire and submission archive | questionnaire/submission policies | required | nested writes or soft archive plus audit; rollback and sanitization tests | yes | `AdminQuestionnaireSoftDeleteTest`, `QuestionnaireRichTextSanitizationTest`, `QuestionnaireRecommendationValidationTest` |
| Rating option administration | `ReservationRatingOptionPolicy` | required | create/update/soft archive plus allowlisted audit | yes | `ReservationRatingOptionTest` |
| Tenant registry, features, and marketplace settings | root-only policies inside the three owning services | required | row locks, validation, audit/outbox as applicable; rollback tests | yes | `MarketplaceControlApiTest`, `TenantRegistryServiceTest`, `TenantFeatureOverrideServiceTest`, `MarketplaceSettingServiceTest` |
| Reservation status/schedule override | `ReservationPolicy` inside `ReservationOverrideService`/`ReservationRescheduleService` | required | locked reservation/payment/slot/history mutation and audit; rollback tests | yes | `ReservationOverrideServiceTest`, `ReservationRescheduleServiceTest`, `BookingPaymentRiskTest` |
| Payment adjustment request | `PaymentPolicy::requestAdjustment` inside `PaymentAdjustmentService`; root only | required | locked canonical payment facts, pending adjustment, and audit; rollback test | yes | `PaymentAdjustmentApiTest`, `PaymentAdjustmentServiceTest` |
| Checkup create/update | `CheckupPolicy::create/update` in Form Requests and controllers | required | category/checkup locks, mutation, complete price/currency/duration snapshot, and audit; create/update rollback tests | yes | `CatalogAuthorityTest` |
| Checkup/category archive | archive policies | required | soft archive/detach/reassign and per-subject audit are atomic; category events share a batch ID | yes | `CatalogDestructiveDataSafetyTest` |

## Route And Bulk Proof

`HighAuthorityRouteContractTest` enumerates 21 privileged routes. Every route is required to retain:

- authenticated access;
- active-account middleware;
- admin/root-admin role middleware;
- recent session-backed password confirmation;
- its expected controller action.

The same test rejects any admin mutation URI introducing `bulk`, `mass`, or `role-upgrade` behavior. Bulk role upgrades remain forbidden. If a real bulk archive is approved later, it must soft-delete and create one audit row per subject under one shared `batch_id`.

## Verification

- identity: 19 tests, 106 assertions;
- catalog authority/archive: 24 tests, 215 assertions;
- route contract: 22 tests, 127 assertions;
- combined named high-authority suite: 124 tests, 780 assertions;
- complete SQLite suite: 304 passed, 1,796 assertions, three expected MySQL-only concurrency skips;
- first complete MySQL attempt: 302 passed and five test-only JSON key-order assertions failed after 1,816 assertions;
- portable key-set correction: all four affected files pass focused MySQL verification with 25 tests/194 assertions; no production code changed;
- user-confirmed clean complete MySQL rerun: 307 passed, 1,816 assertions, no errors;
- 20 item-20 PHP files: Pint clean;
- route discovery: 68 API routes and 121 total non-vendor routes;
- `git diff --check`: clean;
- no `TempPass` reference in application/config/database/routes/tests;
- no new dependency, provider, public callback, bulk endpoint, or Vite implementation.

## Phase 1 Gate Closure

The backend verification dependencies and final documentation/Working Mode review are complete. `AI_BOOT.md` and `CURRENT_TASK.md` now route the next session into planning-first Phase 2 work with explicit human design/dependency gates. No Phase 2 implementation is claimed here.
