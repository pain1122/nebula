# Doctor/patient operational directories

Started October 13; acceptance completed October 14, 2026, Asia/Tehran. Existing October 11 feature-administration approval covers both URLs, navigation and retained Velzon table composition. No dependency, schema, business-write or scanner change is included.

| Before | Delivered slice |
| --- | --- |
| Only the shared Users directory exposes doctor/patient role filtering. | Dedicated `/panel/doctors` and `/panel/patients` entries reuse that table with fixed role scopes; pasted privileged role filters cannot change the scope. |
| Directory metadata lacks doctor verification/specialty/workplace summaries. | Explicit safe profile metadata shows verification, primary specialty and active-workplace count; missing/deleted profiles are distinct. |
| Operational filtering and related-record access are incomplete. | Account state, registration period and server search/sort/pages compose with doctor verification/specialty/workplace filters. Quick filters, explicit refresh/reset and existing reservation/medical/submission links are wired. |
| Support profile Back returns only to Users. | A fixed allowlist of directory origins preserves doctor/patient scope and filters; external return URLs are ignored. |

## Contract and privacy

The existing `GET /api/admin/users` endpoint remains authoritative. New account-state and doctor-only verification/specialty/workplace filters are validated; malformed arrays, unsupported enums/private sorts and out-of-bound pages/page sizes return422. Doctor filters require explicit doctor scope. Searches use display names or exact public IDs, never contact/private identity fields. Secondary specialties participate in filtering; the displayed specialty is explicitly the primary specialty. Workplace selection can include an inactive recorded workplace, while the displayed count explicitly counts active workplaces.

Root subjects stay excluded; ordinary admins also cannot discover privileged admin subjects, including mixed-role records. Profile/contact/clinical models are never serialized; the additive `doctor_profile` object contains only `id`, `verified`, `specialty` and `active_workplaces_count`. Legacy nullable private keys retain null values. Eager loading/counts avoid per-row profile/workplace queries and unbounded relation output. Stable ID tie sorting and private/no-store headers apply. Old static clients can ignore the additive fields; dedicated pages keep the existing support-profile privacy and permission boundaries.

The frontend fixes its role scope in URL state and backend query arguments, drops unsupported doctor filters from patient scope, and uses current query data/session-owned cache. Creation remains on the original Users page. Missing profiles have no guessed doctor-profile drill-down. Every related page retains its own authority; links convey an explicit doctor-profile or patient numeric filter. No data export, account mutation, verification toggle or credential access is added.

## Validation

Source: isolated UID33/network-none/read-only/masked-private/memory-capped SQLite **27 tests /301 assertions**, including five new operational tests plus retained profile/user-audit coverage. Full frontend **61 files /522 tests**, TypeScript/governed and page lint/fixtures/format/unchanged quality ratchets and14 readiness safeguards pass. Early retained-selector/navigation assertions and conditional-expect lint were corrected without changing rule strength. A root-directory lint invocation attempted a package lookup and was immediately stopped; final checks use the installed frontend tooling and no dependency or lockfile changes are included.

Deployed **747564b5**, retained as `checkupino-admin:operational-directory-accepted-2026-10-13`, is healthy. [Static proof](evidence/operational-directory-static-2026-10-13.json) verifies50 served/container assets, retained controls/lazy CSS/gzip/cache/deep links. [Retained role proof](evidence/operational-directory-browser-2026-10-13.json) passes11 admin/root/patient/doctor groups. [Native pointer proof](evidence/operational-directory-pointer-2026-10-13.json) passes18 groups/106 API requests, three desktop/390px mirror cases and twelve captures, including actual record navigation and profile Back. The two Farsi mobile captures were visually inspected; the retained responsive table keeps additional columns in its horizontal scroll area. No runtime exceptions, external requests or blocked business attempts occur.

[UID33 read-only MySQL proof](evidence/operational-directory-mysql-2026-10-13.json) verifies composed active/verification/specialty/workplace filtering against existing synthetic doctor5/profile2/workplace3, with one matching row and safe metadata. This is a controller query; actual HTTP role enforcement is established by the browser proofs. [Final source/runtime binding](evidence/operational-directory-acceptance-2026-10-13.json) binds the accepted source and evidence. Current readiness passes twelve running services, idle worker/jobs0, both read-only sockets, parser/MySQL/Redis and every original/protected fingerprint. Recorded history stays ready; scanner remains stopped with stale definitions/current probe absent. Source testing does not establish successful live business mutations.

The first pointer attempt completed15 directory/mirror groups before its patient login destination assumption timed out: the application correctly landed on Booking. The helper was corrected to that existing route, then the complete18-group gate passed. [Failed proof](evidence/operational-directory-pointer-2026-10-13-failed-1791923726164.json) remains immutable with matching data fingerprints and zero blocked business requests. No product route or business behavior changed to satisfy the helper.

## Deployment and rollback

Only the already delegated static-admin config/build/recreate sequence is used. Backend source is mounted in the existing app; no backend Compose/build/cache operation is required. The preceding accepted `66ffd5a7` image/tag remains available.

Rollback static admin using the prepared override, after reviewing the recorded evidence:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.operational-directory-admin-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Admin rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.operational-directory-admin-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Admin rollback failed.' }
```

Rollback retains all data, audits, current backend privacy and existing reservation safeguards. It has not been executed. Reversing the additive read filters/metadata is a separate source decision; no destructive rollback is needed.

Remaining: authorized activity, catalog/schedule/payment/settings administration, real dashboard reporting, separate successful live administrative mutation/download-audit acceptance and separately guarded fresh scanner recovery. This directory slice does not close those broader checklist items.
