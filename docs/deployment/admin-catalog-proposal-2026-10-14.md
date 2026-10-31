# Next catalog administration slices

Approved October 14: the user explicitly answered “Approve the proposed catalog routes and controls.” This covers all six stated routes, navigation and controls across the bounded slices below. Live saves, dependencies and schema changes remain outside this approval.

Prepared October 14, 2026, Asia/Tehran, after the user's instruction to continue administration in order. Existing broad catalog administration authorization is recorded; this proposal fixes the additional canonical routes/navigation and retained composition before wiring them. No live business action is requested here.

## Routes and retained composition

| Page | Proposed URL | Composition |
| --- | --- | --- |
| Checkups | `/panel/checkups` | Existing server table/search/status-category filters, quick presets, pagination, refresh/reset; row detail entry and authorized Create. |
| Checkup detail | `/panel/checkups/:checkupId` | Numeric existing ID; retained card/grid facts and inline edit/normal confirmation controls. |
| Categories | `/panel/checkup-categories` | Same server table/filters; authorized create and row detail entry. |
| Category detail | `/panel/checkup-categories/:categoryId` | Numeric existing ID; retained card/grid and edit; explicit governed detach-or-reassign archive dialog. |
| Specialties | `/panel/specialties` | Same server table with parent/active filters and row detail entry. |
| Specialty detail | `/panel/specialties/:specialtyId` | Numeric existing ID; retained card/grid and governed edits; reference-aware archive only after source rules pass. |

All six routes are admin/root Product Admin routes, lazy, using the existing React18/Bootstrap/Velzon tables/forms/cards/dialogs and the existing transport. Add Checkups, Categories and Specialties after Activity and before root Upload limits; keep the inert System slot and lazy Developer Toolbox separate. EN/Farsi/flag-owned direction, responsive tables and reservation-style detail boxes are retained. No stylesheet, dependency or new UI stack. Client design refactoring remains expected; presentation adapters stay separate from business services.

## Fields and controls

- Checkup: title/slug/category/plain-text description, price/currency/default duration and existing availability state where its authority contract allows it. Show booked-history relationships read-only; changes affect permitted future offerings and never rewrite existing reservation/payment snapshots or materialized-slot overrides.
- Category: existing name/slug/description facts and linked checkup counts. Archive chooses explicit detach or reassignment to a freshly eligible category; preserve active/archived children, bookings, medical files/reports and payment history. No cascading deletion.
- Specialty: existing name/slug/parent hierarchy and doctor associations. Reject invalid hierarchy/cycles and unsafe referenced changes through server-owned rules; no doctor verification or role reassignment is implied.
- All permitted mutations require fresh active authority, server revisions/current relation reads, explicit reason/confirmation, normal recent-password checks where designated, atomic fail-closed audit, cancellation/session-abort and uncertain-result manual-refresh safeguards. Archived/noneligible controls stay disabled. There is no restore/purge/bulk edit/export or hard deletion.
- No raw HTML input. Plain-text fields remain plain text; any later actual HTML contract uses the already accepted visual editor/sanitizer and needs no new editor dependency.

## Delivery boundaries

Implement first safe JSON read contracts and isolated tests; legacy catalog controllers are predominantly Blade and cannot be treated as admin JSON resources. Harden/wire ordinary audited writes only when each existing rule is verified. Deliver checkups/categories first and specialties next in bounded source/deployment/read-only slices. Existing historical24/215 catalog checks are reference evidence, not fresh acceptance.

No dependency/schema/live migration/reseed/reset/credential replacement, scanner/worker activation or real-patient operation is authorized by this proposal. Use isolated synthetic fixtures; preserve the dirty worktree, protected patients7/8, completed demo, hazelnut2.0 and NebulaNV. Successful live catalog saves/archives remain a separate guarded synthetic acceptance gate.

Sources: [catalog module](../ai-context/modules/checkups.md), [broad administration proposal](admin-feature-coverage-proposal-2026-10-11.md), [AI_BOOT approval boundary](../../AI_BOOT.md). AI_BOOT explicitly requires approval before finalizing canonical `/panel/*` URLs and navigation/page composition/component UX. This one approval covers the six routes and stated controls across these catalog slices; it does not broaden backend authority or authorize irreversible operations.
