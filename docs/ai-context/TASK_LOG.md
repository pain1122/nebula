# Task Log

Purpose: tiny chronological memory for AI sessions. Keep this short. Link to durable docs instead of repeating them.

## 2026-07-12

- Current Task item 7 is complete. Factories now model roles/account states and the foundation entity families; production-safe foundation registries are separated from local/testing marketplace demo accounts and transactions. Demo data covers three directory hospitals, two doctors with per-workplace services/windows, questionnaire internals, and six reservation/payment lifecycle cases. A separate tenant seeder proves one hospital profile, local admin authority, setting, and entitlement without marketplace/operational tables. SQLite/MySQL fresh and repeat seeds, 96 tests/539 assertions, Pint, and 102-route loading pass. Review: `docs/audits/task-7-factories-seeders-code-review-2026-07-12.md`. Item 8 verification is next.
- Current Task item 6 is complete. The clean baseline now has 24 marketplace migrations plus a separate 6-file tenant-foundation path. It adds platform settings/features/outbox, monitoring-only tenant registry/health metadata, recursive audit redaction, enforced active-account authentication, and independent tenant installation/profile/auth/roles/framework/settings/entitlement/audit/outbox tables without tenant operational features. Final checks: 93 tests/499 assertions, 99 routes, Pint, marketplace MySQL apply/rollback/reapply, and isolated tenant MySQL apply/rollback/reapply all pass. Item 7 seeders/factories is next.
- Item 6 M20b/M40/M50 is structurally implemented: workplace-scoped service eligibility and working windows replace global `checkup_doctor`/JSON schedules; reservations now use one-hour holds, canonical `pending`/`confirmed`/`completed`/`cancelled`/`expired` states, restrictive ownership, snapshots, and schedule history; one payment summary now owns retry attempts/provider events/adjustments. SQLite/MySQL lifecycle checks pass and the full backend suite passes with 80 tests/414 assertions. Provider callbacks and rebuilt demo seeders remain later queue work.
- Item 6 M10/M20a/M30 is structurally verified: marketplace hospital directory/listing requests, multi-specialty plus unique doctor workplaces, public/archive-aware specialties/doctors/catalog, and consolidated category/checkup retention fields now pass focused behavior/schema tests and SQLite/MySQL apply/rollback/reapply. The MySQL pass caught and fixed an overlong generated workplace index name. JSON availability and global `checkup_doctor` remain explicitly transitional until M20b booking compatibility is replaced.
- Current Task item 6 started. M00-M02 now use a clean identity/auth baseline: user public ULIDs, separate `active`/`suspended`/`closed` account state metadata, nullable staff-compatible profile fields, no `users.role`/`users.tenant_id`, consolidated Sanctum tokens, corrected rollback order, and unchanged package-compatible framework/Spatie tables. Focused schema/auth tests and SQLite/MySQL apply/rollback/reapply pass; runtime account-state revocation remains required before the Phase 1 gate. Detailed review: `docs/audits/foundation-baseline-code-review-2026-07-12.md`.
- Reservation cancellation vocabulary is locked to `cancelled`. Target contracts and roadmap now use `cancelled`; the remaining runtime/policy/migration-comment `canceled` occurrences will be normalized during the approved Current Task item 6 implementation pass.
- Public questionnaire definitions must not expose per-choice scores, recommendation thresholds, or internal conditions. A completed submission may return an explicitly approved user-facing total score and recommendation without exposing the scoring map.
- Current Task item 5 is complete: `docs/architecture/foundation-migration-replacement-map.md` maps all 31 existing migrations into ordered marketplace groups, a minimal isolated tenant path, removal/consolidation actions, target constraints, new tables, seed/factory needs, and verification gates. Work is intentionally paused before item 6 because migration deletion/replacement and runtime/test changes require explicit approval.
- Tenant scope clarified: do not remove the tenant foundations. Phase 1 keeps a minimal separate tenant schema/profile/local-authority/entitlement/audit/outbox and monitoring-contract foundation, while the main marketplace remains the implementation priority. Complete tenant workflows, UI, monitoring operations, migration fleet management, and optional SSO stay in Phase 7.
- Marketplace/tenant boundary corrected: marketplace hospital profiles are manual directory/category records with no hospital admins; marketplace doctors attach hospital workplaces and own per-workplace services/schedules/reservation windows. Tenant sites are independent single-hospital applications with local admins/doctors/patients and no marketplace identity/data coupling. Marketplace tenant monitoring is health/subscription metadata only.
- Current Task item 4 is complete: `docs/architecture/foundation-shared-primitives-contract.md` defines identifiers, marketplace hospital/workplace filtering, isolated tenant profiles/monitoring, account revocation, settings/entitlements, audit/step-up, private files, API resources, reservation holds, payment attempts, schedule history, outbox/integrations, and later blog/commerce/mobile extension points. Item 5 migration replacement mapping is next.
- Current Task item 3 is complete: `docs/architecture/foundation-target-domain-and-ownership-contract.md` records the final separation between the main marketplace and isolated single-hospital tenant products, plus root/admin authority, repeated payment attempts within a one-hour pending hold, mutable audited schedules, and `active`/`suspended`/`closed` accounts. No runtime or migration code changed.
- Current Task item 2 is complete: `docs/architecture/foundation-current-data-contract-inventory.md` captures all current migrations/tables, model relations/casts/fillables, API exposure, policies, seed/factory assumptions, schema-sensitive tests, retention/cardinality/status conflicts, and decision inputs. No migration or runtime behavior changed; its product decisions were resolved in the following item 3 contract.
- The foundation roadmap was aligned line-by-line with `docs/audits/repository-technical-audit-2026-07-08.md`: explicit account suspension/session revocation, ownership/IDOR policies, tenant mass-assignment protection, PII/API/log redaction, CSRF/CORS tests, questionnaire anti-automation, medical-file quarantine/retention, a booking-to-outcome demo slice, later prescriptions/follow-up, repeatable local Docker bootstrap, and React-admin production deployment are now tracked.
- Planning was simplified to one ordered roadmap plus one active queue: `docs/TODO.md` now runs foundation -> reusable Vite admin -> functional demo -> blogs -> products -> mobile -> tenant/public expansion -> operations, and `CURRENT_TASK.md` owns executable work. `CURRENT_SPRINT.md` was removed and active context-routing docs were updated.
- Phase 1 is now active and backend/data focused. Because the databases are empty/disposable, the next slice inventories the current schema, locks tenant/authority/payment cardinality and shared platform contracts, then replaces historical migrations with a verified clean baseline. No migrations were removed during the planning-only reorganization.

## 2026-07-10

- Phase 3.75 catalog destructive-data safety is implemented and verified. Checkups/categories now soft-archive; category archive uses an explicit detach-or-reassign popup; dependent checkups, reservations, payments, notes, files, and doctor assignments are preserved; privileged archive actions use policies, recent session password confirmation, row locks, and fail-closed batched audit events. The full backend suite passes with 67 tests and 320 assertions, and the four catalog migrations passed apply/rollback/re-apply on disposable SQLite and MySQL databases.
- Service module docs were refreshed for booking, payment, checkups, and doctor reports; the full chat decision/change report is `docs/audits/chat-decision-and-change-report-2026-07-10.md`.
- First booking/payment correctness fix is implemented and verified: API/Blade booking now shares `BookingService`, enforces checkup/doctor pivot eligibility, rejects past/non-generated slots, rechecks conflicts inside a locked transaction, and blocks unpaid reservations from being marked paid. `BookingPaymentRiskTest`, `ListingFilterSortTest`, scoped Pint, and full `php artisan test` pass.
- Supporting list contracts were added: touched booking/admin/questionnaire list endpoints now use whitelisted `sort_by`/`sort_dir`, checkup doctor listing reads the `checkup_doctor` pivot, and reservation rating pros/cons are admin-managed DB records with public active-option reads. Focused tests `ListingFilterSortTest` and `ReservationRatingOptionTest` pass.

## 2026-07-06

- `audit_events.batch_id` was added in the existing create-audit-events migration for future bulk-action grouping; local Docker DB was rebuilt with `migrate:fresh --seed`, keeping the audit migration in batch 1.
- First high-authority audit slice implemented and verified: API admin user create/update writes fail-closed audit rows to the shared `audit_events` table through `AuditLogger`, with focused audit tests and full backend tests passing.
- First high-authority step-up slice implemented and verified: `/api/auth/confirm-password` stores recent password confirmation in the session, and API admin user create/update requires it through `password.confirmed.recent`.
- Future bulk guardrails are recorded: reject bulk admin/root-admin role upgrades, require soft-delete plus step-up for bulk deletes, and use shared `batch_id` with one audit row per subject.
- Questionnaire and questionnaire-submission admin deletes now soft-delete; the Docker local DB migration was applied, focused tests pass, and these are lower priority than catalog/pricing or reservation-status hardening.

## 2026-06-28

- Stage E Phase 3.5 source organization is implemented and verified with `cd frontend && npm run build`: product-admin route/menu definitions live under `frontend/src/panel/`, root-admin toolbox/demo route/menu definitions live under `frontend/src/devtools/`, and no admin pages were created.
- Stage D frontend resource isolation is implemented and verified: toolbox/demo routes under `/panel/dev/*` are lazy-loaded, shell assets live in `frontend/src/Layouts/shellAssets.ts`, main JS dropped from 13,716,961 bytes to 594,264 bytes, and user browser review confirmed normal admin plus root-admin views behave correctly.
- Stage C frontend route/menu isolation is implemented and verified with `cd frontend && npm run build`: product admin remains on `/dashboard`, `/index`, and `/profile`; root-admin toolbox/demo routes moved under `/panel/dev/*`; normal admin menus exclude Developer Toolbox.
- `CURRENT_SPRINT.md` was renewed as active Stage C: inspect and plan frontend admin-shell route/menu/toolbox isolation. Current sessions should load `docs/ai-context/modules/admin-panel.md` before frontend route/menu source files.
- Stage B security reassessment is complete: bearer tokens now use server-time TTL via `SANCTUM_TOKEN_EXPIRATION_MINUTES`, API token responses include `expires_at`, refresh requires a bearer token, and focused API token tests plus the full backend suite pass.
- High-authority audit logging and step-up auth were inspected and deferred as a future backend hardening slice, not a blocker for frontend admin toolbox isolation.
- `CURRENT_SPRINT.md` records completed Stage B security reassessment. `CURRENT_TASK.md` now marks Stage A and Stage B done, with frontend admin toolbox isolation next unless another hardening detour is chosen.
- Stage A backend `root-admin` authority foundation is verified: tests passed, route-list ran, roles include `root-admin` with `guard_name = sanctum`, and normal-admin user-management API checks reject root-admin access.
- `ReservationPolicy` now uses `canAccessAdminPanel()` consistently; `LocalUsersSeeder` uses `syncRoles()` for deterministic local roles.
- `CURRENT_TASK.md`, `CURRENT_SPRINT.md`, `docs/TODO.md`, and `docs/ai-context/modules/auth.md` were aligned: parent task continues with Phase 3 security reassessment before frontend admin toolbox isolation unless explicitly deferred.

## 2026-06-16

- New sessions should start with `AI_BOOT.md`, `CODEX_RULES.md`, `CURRENT_SPRINT.md`, and `CURRENT_TASK.md`; for the current task, also load `docs/ai-context/modules/auth.md`.
- Root-admin authority/context work has been committed and pushed on `main`. Active behavior now centers on the `root-admin` Spatie role, admin-equivalent helpers, admin route access, and normal-admin user-management isolation.
- Current sprint is still verification-focused: run backend tests, route-list, seeded role check, and manual admin user-management checks before moving into frontend route/menu/toolbox isolation.
- End-of-session handoff should include a short `TASK_LOG.md` note whenever project reality, active focus, or verification status changes.

## 2026-06-15

- Added context-routing structure: boot packet first, then one relevant domain module from `docs/ai-context/modules/`, then exact source files.
- Current active sprint remains Phase 3.5: root-admin role taxonomy, `/api/auth/me` authority shape, and future admin/devtool separation.
- Current active task should load `docs/ai-context/modules/auth.md` only. Payment, booking, notifications, and doctor-report modules are out of scope for the first root-admin inspection step.
- `docs/PROJECT_MAP.md` and `docs/TODO.md` are now under `docs/`; root `PROJECT_MAP.md` and `TODO.md` are intentionally not the active paths.

## Write Rules

- Add only durable facts, decisions, and handoff notes.
- Do not paste command output, stack traces, or long investigation notes.
- Prefer updating a domain module when a fact belongs to one domain.
- Prefer updating `CURRENT_TASK.md` when the fact is only relevant to the active task.


## Size Rule

Keep this file under 150 lines.

When it grows too large:
- move old entries to `docs/ai-context/archive/TASK_LOG_YYYY_MM.md`
- keep only the latest active handoff notes here
