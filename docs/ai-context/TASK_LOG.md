# Task Log

Purpose: tiny chronological memory for AI sessions. Keep this short. Link to durable docs instead of repeating them.

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