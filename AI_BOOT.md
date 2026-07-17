# AI_BOOT.md

Purpose: keep AI/Codex sessions focused, safe, and context-efficient.

## Boot Packet

For a normal task, read only these files first:

1. `CODEX_RULES.md`
2. `CURRENT_TASK.md`

Stop there unless the task names a domain or file that needs more context.

Do not load full `README.md`, `docs/TODO.md`, `docs/PROJECT_MAP.md`, ADRs, architecture docs, or broad source directories by default.

## Module Size Rule

Module docs should stay short and operational.

Prefer:
- current state
- open first
- guardrails
- verification
- update rules

Avoid:
- long history
- pasted code
- command output
- full implementation notes

If a module grows too large, split it or archive old notes into TASK_LOG/archive.

## Context Routing

After the boot packet, load at most one or two small domain modules from `docs/ai-context/modules/`:

- Auth, roles, sessions, `/api/auth/me`, root admin: `auth.md`
- Booking, reservations, scheduling, slot validity: `booking.md`
- Payments, payment rows, callbacks, payment status: `payment.md`
- Checkups, categories, specialties, doctor/checkup eligibility: `checkups.md`
- Doctor profile, doctor reservations, notes, files, reports: `doctor-reports.md`
- React admin shell, `/panel/*`, Velzon/demo toolbox: `admin-panel.md`
- Email/product notifications, mail, verification notices: `notifications.md`

Only after the relevant module is loaded should source files be opened, and only the specific routes, controllers, models, migrations, seeders, tests, or frontend files named by that module/task.

Use `docs/PROJECT_MAP.md` only for architecture orientation or when the task is unclear after the boot packet and module. Use `docs/TODO.md` only for roadmap/history work.

## Change Budget

For one implementation step, prefer:

- 1 domain
- 1 behavior
- 1 to 3 files
- 1 verification path

If more is needed, split the task.

## Current Project Reality

- Backend is Laravel 12 in Docker.
- Root runtime still uses Blade + Laravel Vite.
- `frontend/` is a parked Velzon React-TS Vite workspace.
- `frontend/` has working Sanctum session-cookie auth, but it is not fully canonical yet.
- Admin target is React + Bootstrap under `/panel/*`.
- Public/client target is React + Tailwind.
- Spatie roles are the only authorization source of truth.
- `users.role` has been removed from the active schema.
- Current runtime roles are `root-admin`, `admin`, `doctor`, and `patient`.
- Browser admin auth must not store bearer tokens in `localStorage` or `sessionStorage`.

## Heavy Paths To Avoid

Avoid unless directly required:

- `vendor/`
- `node_modules/`
- `frontend/public/assets/`
- `frontend/src/assets/`
- `public/build`
- `frontend/dist`
- `storage/framework/*`
- broad `frontend/src/pages/` scans unless working on route/toolbox isolation

## Source Of Truth Priority

When sources conflict, use this order:

1. Current source code and database schema
2. Passing tests and actual command output
3. CURRENT_TASK.md
4. domain module docs
5. docs/PROJECT_MAP.md
6. docs/TODO.md
7. README.md
8. archived vision documents

If a lower-priority doc conflicts with code, do not follow it blindly. Report the conflict and suggest a doc update.

## Working Mode

Default for this project is inspect, explain, and propose before broad or risky edits.

Small approved maintenance edits may be made directly when the user asks for them, but keep them scoped, explain the touched files, and verify.

Do not rename files/routes, add dependencies, or change architecture without explicit approval.

Do not modify auth, roles, payments, booking lifecycle, or medical/reporting logic broadly unless the current task explicitly targets that domain.

Do not remove Velzon demo/fake helpers until the root-admin/developer toolbox boundary is intentionally implemented.

## Response Shape

For ordinary implementation work, keep responses short:

- goal
- files touched or inspected
- decision/risk
- verification

Use the longer review format from `CODEX_RULES.md` only for code reviews, architecture decisions, security-sensitive changes, or when the user asks for it.

## Stop Conditions

Stop and ask before continuing if:

- the task requires touching more than 3 source files
- the task crosses more than one domain module
- a migration is needed but is not explicitly authorized by the user or `CURRENT_TASK.md`
- an auth, role, payment, booking, or medical/reporting rule is unclear
- source code conflicts with a context doc
- tests fail and the cause is not obvious
- a proposed fix requires deleting or renaming files that the user or `CURRENT_TASK.md` did not explicitly authorize
- a proposed fix requires adding a dependency


## Doc Update Rule

When a task changes project reality, update the smallest relevant context file:

- current active work: `CURRENT_TASK.md`
- domain facts: matching `docs/ai-context/modules/*.md`
- durable architecture decisions: ADR or `docs/architecture/*`
- roadmap/history: `docs/TODO.md`
- brief chronological note: `docs/ai-context/TASK_LOG.md`

## Re-Sync Protocol

If context was compacted, lost, or the user says "re-sync":

1. Re-read `AI_BOOT.md`.
2. Re-read `CURRENT_TASK.md`.
3. Load only the module named by the current task.
4. Summarize current focus, current step, forbidden areas, and likely files.
5. Do not give code until the user confirms the re-sync is correct.
