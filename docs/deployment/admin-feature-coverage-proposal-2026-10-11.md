# Complete administration in the retained panel

**Approved October 11:** the user accepted the stated routes/navigation and retained page/dashboard composition: “lets go with this for now we'll expand it.” This approval covers these screens across the following verified slices; exact further routes and scope expansions remain separate. Clinical read and administrative actions were already selected separately.

**October16 dashboard correction:** the user requests latest records and report summaries with buttons to their actual administration pages. Do not add dashboard filters or search; filtering/search remain on the full feature pages. This supersedes the earlier dashboard-filter wording only; existing feature-page filters and privacy/metric safeguards remain.

**October16 widget-preservation direction:** retain the complete original dashboard sections/charts/tables and reuse Top Sellers, Recent Orders, Store Visits by Source and the other gadgets. Preserve Recent Activity for future blogs, panel updates and personalized notifications; do not repurpose it as the audit feed. [The reuse map](dashboard-widget-reuse-plan-2026-10-16.md) supersedes any earlier plan to reduce the dashboard or bind audit events to that column. Unsupported analytics/geography must remain truthfully unavailable.

User requests complete administrative coverage of reservations, medical requests, questionnaires and other product features, doctor/patient filters, advanced and quick filters/search, and useful feature/user/doctor reports and activity logs on the dashboard. This explicitly brings broader product administration into scope; large-media/multipart/public SEO remain deferred. The user separately selects **clinical read access and administrative actions** for ordinary admins. This is a requested outcome, not a claim that these screens or permissions are already delivered.

## Source discovery and gaps

- Reservations already have admin list/detail, doctor-profile/patient/checkup/payment/status/search/sort/pagination APIs and guarded reschedule/root-only status override services. The panel has no admin reservation route. The first source slice adds validated filter shapes, Tehran date bounds, workplace filtering, exact ID search, stable tie sorting and explicit booked snapshot fields; existing detail/list envelopes and legacy fields remain.
- Admin questionnaire definition/create/update/archive and submission list/detail/archive APIs exist. Current submission summaries omit owner identity/answer detail and the listing lacks patient/date filters. A dedicated admin resource and contract hardening are needed before claiming complete submission management. Existing version, recommendations, rich-text sanitization and archive safeguards must be reused.
- The general medical policies currently permit contents/actions only for the patient or assigned doctor. The requested admin scope requires explicit admin API resources/policies/service checks and audited actor attribution; exposing doctor screens through a menu alone is insufficient. No medical policy is changed by the first reservation slice.
- Doctor listing/verification and catalog administration primitives exist, but several are Blade-only or lack complete admin JSON contracts. Patient/doctor operational pages, workplace/schedule management and linked drill-downs need separate bounded wiring.
- There is no live product dashboard/API or activity-log panel. The existing React home uses ecommerce fixtures; the Blade dashboard controller only returns a view. Existing audit events cover recorded business actions, not all clicks, sessions or online presence. Reports must describe only measurable data.

## Proposed routes and navigation — one composition decision

Use the existing authenticated admin/root-admin Product Admin section, retained Velzon sidebar/icons/breadcrumbs and one shared credentialed transport. Keep users and root-only upload limits. Add the following routes lazily:

| Page | Proposed canonical panel route | First accepted behavior |
| --- | --- | --- |
| Dashboard | `/panel/`, existing route | Latest operational records/report summaries/activity previews and buttons to full pages; no dashboard filters |
| Reservations | `/panel/reservations` | Server list/search/filter/sort/pagination |
| Reservation detail | `/panel/reservations/:reservationId` | Numeric admin reservation ID; safe detail and authorized actions |
| Medical requests | `/panel/medical-requests` | Cross-reservation doctor/patient/status/date list |
| Medical request detail | `/panel/medical-requests/:requestId` | Public request ID; authorized clinical read/administrative controls |
| Questionnaires | `/panel/questionnaires` | Definition/status/version list and governed editor |
| Questionnaire detail/editor | `/panel/questionnaires/:questionnaireId` | Numeric definition ID; questions/choices/recommendation rules |
| Submissions | `/panel/questionnaire-submissions` | Owner/questionnaire/date/result list |
| Submission detail | `/panel/questionnaire-submissions/:submissionId` | Public submission ID via an explicit admin lookup; saved answer/version snapshot |
| Doctors | `/panel/doctors` | Verification/specialty/workplace filters and linked activity |
| Patients | `/panel/patients` | Reuse the user directory with a fixed patient scope and linked activity |
| Activity | `/panel/activity` | Paginated authorized structured business-audit records |

Detail navigation is entered from rows; doctor/patient links carry explicit URL filters into related lists. Sidebar order: Dashboard, Reservations, Medical requests, Questionnaires, Submissions, Doctors, Patients, Users, root-only Upload limits. Activity is a Product Admin entry, not the inert System extension or Developer Toolbox. Catalog/payments/schedule/settings follow as feature-completion slices with their existing authority contracts; exact additional URLs/controls will be proposed before they are wired.

Keep the original DashboardEcommerce/toolbox reference recoverable. A separate product dashboard reuses the current Velzon row/column/card/table/chart structure and installed components. Do not delete template inventory, add a stylesheet/framework/chart dependency or introduce another UI stack. Presentation components/adapters remain separate from service rules for the client's expected later refactor.

## Shared search, quick filters and advanced filters

- Tables use server pagination (20 default,100 cap), stable sorting and explicit current/loading/error/empty states. Search and filter state is URL-owned so refresh/back/drill-down preserve it; role/session changes clear session-owned cached data. Reuse the governed shared table, forms, confirmation and recent-password controls.
- Reservations: exact numeric/public ID or patient/doctor/specialty/checkup text; doctor profile, patient, workplace, checkup, appointment status, payment state and inclusive Tehran date range. Quick chips: Today, Upcoming, Awaiting payment, Paid, Completed, Cancelled, Reconciliation. Chips map to visible server filters; upcoming/today require actual server time bounds, not current-page client filtering.
- Medical: doctor/patient/reservation/request identity, issued/review/completed/cancelled state, received/checking/eligible file summaries and date window. Quick chips: Awaiting upload, Awaiting checks, Ready for review, In review, Published, Requires attention. Aggregate meanings must come from existing server rules; a quarantined file or idle worker does not establish active scanning.
- Questionnaires: title/slug/status/version/author/date; Draft/Published quick filters. Submissions: questionnaire/version/patient or explicitly guest, submitted date, score/result where supported. Owner comes from the saved submission, never a client-supplied identity. Preserve historical answer/definition/result snapshots when definitions change.
- Doctors/patients: text/identity, account state, registration dates and relevant verification/specialty/workplace filters. Quick drill-downs to reservations, requests, submissions and authorized activity. Normal admins retain existing restrictions on privileged identities.
- Activity: authorized actor/role, action/category, subject public ID, risk and date. Only whitelisted structured facts/reasons are shown; credentials, tokens, provider payloads, storage paths and raw application logs are excluded.

Translate controls, columns, presets, status, confirmation, empty/error/success feedback and accessibility labels in EN/Farsi. Retain the existing flag-owned direction, Tehran date/money formatting and Bootstrap geometry. Add reset-filters/manual-refresh and keyboard controls without broad restyling.

## Dashboard composition and metric definitions

Reuse four summary cards followed by the existing8/4 chart-summary row, both retained table/chart rows and the complete Recent Activity side column. Keep all original gadgets; bind operational data according to the reuse map, while reserving Recent Activity for future blogs/panel updates/personalized notifications rather than audits. Show concise real reports/latest authorized records with full-page buttons and clear period/freshness. No dashboard date/doctor/patient filters or search; users investigate on the destination pages.

1. Reservations: count/status breakdown, today/upcoming appointments and pending-payment/reconciliation attention.
2. Medical workload: requests awaiting upload/checks/review, in-review/completed counts and eligible/published outcomes; show scanner readiness separately and truthfully.
3. Questionnaire activity: submitted counts, definition/version usage and score/result distribution for the selected scope.
4. Patient/doctor accounts: registered/active-state counts and verified/unverified doctors. “Active account” means account state, not online presence.
5. Trends and drill-downs: daily booking/completion/submission counts, doctor workloads and recent authorized actions. Bound queries and use actual server aggregates, not fixture cards or sums of a paginated list.
6. Payment summary: distinguish booked value, canonical successful payments, refunds and reconciliation; group amounts by currency, never combine currencies or describe held/unpaid bookings as revenue.

Unavailable metrics remain explicitly unavailable until their source contract exists. No invented website analytics, login presence, clinical outcomes or missing-data extrapolation. Product activity logs and optional host/container monitoring remain different scopes.

## Permission and action delivery

Both admin roles get the requested product operational/clinical oversight through dedicated resources. Preserve normal-admin/root identity/settings/override distinctions and existing backend gates; route visibility is not authorization.

Clinical read and administrative actions are requested: medical detail/file/report reading and explicit request/review/draft/publication/amendment administration must be implemented through service-owned checks with the actual actor and author provenance. Existing patient/doctor ownership boundaries remain on their routes. New admin endpoints must be tested for cross-reservation bindings, role denial and permitted actions; never impersonate the assigned doctor.

Files remain unavailable when quarantined, infected, stale/unverified, expired, missing or integrity-invalid. Admin access cannot mark a file clean or bypass content/scanner/ownership/linkage/retention checks. Issued attachment policy stays immutable; amendments remain new rows and published reports immutable. Every admin clinical mutation requires explicit confirmation, a reason, recent-password checks where designated, transaction/audit integrity and ambiguous-delivery protection. The exact service action matrix is verified in its own slice before any clinical UI action is enabled.

Reservation reschedule uses real server slots and audited reasons; only permitted root override states are offered. A payment summary is not manually marked paid. Questionnaire edits/publication/archive retain version/history, sanitizer and audit controls. No bulk deletion, export, scheduling sweep or unbounded raw-log browser is inferred from this request.

## Execution and acceptance order

1. **Now:** safe reservation read contract and isolated tests, then approved reservation list/detail/filter wiring and deployed role/ENFA/refresh acceptance.
2. Medical admin read/policy resources and lists, then individually verified requested administrative actions. Dedicated controlled scanning recovery remains an independent open gate.
3. Questionnaire definitions/submission ownership/detail/filter contracts and panel list/editor/actions, preserving the accepted demo fixture/submission.
4. Doctor/patient operational drill-downs and authorized activity reader; fill catalog/schedule/payment/settings management gaps in bounded slices.
5. Live dashboard aggregation and previews/drill-downs once the measured lists/contracts are accepted; replace product home fixtures through the new isolated presentation.
6. Final admin/root/doctor/patient denial matrix, cancellation/uncertain writes, filters/search/pagination, ENFA/keyboard/RTL, current served artifact and immutable/protected-data evidence.

“Complete” means accepted ordinary positive actions and refusal/recovery/refresh/history behavior for each feature, not menus, containers or source tests alone. Distinguish API source, deployed reads, successful audited mutations and remaining gaps. No Monday completion estimate for the expanded scope is established.

## Guardrails, rollback and design boundary

No new dependencies, live migration/reset/reseed/backfill/credential changes, general workers, definition retry or protected-account changes. Synthetic fixtures only in isolated tests; protected7/8/hazelnut2.0/NebulaNV stay untouched. Preserve SeaweedFS/AWS, existing upload policies, canonical payments and all golden-flow proofs. Do not replay closed writers.

First reservation source changes are additive response fields/read validation/filtering; rollback restores that controller source and leaves data/permissions/UI unchanged. Later UI rollback retains the accepted static candidate tags and all audit/clinical/version history.

The broad feature request, clinical access/actions decision and October 11 composition approval authorize the stated implementation. [AI_BOOT.md](../../AI_BOOT.md) requires human approval before finalizing “canonical `/panel/*` URLs” and “navigation, page composition, component UX, Persian/RTL behavior, and visual direction.” [CODEX_RULES.md](../../CODEX_RULES.md) preserves the same boundary. That approval is now recorded above; do not ask again for these routes/composition. New unrelated routes, dependencies, schema or design changes retain their boundaries.
