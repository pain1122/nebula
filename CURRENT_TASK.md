# CURRENT_TASK.md

Snapshot date: 2026-07-19

## Planning Model

- `docs/TODO.md` is the authoritative ordered roadmap.
- `CURRENT_TASK.md` is the only active execution queue and handoff.
- Keep one bounded implementation slice in progress at a time and update this file when that slice changes.
- Durable results go to the matching domain module; brief chronology goes to `docs/ai-context/TASK_LOG.md`.

## Active Roadmap Scope

Phase 1 - Foundation and Future-Safe Baselines.

Current slice: finish Phase 1 item 16 booking correctness now that the remaining Phase 1A authority/account-lifecycle work is verified.

Current position: items 8 and 9 plus Phase 1A item 3 are complete. Root-admin-only account suspension, permanent closure, and suspended-account reactivation now use policy authorization, recent session-backed password confirmation, a required reason, one transactional service, fail-closed audit, synchronous bearer-token revocation, and atomic deletion of every database-backed browser session. User-sensitive queued jobs have a mandatory account-state-aware base. The full backend suite passes on SQLite and disposable MySQL with 121 tests/640 assertions. Booking correctness is the next active Phase 1 gate. Foundation evidence remains in `docs/audits/foundation-verification-gate-2026-07-19.md`; account-lifecycle evidence is recorded in the auth module and task log.

## Why This Comes First

The database is empty/disposable, so this is the cheapest point to replace the accumulated migration chain with a coherent baseline. Marketplace ownership, roles, settings, files/media, audit, money/payment, API, and future feature extension points must be settled before the reusable admin panel and functional demo depend on them. Tenant work in this phase is intentionally limited to the minimum separate-schema/profile/entitlement/audit foundation needed to avoid redesign; full tenant product workflows remain later.

## Scope

- Backend architecture and data ownership contracts.
- Current migration/model/enum/factory/seeder/test inventory.
- Marketplace hospital-directory/workplace ownership versus isolated single-hospital tenant ownership.
- Root-admin/admin authority boundaries plus account suspension and session/token invalidation.
- Shared archive, audit, step-up, settings, media/file, money, payment, notification, integration, and API conventions.
- Policy-based ownership, tenant mass-assignment protection, PII-safe API responses, sensitive-log redaction, and CSRF/CORS validation.
- Schema extension points needed later by blogs, products, mobile settings, and hospital/clinic sites.
- A migration consolidation map and its verification plan.

This slice is backend/data/documentation focused. Do not create or alter Blade or React pages. The reusable Vite admin platform starts in roadmap Phase 2.

## Decisions Already Locked

- Browser admin auth remains Sanctum session-cookie based.
- Mobile/external clients use scoped expiring bearer tokens.
- Spatie roles/permissions are the only authorization authority.
- `root-admin` remains distinct from `admin`.
- Tenant feature access is enforced by backend entitlements.
- Medical files use private storage and authorized download routes.
- Historical business records use archive/retention rules, not destructive application cascades.
- Checkup/category safe archive behavior already implemented must survive the migration rewrite.
- Current databases may be reset; old migrations may be removed only as part of a complete, verified replacement baseline.
- The `AI_BOOT.md` Working Mode remains unchanged after the 2026-07-19 foundation review; reconsider it only when the remaining Phase 1 gate closes.

## Approved Product Decisions

1. The main marketplace and tenant hospital websites are separate product/database contexts; identities and operational rows are not shared or synchronized.
2. Marketplace hospital profiles are manually curated directory/category records with no hospital-admin accounts. Marketplace doctors attach hospitals as workplaces and own separate services/schedules/reservation windows per workplace.
3. A tenant website represents one implicit hospital. Its admins, doctors, patients, services, schedules, reservations, payments, and medical records are entirely local; local doctors default to that hospital without a hospital selector.
4. Root-admin alone manages marketplace admin-level identities. Marketplace admins manage the hospital directory and marketplace product; tenant admins exist only in their tenant application.
5. Reservation status `pending` means the client selected a slot but has not completed payment. It holds the slot for one hour and may contain multiple provider attempts after errors, with at most one canonical success.
6. Appointment timing and duration may change through an authorized, conflict-checked, audited workflow that retains schedule history.
7. Account states are `active`, `suspended`, and `closed`; `suspended` and `closed` revoke browser sessions and bearer tokens immediately while retaining records. Reservation and listing-request pending states are separate.

Detailed contract: `docs/architecture/foundation-target-domain-and-ownership-contract.md`.

## Ordered Execution Queue

1. [x] Replace the roadmap/sprint planning model with ordered `docs/TODO.md` plus this active task file.
   - Why: the previous phases duplicated the same risks and split active work between two queue files.
   - How: use sequential milestone gates and keep historical implementation notes in the task log.

2. [x] Capture the current data contract.
   - Inspect every migration, model relation/cast, enum, factory, seeder, policy, and schema-sensitive test.
   - Produce a compact table of current tables, ownership, cardinality, foreign-key behavior, indexes, fillable/guarded fields, exposed API fields, and known conflicts.
   - Record the existing `canceled` versus `cancelled` drift and normalize the target reservation status to `cancelled`; also identify sensitive fields that must never enter responses, audit metadata, or logs.
   - Evidence: `docs/architecture/foundation-current-data-contract-inventory.md` inventories 31 migrations, 32 declared tables, 19 models, current policies, persistence/serialization paths, seeders/factory assumptions, test coverage, and confirmed baseline conflicts.

3. [x] Write the target domain and ownership contract.
   - Resolve the open decisions above.
   - Mark each table as platform-global, tenant-owned, membership-scoped, user-owned, or immutable historical data.
   - Define the owner of each status transition, the policy for every record access path, and account/session invalidation behavior.
   - Evidence: `docs/architecture/foundation-target-domain-and-ownership-contract.md` separates the marketplace hospital directory/doctor workplaces from isolated single-hospital tenant applications, monitoring-only metadata, account lifecycle, one-hour holds, payment retries, schedule history, and retention boundaries.

4. [x] Define the future-safe shared primitives.
   - Marketplace hospital directory, doctor workplaces, tenant-instance monitoring, subscription/entitlement, and tenant-local singleton hospital profile.
   - Scoped settings and feature keys.
   - Public media versus private medical files.
   - Medical-file validation, authorized/signed download, malware/quarantine extension point, retention, and deletion policy.
   - Audit/step-up/batch context with secrets, medical payloads, and unnecessary PII redacted.
   - Money, payment attempts/provider transactions, idempotency, and callbacks.
   - API envelopes/versioning, Form Request/DTO input boundaries, API resources/redaction, CSRF/CORS contract, and queued integration/notification events.
   - Blog, commerce, and mobile extension points named in the TODO without implementing their full features.
   - Evidence: `docs/architecture/foundation-shared-primitives-contract.md` defines identifiers, data classification, marketplace hospital/workplace filtering, isolated tenant profiles/monitoring, account revocation, settings/entitlements, audit/step-up, private files, API resources, reservation holds, payment attempts, scheduling history, outbox/integrations, and future feature extension points.

5. [x] Produce the migration replacement map.
   - Map every old migration/table/column/index/constraint to its new baseline owner.
   - Identify obsolete compatibility columns, inconsistent enum/status values, broad ownership fillables, and broken rollback behavior.
   - Order new migrations so `migrate`, `rollback`, and `migrate:fresh --seed` are deterministic.
   - Map the current application primarily into the marketplace schema and define only the minimal separate tenant foundation; do not duplicate all marketplace feature tables into a tenant product yet.
   - Evidence: `docs/architecture/foundation-migration-replacement-map.md` accounts for all 31 existing migrations, orders marketplace/minimal-tenant groups, identifies new structures and constraints, maps factories/seeders/tests, and records the code-change stop point.

6. [x] Rebuild the migration baseline in bounded domain groups.
   - Keep each group reviewable and run focused schema/tests before moving to the next.
   - Remove superseded migration files only when their replacement group is complete.
   - Preserve current booking, payment guard, questionnaire, audit, and catalog archive behavior.
   - Build the complete marketplace foundation plus only the approved minimal tenant skeleton; tenant feature workflows/UI remain Phase 7.
   - Evidence: 24 marketplace migrations plus 6 isolated tenant-foundation migrations replace the 31-file historical chain; 93 backend tests/499 assertions, 99-route listing, Pint, full marketplace MySQL lifecycle, and isolated tenant MySQL lifecycle pass. See `docs/audits/foundation-baseline-code-review-2026-07-12.md`.

7. [x] Rebuild factories and seeders against the new baseline.
   - Include deterministic marketplace roles/users, hospital directory/workplaces, feature keys/settings, core medical catalog, schedules, questionnaire, and demo payment fixtures.
   - Include only minimal tenant-foundation fixtures needed to verify a separate hospital profile/database boundary and local authority bootstrap.
   - Keep credentials local/testing only.
   - Evidence: role/account-state factories plus 25 domain factory files cover the marketplace entity families; split foundation/demo seeders create hospitals, workplace services/windows, catalog, settings/features, questionnaire, reservation/payment lifecycle fixtures, and an isolated tenant-local bootstrap. SQLite and MySQL fresh/repeat seeds pass; 96 tests/539 assertions and Pint pass. See `docs/audits/task-7-factories-seeders-code-review-2026-07-12.md`.

8. [x] Verify the foundation.
   - Disposable SQLite: marketplace plus minimal tenant-foundation fresh migrate/seed, rollback, re-apply, schema assertions, and applicable backend tests.
   - Disposable MySQL: marketplace plus minimal tenant-foundation fresh migrate/seed, rollback, re-apply, constraints/index inspection, and applicable backend tests.
   - Run ownership/IDOR, tenant mass-assignment, PII redaction, account/session revocation, and CSRF/CORS regression checks.
   - Run Pint and route-list checks.

9. [x] Align handoff documentation and close the foundation-baseline slice.
   - Update domain modules, project map, TODO status, this task, and task log with actual verified behavior.
   - The deferred `AI_BOOT.md` Working Mode was reviewed and retained because roadmap Phase 1 correctness/runtime items remain open. Do not select a Phase 2 task yet.

## Next Active Queue

1. [x] Complete the approved authority and account-lifecycle matrix from `docs/TODO.md` Phase 1A item 3.
   - Preserve the existing `auth:sanctum`/web authentication, `account.active` middleware, Spatie role authority, bearer-token rotation, inactive-login rejection, all-token deletion, and current-session invalidation behavior.
   - Add root-admin-only suspend, close, and reactivate actions through one transactional account-state service.
   - Require a reason, policy authorization, recent session-backed password confirmation, and fail-closed audit logging for every account-state mutation.
   - Revoke all Sanctum bearer tokens synchronously and clean up every stored browser session through the canonical database session strategy in the same transaction; non-database or separate-connection session configuration fails closed.
   - Require queued user-sensitive jobs to recheck account state before executing.
   - Verified normal-admin/root-admin boundaries, valid transitions, multiple bearer tokens, multiple browser sessions, audit/session/token rollback, configuration drift, queued-job rechecks, and suspended normal-user access on SQLite and MySQL.

2. [ ] Finish booking correctness from `docs/TODO.md` Phase 1 item 16. **Next active item.**
   - Lock the allowed/default duration contract.
   - Implement audited, conflict-checked, history-preserving rescheduling.
   - Define and enforce one-hour pending-hold expiration/release behavior.
   - Keep booking decisions centralized in `BookingService`/`SchedulingService` and verify concurrent overlap protection.

## Preserved Implemented Behavior

- First-party browser session auth and external bearer-token separation.
- Root-admin isolation from normal admin user management.
- Fail-closed audit plus recent-password confirmation for covered privileged mutations.
- Shared booking service, pivot eligibility, generated/future slots, and locked conflict recheck.
- Unpaid-to-paid and premature-done guards.
- Questionnaire/submission soft deletes.
- Checkup/category safe archives, category detach/reassignment, and reservation/payment history preservation.
- Existing listing sort/filter contracts and reservation rating option records.

## Stop Conditions

Stop and request a product decision if:

- a future change conflates a marketplace hospital directory entry with a tenant hospital instance/database
- a marketplace identity/association would implicitly grant tenant database access or synchronize tenant operational data
- an existing non-disposable database contains data that would be lost by the migration reset
- preserving verified behavior would require a materially different product rule
- the work would cross into Phase 2 frontend implementation before the Phase 1 gate
- verification fails and the cause is not understood

## Foundation Baseline Definition Of Done

This task is complete only when:

- the target foundation contract is explicit
- historical migrations are replaced by a coherent baseline without losing intended behavior
- factories/seeders support a clean local demo foundation
- fresh/rollback/re-apply and backend verification pass on disposable SQLite and MySQL
- the minimal tenant foundation proves separate schema/profile/local authority/entitlement/audit boundaries without implementing tenant product workflows
- authorization, tenant ownership, response privacy, sensitive logging, session invalidation, and CSRF/CORS contracts are verified
- roadmap, task, project map, domain modules, and task log match the verified schema/runtime
- Phase 2 can build the reusable Vite admin without inventing backend ownership or API contracts
