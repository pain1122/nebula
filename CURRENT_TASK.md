# CURRENT_TASK.md

Snapshot date: 2026-06-15

## Planning Structure

- `docs/TODO.md` is the roadmap of stages/phases to clear.
- `CURRENT_TASK.md` is the current selected roadmap stage and the safe road through it.
- `CURRENT_SPRINT.md` is the current executable slice inside this task.

## Selected TODO Scope

Work is currently limited to:

- Phase 3 - Session/Cookie First-Party SPA Integration
- Phase 3.5 - Admin Shell, Localization, and Root-Admin Developer Toolbox

Do not pull in later roadmap phases unless a Phase 3/3.5 change directly exposes a blocker.

## Task

Establish the Phase 3/3.5 authority and admin-shell foundation before product admin and root-admin toolbox separation.

## Goal

Create a safe path where:

- first-party browser admin auth remains Sanctum session-cookie based
- Spatie roles remain the only authorization source of truth
- `root-admin` exists as a distinct high-authority role
- `root-admin` can access normal product admin capabilities
- normal admins cannot manage `root-admin` users
- Velzon demo/toolbox pages can later be isolated behind a root-admin boundary

This task does not implement the full frontend toolbox split yet. It prepares and verifies the authority foundation needed before that split.

## Current Stage

Stage A - Backend root-admin authority foundation.

This stage must be completed and verified before moving into frontend route/menu/toolbox isolation.

## Decisions Locked For This Task

- Stored role value is `root-admin`, not `root_admin`.
- `root-admin` is a separate Spatie role.
- A root-admin user should not also receive the `admin` role just to inherit access.
- Product admin equivalence should be expressed through explicit backend helpers/gates.
- `/api/auth/me` should return role names only for this slice.
- Derived authority booleans should wait until a concrete frontend route/menu contract needs them.
- Normal admin user management must not create, assign, list, show, or update root-admin users.
- Velzon demo pages should not be deleted during this task.

## Road Through The Task

1. Finish root-admin backend authority hardening.
2. Verify role seeding, admin route access, user-management isolation, and existing tests.
3. Update the smallest relevant docs after verification.
4. Reassess Phase 3 unfinished security work: external bearer-token policy and high-authority action controls.
5. Start frontend admin-shell separation only after backend authority is verified.
6. Split product admin routes/menus from root-admin demo/toolbox routes.
7. Lazy-load demo/toolbox routes so normal admin users do not pay the Velzon demo bundle cost.

## Current Sprint

See `CURRENT_SPRINT.md`.

The current sprint should stay focused on backend root-admin hardening and verification.

## In Scope For This Task

- `App\Enums\UserRole`
- Spatie role seeders
- local root-admin seeding
- admin route middleware
- admin form-request authorization
- admin user-management isolation
- `/api/auth/me` role payload shape
- frontend auth role type
- Phase 3/3.5 docs after verification

## Out Of Scope For This Task

- payment flow
- booking lifecycle
- reservation/payment callbacks
- medical report logic
- public questionnaire scoring
- production Docker strategy
- public/client React rebuild
- broad Velzon cleanup or demo deletion
- Phase 5 booking-domain consolidation
- Phase 6 data-model expansion
- Phase 7 broad regression-test roadmap, except tests needed for this authority work

## Context Load

Read:

1. `AI_BOOT.md`
2. `CODEX_RULES.md`
3. `CURRENT_SPRINT.md`
4. `CURRENT_TASK.md`
5. `docs/ai-context/modules/auth.md`

Load `docs/ai-context/modules/admin-panel.md` only when the sprint moves into route/menu/toolbox isolation.

Use `docs/TODO.md` for roadmap alignment only. Do not treat old roadmap wording as runtime truth when source code has moved ahead.

## Definition Of Done

This task is not done until:

- current sprint code is manually reviewed by the user
- relevant tests pass
- manual verification steps are completed
- changed behavior is documented in the smallest relevant context file
- TODO/CURRENT_TASK/CURRENT_SPRINT status is aligned
- no unrelated files were changed
