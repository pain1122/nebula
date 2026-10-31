# Medical summary icon

October16 user requests only the missing Medical requests created icon. The card used `ri-folder-heart-line`, absent from the bundled Remix3.5 font. Replace that one class with installed `ri-health-book-line` (glyph U+EE07), retaining the existing green treatment, counts, links and layout. No dependency, stylesheet, API, schema, environment or business-data change.

Deployed/accepted on healthy `sha256:eadb79df7a55ccafb2239e0ea2dca97219aaaaa27b9fcbcd59ee387d3e4751ec`, retained as `checkupino-admin:medical-card-icon-accepted-2026-10-16`. Existing dashboard17 tests, component lint and formatting pass; no new unit tests or broad suite replay for this reversible icon fix. Prior calendar/hover/backend/role gates remain through unchanged source hashes. Static acceptance verifies64 served/container byte hashes and retained lazy/cache/compression/routes/404 behavior. Six targeted native groups/five captures verify the actual U+EE07 pseudo-element, loaded font and positive icon dimensions across ENFA desktop/mobile and dark theme. The English desktop capture was visually inspected; the green medical-record glyph is visible. Original clinical/financial/provider/catalog/schedule/protected fingerprints remain unchanged; nine services run with parser/checker/worker/scanner still stopped.

Evidence: [static](evidence/medical-card-icon-static-2026-10-16.json), [native glyph/captures](evidence/medical-card-icon-pointer-2026-10-16.json) and [immutable binding](evidence/medical-card-icon-acceptance-2026-10-16.json). All previous source/evidence history remains recoverable; no older artifact overwritten.

Only delegated static admin is built/recreated. The read-only native helper verifies the real glyph, loaded Remix font and positive icon geometry in English/Farsi, desktop/mobile and dark theme, with original clinical/financial/provider/catalog/schedule/protected fingerprints. It permits GET/OPTIONS plus synthetic login/logout only. No business write, password confirmation, download, backend/scanner/worker operation or queue consumption.

Rollback retains54f791ae via [the static-only override](../../docker-compose.medical-card-icon-rollback.yml):

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.medical-card-icon-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Medical icon rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.medical-card-icon-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Medical icon static rollback failed.' }
```
