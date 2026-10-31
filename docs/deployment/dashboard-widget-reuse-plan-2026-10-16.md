# Dashboard widget reuse

Latest October16 amendment: the user explicitly replaces the visible Booking and completion trends and Locations overview row with the existing appointment calendar. All other gadgets remain. [Calendar scope and acceptance](dashboard-calendar-2026-10-16.md) supersedes the two trend/map rows below; the original sources and earlier immutable acceptance stay recoverable.

Initial October16 user direction: preserve the complete existing dashboard, its sections, charts, tables and gadgets. Reuse them for Checkupino; do not replace the page with a smaller card/list dashboard. No dashboard filters/search. Latest records and concise reports link to their full administration pages.

The current composition is `frontend/src/pages/DashboardEcommerce/index.tsx`: header, four widgets,8/4 trend/location row,6/6 product/seller tables,4/8 source chart/recent-orders row and the toggleable Recent Activity column. Preserve this structure, responsive behavior, original components and recoverable template reference. Keep original styling, installed charts, English/Farsi and flag-owned direction; no new dependency or stylesheet is needed for this mapping.

| Existing section/component | Checkupino use within the retained gadget |
| --- | --- |
| Summary cards — `Widgets.tsx` | Concise real reservation, medical-request, questionnaire and payment reports with their page buttons. Label periods and currencies accurately. |
| Revenue chart — `Revenue.tsx`, `DashboardEcommerceCharts.tsx` | Operational trends such as daily bookings, completions and questionnaire submissions. Preserve the chart and summary structure; keep count series distinct from money. |
| Sales by location — `SalesByLocations.tsx` | Retain the map/report gadget. Use authorized location aggregates only if reliable geographic data exists; otherwise show a clear unavailable state without invented countries or percentages. |
| Best Selling Products — `BestSellingProducts.tsx` | Retain the table/ranking gadget for checkup booking reports and links to the actual checkup/reservation pages. |
| Top Sellers — `TopSellers.tsx` | Retain the table/ranking gadget for doctor workload or appointment-volume summaries. This is recorded workload, not a clinical-quality ranking. Link to the existing doctor/reservation pages. |
| Store Visits by Source — `StoreVisits.tsx` | Retain the source/distribution chart gadget for a real operational distribution, initially reservation statuses. Do not describe this as website traffic or attribution without analytics data. |
| Recent Orders — `RecentOrders.tsx` | Retain the recent-records table for latest authorized reservations, real statuses and record/full-page buttons. |
| Recent Activity — `RecentActivity.tsx` | Preserve the complete column/gadget and its open/close behavior. Reserve it for future blogs, panel announcements/updates and individually authorized personalized notifications. Do not wire the administrative audit feed into it. |

The user explicitly reserves Recent Activity for a later content/notification feature. Preserve that extension point without implementing publishing, notification delivery, unread state, personalization or a new storage model in the operational-dashboard slice. When the real dashboard is wired, reserved/unsupported content uses a truthful empty/unavailable state rather than presenting template purchases/comments as real events. The original reference component remains recoverable.

The full Activity administration page remains available through existing navigation; reserving this dashboard widget does not remove or change that page or its filters. Existing feature-page filters/search stay intact. Production dashboard date/period dropdowns or inert report/export controls should become fixed reporting-period labels and working destination-page buttons as appropriate; preserve the original gadget and template reference, not fabricated interactions.

This is the reuse map for the authorized dashboard work. Verify each metric against available data, privacy and existing service contracts before binding it. Use fresh bounded read-only summaries, exact currency handling, latest-record limits, safe identity/status metadata and clear freshness. No clinical bodies, private identities, fabricated traffic, online presence or unsupported geographic claims. Keep domain/adapters separate from presentation for the expected client UI refactor.

The initial clarification changed planning documents only and preserved all twelve inventoried files. Implementation is now [deployed and accepted](admin-dashboard-2026-10-16.md): eleven original files retain exact hashes; the shared chart adapter alone gains optional real-data inputs with compatible defaults. All retained sections now have real bounded metadata reports or explicit unavailable/reserved states, with role/navigation/ENFA/mobile acceptance. Only static admin was built/recreated; no business mutation or template deletion occurred.
