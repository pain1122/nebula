# Calendar day hover

October16 user explicitly requests hover feedback in a different color from Today. The calendar now uses a soft cyan tint from the existing `--vz-info-rgb` theme token at12% opacity. Today retains its localized label and neutral tertiary background. Hover applies to the interior day frame, including Today, and clears when the pointer leaves. Appointment status colors and ordinary reservation links remain unchanged.

The stylesheet is lazy-loaded with the dashboard and scoped under `.checkupino-appointment-calendar`. No other calendar or template style is changed. The hover selector requires a fine pointer with hover support, avoiding persistent touch hover. Matching `:focus-within` feedback supports keyboard navigation to existing event links. No cursor/action, selection, new animation or write control is introduced. No direction-specific geometry, new dependency, API, schema or environment change.

Deployed/accepted image `sha256:54f791ae3d9ae9f6b04d4c8ce40ed2db7f6f00742da5a875217a2c34395a6f88` is healthy and retained as `checkupino-admin:calendar-hover-accepted-2026-10-16`. Focused24 tests, TypeScript, component lint, component/CSS formatting and unchanged quality ratchets2515/10/40/undeclared0 pass. This reversible visual slice adds no new unit tests. The ratchet caught Farsi label prose in the previous Today handoff/report; English documentation wording was corrected, without changing product translations or old evidence.

Static acceptance verifies64 served/container asset hashes, including the new lazy dashboard stylesheet and retained cache/compression/routes/404 behavior. Sixteen targeted native groups/two ENFA desktop-mobile mirror cases/eleven captures verify actual-pointer cyan feedback on ordinary/Today cells, clearance after pointer leave, light/dark token behavior, keyboard focus, Today labels, unchanged event colors/detail navigation and all clinical/financial/provider/catalog/schedule/protected fingerprints. Hover captures were visually inspected. Prior calendar Today/backend/role/golden-flow gates remain accepted through unchanged source hashes; no broad suite replay is inferred. Touch-specific hardware behavior is not independently rehearsed; the hover media guard is present in served CSS.

Earlier failed hover checks remain immutable: browser smooth scrolling moved the target between its hit check and mouse movement. Diagnostic evidence confirmed hover/fine-pointer support and no hovered day. The helper now scrolls instantly before measuring and dispatching a real pointer event. No application correction was needed after that failure. Evidence: [static](evidence/calendar-hover-static-2026-10-16.json), [native hover/focus/mirrors/captures](evidence/calendar-hover-pointer-2026-10-16.json) and [immutable binding](evidence/calendar-hover-acceptance-2026-10-16.json).

Rollback retains the b24bb8cf Today-marker image through [the static-only override](../../docker-compose.calendar-hover-rollback.yml). Only the delegated static admin is built/recreated; no backend/scanner/worker operation, clinical download, business save/password confirmation/provider/queue action. Protected and original history remain guarded by read-only fingerprints. Pre-existing narrow Farsi weekday heading crowding remains a separate visual follow-up.

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.calendar-hover-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Hover rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.calendar-hover-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Hover static rollback failed.' }
```
