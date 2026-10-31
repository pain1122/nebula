# Checkup/category JSON read foundation

October 14, 2026, Asia/Tehran. The user explicitly approves all six routes/navigation/controls in [the catalog proposal](admin-catalog-proposal-2026-10-14.md). This first slice prepares the checkup/category readers before connecting the four panel screens. Specialty readers and guarded mutations follow separately within that approval.

| Before | After this slice |
| --- | --- |
| Catalog administration is predominantly Blade; patient booking reads are insufficient for admin history/details. | Four additive admin/root GET contracts list/show checkups and categories, using numeric existing IDs. Existing booking and Blade routes are unchanged. |
| No explicit private catalog DTO or archive-aware admin filters. | Allowlisted catalog facts, stable server pages, composed category/uncategorized/state/currency/price filters, literal English/Farsi title/name/slug search and exact public reference search. |
| History relationships could be confused with current offering eligibility. | Archived records and category links remain readable; counts preserve reservations, all workplace assignments and active/archived children. Catalog state is explicit and does not claim that a slot is bookable. |

Endpoints: `/api/admin/checkups`, `/api/admin/checkups/{checkupId}`, `/api/admin/checkup-categories`, `/api/admin/checkup-categories/{categoryId}`. Authentication, active-account and admin/root middleware remain mandatory. Readers independently reload active actors/roles before queries and refuse a changed role set before releasing the response. Every successful response is `no-store, private`.

## Contract

Default `state=current` includes active/inactive records and excludes archived records; `active`, `inactive`, `archived` and `all` are explicit. Category counts include all linked children, with active counts excluding archived children. Archived category metadata stays resolvable through checkup detail. Assignment counts include inactive assignments and are not availability/verification counts. No patient, doctor identity, reservation body, audit reason, archive author/reason, payment payload or clinical/private-storage fields are returned.

Lists return bounded metadata; details additionally return the existing description as plain text. Prices are exact decimal strings to avoid JavaScript integer rounding. Currency/range filters are validated; numeric price filters cannot exceed the JavaScript safe-integer bound. Page/per-page are bounded to1000/100, with an ID tie-breaker. Unsupported fields/sorts, array-shaped inputs, invalid/reversed prices and conflicting category/uncategorized filters refuse. Search percent/underscore/exclamation characters are escaped with an explicit SQL escape character, verified on SQLite and MySQL; they are not wildcard operators.

The reader has no mutation/advisory-save eligibility or revision contract yet. Current `updated_at` is a display fact and cannot replace the later server revision. New API writes must first supply fresh locked actor/relation authority, reason/password/revision and fail-closed audits. Legacy category create/update inspection found weaker audit/reason coverage; do not expose those Blade paths as JSON mutations or infer that the new guarded controls are ready.

## Acceptance and limits

Isolated **16 tests /272 assertions** (eight new catalog cases plus the retained Activity contract), scoped Pint **three files** and touched-file whitespace checks pass. Tests cover explicit DTO/privacy/exact prices, auth/refusals/cached and during-read role revocation, archive/category/history/assignment counts, literal Farsi search, tied paging, composed filters and malformed inputs. Two initial test harness issues were corrected: a visit-slot fixture needed the same working-window checkup to satisfy its composite foreign key; listener state needed an independent object per revocation case. These corrections preserve the production guards.

[Read-only MySQL proof](evidence/admin-catalog-read-runtime-2026-10-14.json) passes **ten direct controller checks** for existing synthetic admin2/root1 and **four actual guest HTTP401 refusals**. Exact category/currency/price composition and literal percent search work on MySQL. The first direct probe assigned its user resolver before Laravel rebound the request; assigning it after rebinding fixes that probe context. It establishes direct controller/MySQL acceptance; authenticated live HTTP/browser/panel acceptance remains open.

Read-only readiness at **October14 02:37:45 Tehran** retains Activity image789da82b/51 assets, twelve services, idle worker/jobs0, both read-only sockets and original completed/protected fingerprints. Catalog/assignment/slot hashes also match before/after. Existing history remains ready; fresh scanning remains blocked by the stopped scanner and absent current real probe. No source/UI rebuild, Compose operation, live business save, migration/schema/dependency/env change, definition request or job consumption occurs in this catalog slice.

[Immutable source/runtime binding](evidence/admin-catalog-read-foundation-2026-10-14.json). The four additive GET routes intentionally supersede the earlier route-file hash; all original route lines and Activity controller/test/runner remain unchanged. Activity acceptance remains its own immutable checkpoint.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-admin-catalog-read.ps1
if ($LASTEXITCODE -ne 0) { throw 'Isolated catalog read checks failed.' }
node scripts/media/check-demo-readiness.mjs
```

The test runner accepts no overrides: pinned installed image, UID33, read-only/network-none, bounded memory/CPU/PIDs/tmpfs, project environment/cache bypass, in-memory SQLite and masked private storage. The live read-only runtime helper is one-shot and refuses existing evidence; inspect its accepted proof rather than replaying it.

Rollback removes only this reader and its four additive GET routes through scoped source review, retaining every catalog/booking/payment/clinical record and the current static image. No schema/data rollback is needed. Next in order: checkup/category panel lists and card/grid details, then their guarded mutation foundation/controls; specialty readers/controls complete catalog before schedules, payments and general settings. Live successful saves/archives remain a separately guarded synthetic checkpoint.
