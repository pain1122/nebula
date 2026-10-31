# Calendar current-day clarity

October16 user approves the proposed visible Today label and subtler highlight. Previously October16 had FullCalendar's yellow current-day fill while appointments appeared on October11; the fill did not explain its meaning. The dashboard calendar now labels the current Tehran date “Today” / “Today in Farsi” and uses the existing theme's neutral tertiary background. Appointment dates, status colors, metadata, navigation and all other dashboard gadgets remain unchanged.

Only `AppointmentCalendar.tsx` and assertions in its existing ENFA test change. The installed day-cell render hook adds escaped localized text, using the existing translation and Bootstrap classes. An instance-local CSS custom property changes FullCalendar's today fill to `var(--vz-tertiary-bg)`, supporting both themes without a global stylesheet or RTL geometry change. No dependency, API, schema, environment, credential or business-data change.

Focused24 tests, TypeScript, supplemental component/test lint and formatting pass. Existing tests verify the label on October16 and its absence from the October11 appointment cell. Retain prior full70/726/all-quality/backend32/515/Pint4/25 UID33 reads/ten guest401/29 native groups/11 role groups through the unchanged source hashes; no broad test replay is needed for this rendering-only edit.

Deployed and accepted on healthy `sha256:b24bb8cf71345669efb886f13649776fba98787e36ef5d11eedcf9ff3508986b`, retained as `checkupino-admin:calendar-today-accepted-2026-10-16`. Static acceptance verifies63 served/container byte hashes and retained lazy/cache/compression/deep-link/404 behavior. Nine targeted native groups/two desktop-mobile mirror cases/five captures check current Tehran date, ENFA labels, mobile containment, neutral theme token in light/dark, unchanged completed/pending colors, ordinary reservation navigation and original clinical/financial/provider/catalog/schedule/protected fingerprints. Farsi mobile and dark captures were visually inspected. GET/OPTIONS plus synthetic login/logout only; protected accounts never log in. No business write, clinical download, queue consumption or scanner/backend operation. Nine running services remain; parser/checker/worker/scanner stay stopped.

The two earlier failed helper attempts retain immutable proofs: a quoted-selector expression and an inherited legacy customizer selector were corrected before acceptance. The current helper compiles static browser expressions first and uses the actual shell theme button. Neither failure required application changes or a business write. Pre-existing crowded Farsi weekday headings at390px remain a separate visual follow-up; this scope establishes current-day clarity, not comprehensive calendar redesign.

Evidence: [static](evidence/calendar-today-static-2026-10-16.json), [native browser/mirrors/captures](evidence/calendar-today-pointer-2026-10-16.json) and [immutable binding](evidence/calendar-today-acceptance-2026-10-16.json). All prior calendar evidence remains unchanged; backend/API/authority/transport sources retain exact accepted hashes.

Rollback uses the retained e3a2c398 calendar image through [the static-only override](../../docker-compose.calendar-today-rollback.yml); configuration validation and no-build recreation use only the delegated admin service:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.calendar-today-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Today-label rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.calendar-today-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Today-label static rollback failed.' }
```
