# TODO - Foundation-to-Product Roadmap

Snapshot date: 2026-07-12

## How This Roadmap Works

- Work from top to bottom. A later phase starts only when the preceding phase gate is satisfied or `CURRENT_TASK.md` records an approved exception.
- `docs/TODO.md` is the authoritative roadmap and dependency order.
- `CURRENT_TASK.md` contains the one active, executable slice. There is no separate sprint file.
- Completed implementation history belongs in `docs/ai-context/TASK_LOG.md`; this file keeps only enough status to plan accurately.
- A checkbox is complete only when implementation, regression coverage, and relevant documentation agree.

## Product Order

1. Establish a coherent backend, database, security, tenant, settings, file, audit, and API foundation.
2. Turn `frontend/` into a reusable React/TypeScript/Vite admin platform.
3. Deliver a functional Checkupino demo covering root-admin, admin, doctor, catalog, reservation, questionnaire, and payment workflows.
4. Add blogs/content, products/commerce, and mobile application settings on the shared foundation.
5. Expand public/patient, tenant-site, reporting, notification, and production capabilities without redesigning the core.

## Locked Decisions

- [x] Backend: Laravel 12 with Docker for local development.
- [x] Admin panel: React + TypeScript + Vite + Bootstrap, RTL-first.
- [x] Public/client UI: React + Tailwind when that phase begins.
- [x] Browser SPA auth: Sanctum session cookies; no browser-stored bearer tokens.
- [x] Mobile/external auth: scoped bearer tokens with expiry, rotation, and revocation.
- [x] Authorization authority: Spatie roles and permissions only.
- [x] Runtime roles: `root-admin`, `admin`, `doctor`, and `patient`.
- [x] `root-admin` is distinct from `admin` and owns platform-wide authority.
- [x] Catalog removal uses safe archive behavior and preserves historical records.
- [x] Tenant and feature-entitlement boundaries must be enforced by the backend, not only hidden in UI.
- [x] Marketplace/tenant boundary: the main reservation marketplace and each single-hospital tenant website are separate operational products/databases with no automatic identity or business-data synchronization.
- [x] Marketplace hospitals are manually curated directory/category records without hospital admins; marketplace doctors attach hospitals as workplaces and configure independent services/schedules/reservation windows per workplace.
- [x] Tenant hospital profile is implicit in its website/database; tenant admins/doctors/patients are local and doctors always default to the same hospital.
- [x] Root-admin alone manages marketplace admin authority; marketplace admins manage marketplace product/directory data, while tenant admins exist only inside their tenant application.
- [x] Reservation status `pending` is a one-hour unpaid slot hold; it permits repeated payment attempts after errors and at most one canonical successful payment.
- [x] Appointment time/duration changes use an explicit conflict-checked, audited history-preserving workflow.
- [x] Account states are `active`, `suspended`, and `closed`; suspension/closure revoke sessions and bearer tokens while preserving records. Reservation and hospital-listing-request pending states are separate domain states.
- [x] The databases are currently disposable/empty, so historical migrations may be consolidated into a clean baseline after the target schema is inventoried and protected by fresh/rollback tests.
- [x] Blogs, products, and mobile settings are later feature phases, but their shared ownership, media, settings, money, and API foundations are designed early.

## Current Position

The project already has a useful verified base:

- Laravel/Docker runtime, a production Compose skeleton, health route, and core seeders.
- Spatie-only roles, separate root-admin authority, Sanctum browser sessions, and external bearer-token lifecycle support.
- A Vite-powered Velzon React/TypeScript workspace with Persian/RTL support and root-admin developer routes isolated under `/panel/dev/*`.
- First fail-closed audit and recent-password step-up coverage for admin-user mutations.
- Shared booking logic for API/Blade creation, doctor/checkup pivot enforcement, generated/future slot validation, and locked conflict rechecks.
- Payment guards that block casual unpaid-to-paid and premature done transitions.
- Checkup/category safe archives that preserve checkups, reservations, payments, notes, files, and doctor assignments.

Last recorded verification on 2026-07-10: 67 backend tests and 320 assertions passed, with disposable SQLite and MySQL migration apply/rollback/re-apply checks. This is historical evidence, not a substitute for rerunning verification after the migration baseline is rebuilt.

## Phase 1 - Foundation and Future-Safe Baselines (Active)

Purpose: settle the contracts that every later feature would otherwise force us to redesign.

### 1A. Architecture and ownership contract

1. [ ] Record the canonical domain boundaries.
   - Identity/authority, tenant/platform, catalog, scheduling, reservations, payments, questionnaires, medical records, content, commerce, mobile configuration, notifications, and files/media.
   - Define which module owns each state transition and which modules may only read it.

2. [ ] Implement the approved marketplace/tenant separation before recreating the schema.
   - Marketplace: manually curated hospital directory, doctor workplaces, per-workplace services/schedules, and marketplace-owned reservations/payments.
   - Tenant: one implicit hospital profile with entirely local admins/doctors/patients and operational data; no hospital selector or marketplace workplace relation.
   - Marketplace monitoring stores tenant instance health/subscription/feature metadata only and grants no tenant operational access.
   - Phase 1 tenant scope is a minimal separate-schema/profile/local-authority/entitlement/audit skeleton only. Full tenant doctors, patients, booking, payment, medical workflows, monitoring UI, and website features remain Phase 7 after the main marketplace features.
   - Done when: `docs/architecture/foundation-target-domain-and-ownership-contract.md` is represented by the baseline schema and connection/policy design.

3. [ ] Implement the approved authority and account-lifecycle matrix.
   - Define root-admin-only, admin, doctor, patient, and public abilities.
   - Decide whether normal admins may create or manage other admins.
   - Define which mutations require recent-password step-up, audit events, reason fields, or dual confirmation.
   - Enforce account states `active`, `suspended`, and `closed`; suspension/closure immediately revoke sessions and bearer tokens.
   - Keep reservation `pending` and hospital-listing/review pending states separate from account state.
   - Require policies for marketplace ownership and tenant-local ownership instead of relying on scattered controller ID checks; normal product flows never authorize cross-tenant operational access.

4. [ ] Standardize cross-domain lifecycle rules.
   - Archive versus delete, immutable history snapshots, status transition ownership, timestamps/timezones, money representation, public identifiers, idempotency keys, and actor attribution.
   - Historical reservation/payment/questionnaire/medical records must survive catalog or account archival.
   - Normalize enum/database/API vocabulary, including changing the existing mixed `canceled`/`cancelled` reservation-status usage to the chosen target spelling: `cancelled`.

### 1B. Clean database baseline

5. [ ] Inventory the schema expressed by current migrations, models, enums, factories, seeders, and tests.
   - Produce an old-to-new table/constraint map before deleting migration history.
   - Confirm every database targeted by the reset is disposable and contains no required data.
   - Include fillable/guarded ownership fields, status comments/defaults, API resources, and sensitive fields that must not leak into responses or logs.

6. [ ] Replace the historical migration chain with coherent baseline migrations.
   - Group migrations by dependency and domain instead of preserving accidental development chronology.
   - Require correct `up()` and `down()` behavior, deterministic ordering, and clean foreign-key creation.
   - Remove old migration files only as part of the verified replacement change.

7. [ ] Enforce intended integrity in the database.
   - One doctor profile per user and the intended payment cardinality per reservation.
   - Unique/indexed tenant domains, memberships, slugs, public IDs, provider references, and idempotency keys where applicable.
   - Restrict or null foreign keys according to retention rules; do not use destructive cascades for historical business records.

8. [ ] Rebuild deterministic seed and demo data.
   - Roles/permissions, a local root-admin, normal admin, doctor, patient, base tenant/site, feature keys, settings, checkups, schedules, questionnaires, and payment-provider fixtures.
   - Never embed production credentials or make local demo credentials valid outside local/testing environments.

### 1C. Shared platform primitives

9. [ ] Establish marketplace directory and tenant monitoring/subscription primitives.
   - Marketplace hospitals, hospital-listing requests, doctor workplaces, monitored tenant instances, plans/subscriptions, feature keys, tenant overrides, and fail-closed tenant-local feature checks.
   - Keep directory hospital identity separate from tenant-instance identity; any future link is optional display/monitoring metadata only.
   - Implement only the minimum tenant registry/schema-version/feature-contract foundation now; defer monitoring dashboards and complete tenant operations to Phase 7.

10. [ ] Establish a scoped settings system.
    - Typed keys, validation, defaults, and platform/tenant/user scopes.
    - Reserve groups for branding, booking, payment providers, email/SMS, mobile client configuration, maintenance mode, and integrations.
    - Secrets must use environment/secret storage; settings rows may reference configuration but must not become a plaintext secret vault.

11. [ ] Establish shared media and private-file contracts.
    - Reusable media metadata/attachment ownership for public images and documents.
    - Separate private medical/report storage with policy-protected or signed short-lived downloads, MIME/extension/size validation, audit events, and no public-storage exposure.
    - Define malware-scanning/quarantine integration points plus file replacement, archive, deletion, and retention rules.

12. [ ] Complete the audit and step-up framework.
    - Shared audit schema/logger, batch IDs, before/after metadata policy, actor/tenant/subject context, and fail-closed behavior for privileged mutations.
    - Cover admin authority, doctor verification, reservation/payment overrides, catalog price/update/archive, questionnaire mutations, tenant settings, and future bulk actions.
    - Redact passwords, tokens, secrets, medical payloads, and unnecessary PII from audit metadata and application logs.

13. [ ] Standardize API contracts.
    - Versioning strategy, success/error envelope, validation errors, pagination/filter/sort query rules, enums, dates, money, idempotency, and typed OpenAPI-compatible shapes.
    - Keep first-party session and mobile bearer-token authentication paths explicit and isolated.
    - Use Form Requests/DTO-style input boundaries and guard ownership fields such as `tenant_id` from mass assignment.
    - Use policies consistently for ownership/tenant authorization and API resources/transformers for explicit PII-safe response shapes.
    - Validate CSRF/stateful-domain/CORS environment configuration and add session-auth regression tests.

14. [ ] Establish integration and background-work primitives.
    - Provider adapters, queues/jobs, retries, idempotent callbacks/webhooks, notification events, and an outbox or equivalent reliable dispatch decision.
    - Payment, email/SMS, push notifications, and future external integrations must plug into these boundaries.

15. [ ] Establish payment and money foundations.
    - Integer minor units plus currency, deterministic reservation/payment state machines, provider transaction references, callback verification, idempotency, refund/void concepts, and audited manual override policy.
    - Keep provider-specific payloads outside the canonical reservation lifecycle.
    - Support repeated attempts within a one-hour reservation hold, release expired unpaid slots, and enforce at most one canonical successful payment.

### 1D. Future-feature skeletons to reserve now

These are contracts and extension points, not permission to build their complete UI during Phase 1.

| Future feature | Baseline required now | Full implementation phase |
| --- | --- | --- |
| Blogs/content | tenant/platform ownership, locale, slug, publication state, SEO metadata, media attachments | Phase 4 |
| Products/commerce | money/currency, catalog ownership, media, order/payment separation, tax/discount extension points | Phase 5 |
| Mobile apps | API versioning, client settings, minimum version, maintenance flag, feature flags, device/push-token ownership | Phase 6 |
| Hospital/clinic sites | isolated single-hospital profile/database, subscription, entitlement, branding, local identities/data, monitoring heartbeat | Phase 7 |
| Reports/medical files | private file ownership, authorization, audit, retention, download contract | Phase 1 foundation and Phase 3 demo |
| Notifications | domain events, templates, channels, queued delivery, preference/scoping rules | Phase 1 foundation and later feature phases |

### 1E. Close current correctness and security gaps

16. [ ] Finish booking correctness.
    - Enforce default and actual duration rules, audited history-preserving rescheduling, enum-safe centralized policies, doctor availability, generated slots, past rejection, one-hour hold expiration, and concurrent overlap protection.

17. [ ] Finish payment and reservation lifecycle integrity.
    - Verified callbacks, explicit override policy, allowed status transitions, completion endpoint, rating-request trigger, audit, step-up, and regression tests.

18. [ ] Finish questionnaire integrity.
    - Exactly one valid answer per required question, duplicate/missing answer rejection, throttling plus a CAPTCHA/anti-automation decision, deterministic scoring, and stored-HTML sanitization/rendering policy.

19. [ ] Finish medical record/file safety needed by the demo.
    - Deliver the minimum medical vertical slice: doctor requests a test/result, patient uploads it, doctor reviews and writes a note/report, and patient views the outcome.
    - Require private storage, MIME/extension/size validation, malware/quarantine policy, authorized downloads, retention/deletion rules, and audit events.

20. [ ] Close remaining high-authority paths.
    - Admin-to-admin authority, doctor verification, catalog pricing/update, questionnaire administration, tenant settings, reservation/payment override, and future bulk-operation policy.

### Phase 1 gate

- [ ] Fresh migration, seed, rollback, and re-apply pass on disposable SQLite and MySQL databases.
- [ ] The minimal tenant-foundation migration path independently verifies its single-hospital profile, local authority, entitlement, audit/outbox, and marketplace-separation constraints without full tenant features.
- [ ] Backend tests and formatting checks pass against the rebuilt baseline.
- [ ] Schema constraints, policies, enums, services, seeders, and docs agree.
- [ ] Ownership/IDOR, tenant mass-assignment, PII redaction, session invalidation, and CSRF/CORS regression tests pass.
- [ ] No current behavior is silently lost during migration consolidation.
- [ ] Review and intentionally update the `AI_BOOT.md` Working Mode after the foundation gate, as previously deferred.

## Phase 2 - Reusable Vite Admin Platform

Purpose: make the admin shell useful in Checkupino and portable to another Laravel/API project before building domain-heavy pages.

1. [ ] Make `frontend/` type-clean and build-clean.
   - Fix the missing `ForgetPassword.tsx` reducer/import and all TypeScript errors.
   - Add `npm run typecheck`, production build, lint/format policy, and CI gates.

2. [ ] Declare canonical ownership and routing.
   - `/panel/*` is the product admin namespace.
   - Keep root-admin developer utilities isolated and lazy under `/panel/dev/*` or a clearly equivalent namespace.
   - Remove route/auth path drift and document deployment base-path behavior.

3. [ ] Separate reusable admin core from Checkupino modules.
   - Core: layout, theme, i18n/RTL, auth boundary, API client, navigation, permissions, forms, tables, feedback, errors, and route registry.
   - Domain modules: users, doctors, reservations, payments, questionnaires, content, commerce, and settings.
   - The core must not import Checkupino domain pages or hard-code Checkupino API routes.

4. [ ] Consolidate a typed API/auth client.
   - One environment-driven base URL and one normalized error/envelope layer.
   - Session-cookie adapter for browser admin; a replaceable auth adapter boundary for reuse.
   - Request cancellation/deduplication, CSRF bootstrapping, pagination/filter/sort helpers, and typed query/mutation hooks.

5. [ ] Build a shared route/menu/permission registry.
   - One definition drives routing, navigation, breadcrumbs, titles, lazy imports, and role/permission visibility.
   - Backend remains the authority; frontend gates improve UX but never replace policies.

6. [ ] Build reusable admin primitives.
   - Data table, server pagination/filter/sort/search, form fields/validation, modal/drawer, archive confirmation, password step-up, file picker, status badge, audit history, empty/loading/error states, and toast/notification handling.
   - Ensure Persian/RTL behavior is part of component acceptance, not a later patch.

7. [ ] Make root-admin platform navigation first-class.
   - Separate marketplace product/directory pages from root-admin system pages.
   - Preserve extension slots for future tenant monitoring, feature entitlements, settings, audit events, health, jobs, and mobile configuration without building tenant pages in this phase.

8. [ ] Remove or quarantine Velzon demo dependencies.
   - Delete fake/demo data helpers only after no reusable core or product route depends on them.
   - Keep selected developer reference pages only when they are clearly root-admin tools and remain lazy-loaded.
   - Reduce the shared shell chunk and prevent toolbox assets from entering normal-admin startup bundles.

9. [ ] Document and verify portability.
   - Environment contract, required packages, auth/API adapter points, theme tokens, module registration, build commands, and extraction/copy checklist.
   - Prove the admin core can boot with a minimal module manifest without Checkupino domain routes.

### Phase 2 gate

- [ ] `npm run typecheck` and `npm run build` pass in CI.
- [ ] Root-admin and normal-admin route/menu authority is browser-tested.
- [ ] The normal-admin initial bundle excludes developer-toolbox pages.
- [ ] A second project can adopt the admin core through documented configuration rather than copying Checkupino business code.

## Phase 3 - Functional Checkupino Demo

Purpose: deliver one end-to-end usable product slice on the stable backend and reusable admin platform.

### 3A. Root-admin and admin

1. [ ] Complete root-admin platform capabilities for the demo scope.
   - Manage marketplace admins/authority, account suspension/session revocation, hospital directory, marketplace settings, doctor verification, audit events, and system/queue/health visibility.
   - Every privileged mutation is policy-checked, step-up protected where required, and audited. Tenant-instance management/monitoring UI remains Phase 7.

2. [ ] Complete normal-admin capabilities for the demo scope.
   - Manage permitted marketplace users/patients, hospital directory profiles, doctors/workplaces, specialties, checkup categories/checkups, schedules, reservations, payments, questionnaires, ratings, and reports without root-admin escalation paths.

### 3B. Doctor and catalog

3. [ ] Complete the base doctor workflow.
   - Profile, specialty, verification state, offered checkups, availability, reservation queue, allowed status actions, requested tests/results, notes, private files, and reports.

4. [ ] Complete the checkup catalog workflow.
   - Categories, checkups, pricing, duration, doctor eligibility, safe archive/detach/reassignment, search/filter/sort, and historical snapshot behavior.

### 3C. Reservation, payment, and questionnaire

5. [ ] Complete the reservation workflow.
   - Availability search, booking, conflict safety, cancellation, admin/doctor transitions, completion, rating request, ownership policies, and history.

6. [ ] Complete the payment workflow.
   - A deterministic sandbox/fake provider adapter for the demo, verified/idempotent callback path, payment status history, refund/void-ready contract, and audited root-admin override.

7. [ ] Complete the questionnaire workflow.
   - Admin CRUD, safe rich content, public/patient submission, lead linkage, validation/throttling/anti-automation, scoring, recommendations, results, and audit/history behavior.

### 3D. Demo delivery

8. [ ] Complete the booking-to-medical-outcome vertical slice.
   - Doctor requests a result/test, patient uploads a private file, doctor reviews it and publishes a report/outcome, patient views the authorized outcome, and admins see only policy-permitted records.

9. [ ] Create a deterministic demo seed and walkthrough.
   - Root-admin, admin, doctor, and patient accounts; tenant/site; feature entitlements; checkups; schedules; questionnaire; sample reservation/payment states; and safe local-only credentials.
   - Document the golden flow and capture repeatable screenshots/video only after the seeded flow is stable.

10. [ ] Add end-to-end acceptance coverage for the golden path.
   - Fresh database to login, configure catalog/doctor, book, pay through sandbox, complete reservation, upload/review/view a medical outcome, request rating, submit questionnaire, and review audit events.

### Phase 3 gate

- [ ] A fresh clone can run migrations/seeds and reach the demo without manual database repair.
- [ ] Root-admin, admin, doctor, and patient permissions are proven by tests and browser acceptance.
- [ ] The admin panel exposes every demo workflow through real APIs with no fake business data.
- [ ] Booking, payment, questionnaire, archive, private-file, and privileged-action regressions are covered.
- [ ] Ownership boundaries, PII-safe responses, account/session revocation, and browser CSRF/CORS behavior are acceptance-tested.

## Phase 4 - Blogs and Content

1. [ ] Implement posts/pages/categories/tags, media, authorship, drafts, scheduling, localization, SEO metadata, and safe archive.
2. [ ] Add platform-global, tenant-specific, opt-in, and entitlement-gated content visibility.
3. [ ] Build admin/root-admin content management using the shared Vite primitives.
4. [ ] Expose tenant-safe/public read APIs with cache and publication rules.
5. [ ] Add moderation, audit, and content visibility tests.

## Phase 5 - Products and Commerce

1. [ ] Implement products, variants, prices, inventory policy, media, categories, and safe archive.
2. [ ] Implement carts/orders/order items, totals, discounts/tax extension points, and immutable purchase snapshots.
3. [ ] Reuse the payment-provider boundary without coupling commerce payments to reservation payments.
4. [ ] Build admin/root-admin commerce management using the shared Vite primitives.
5. [ ] Add order/payment/idempotency/tenant-isolation regression tests.

## Phase 6 - Mobile Application and Remote Settings

1. [ ] Implement mobile client registration, minimum/supported version rules, maintenance messages, release channels, and scoped feature flags.
2. [ ] Implement device and push-token ownership, revocation, notification preferences, and queued push adapters.
3. [ ] Publish a versioned mobile API/auth contract using external bearer tokens and explicit abilities.
4. [ ] Build root-admin mobile settings, release, feature, and health pages in the Vite admin.
5. [ ] Add upgrade, disabled-feature, revoked-token, and tenant-scoping tests.

## Phase 7 - Public/Patient and Tenant-Site Expansion

1. [ ] Build the React + Tailwind public/patient application on the stable APIs.
2. [ ] Build the isolated single-hospital tenant application/profile against its own configured database; no dynamic cross-tenant query path.
3. [ ] Add hospital/clinic branding, locale, navigation, entitled local feature surfaces, and controlled content syndication.
4. [ ] Add tenant-local admins, doctors, patients, booking, payment, questionnaires, results, files, ratings, and notifications.
5. [ ] Add marketplace monitoring for tenant health, content sync, subscription state, sanitized aggregate usage, and recent error fingerprints without operational-data access.
6. [ ] Add later medical workflows such as prescriptions/medications, follow-up plans, outcome tracking, and policy-scoped admin access.

## Phase 8 - Operations, Reporting, and Production Readiness

1. [ ] Add CI gates for backend tests, Pint, frontend typecheck/build, and production Docker image builds.
2. [ ] Make local Docker bootstrap repeatable, including dependency install, key generation, migrations/seeds, root/admin Vite startup/build, and useful service health checks.
3. [ ] Add production Compose smoke tests, environment validation, React-admin deployment, and a release-time migration policy.
4. [ ] Define database/upload backup, restore, retention, and disaster-recovery procedures.
5. [ ] Finalize TLS, reverse proxy, secret management, observability, queue/scheduler supervision, and alerting.
6. [ ] Add operational dashboards, exports, analytics/reporting, and privacy-aware audit retention.
7. [ ] Add PR/release checklists that enforce tests, migration safety, API compatibility, tenant isolation, and documentation updates.

## Roadmap Guardrails

- Do not build a feature UI before its backend state machine, ownership, policy, audit, and API contract are stable.
- Do not add feature-specific alternatives to shared settings, media, money, tenant, audit, notification, or API primitives.
- Do not expose fake/demo data through production routes.
- Do not let frontend role checks substitute for backend authorization.
- Do not physically delete historical reservation, payment, questionnaire, audit, or medical records through ordinary application actions.
- Do not claim staging/production readiness until Phase 8 gates are green.
