## Verification Status

Historical archive preserved October 1. The active admin-panel module owns current behavior, authorization, runtime, and acceptance; dates and instructions below are historical.

Last reconciled against source/docs and user browser confirmation: 2026-09-07
Verification method:
- current frontend package/config/route/menu/auth source inspection
- Phase 1 backend baseline: SQLite 304 tests/1,796 assertions and user-confirmed MySQL 307 tests/1,816 assertions
- current backend route discovery: 121 non-vendor routes, including 68 API routes and no server-owned `/panel/*` route
- Latest Phase 2 verification through completed F27G/F27H (2026-09-11): 42 files/196 tests, typecheck, governed lint/fixtures, ratchets, formatting, and a 7.30-second production build. The unchanged lock retains the 2026-09-05 zero-finding production audit evidence. The user-confirmed normal/root toolbox, typography, icon, style, and console matrix passes after the Chat repair. F22 visual RTL debt remains transferred to Phase 3 demo-delivery item 11 for final stabilization.
- F12 query/list implementation: full lightweight quality passes seven test files and 63 tests; user-confirmed build/preview regression passes
- F13 capability/step-up implementation: full lightweight quality passes nine test files and 74 tests; the user confirms the current admin/root browser regression
- F14 additive product registry: full lightweight quality passes ten test files and 81 tests; production build passes in 4.87 seconds with no route/UI activation

If this file conflicts with source code, source code wins.
Update this module after verification.

# Admin Panel Context

Use this module for React admin shell, `/panel/*`, Velzon route/menu cleanup, root-admin developer toolbox isolation, RTL/localization, theme settings, and admin bundle optimization.

Do not load this module for backend-only auth role taxonomy unless frontend menus/routes are being changed.

## Current State

- Current production/runtime admin Blade panel still exists under `/admin/*`.
- Target admin UI is React + Bootstrap under `/panel/*`.
- `frontend/` is a Vite-powered Velzon React-TS workspace with an implemented standalone Nginx delivery image; it is not the canonical production admin until its user-run image/deployed-origin smoke and remaining Phase 2 gates pass.
- `frontend/package.json` exposes Vite dev/build/preview, strict TypeScript 7, Vitest/jsdom, Oxlint, formatting, fixture, ratchet, and combined quality commands. CI remains unapproved and absent.
- The stale forgot-password reducer import and CRA/Jest/ESLint remnants are removed; the governed lightweight quality gate passes.
- Active frontend session auth uses Sanctum cookies through one credentialed transport, gateway, and observable admin-auth authority. Expected guest/expiry 401 is silent; inactive and submitted-login failures remain explicit.
- One dormant RTK Query service is wired through the existing Redux reducer/middleware. Its separate list adapters preserve users, modern array, paginator-in-envelope, public naked, and raw compatibility shapes without global wire normalization.
- Presentation capabilities derive only from `/api/auth/me` roles and keep root-only controls separate. Recent-password coordination is UI-agnostic, server-expiry-owned, and bounded to one confirm/one retry after a 423.
- `frontend/src/panel/registry.ts` is the only production product-manifest composer. It composes neutral relative login/admin-home records from the Checkupino module; visibility, module owner, title, breadcrumbs, navigation order, and lazy loaders are validated in one schema. F25 activates those records through `frontend/src/panel/routes.tsx`.
- Persian/English locale metadata, locale-owned direction, local fonts, and persisted theme settings exist. The user reports widespread remaining Persian layout defects and missing or incorrect labels. New/touched product screens must correct paired labels during implementation; Phase 3 demo-delivery item 11 owns the comprehensive residual catalog audit and broad RTL geometry stabilization. The custom F22 shell stylesheet was reverted. The original Velzon visual structure and retained style assets are the baseline; diagnose its RTL path before proposing any bounded visual fix.
- React route/menu ownership is split for the first admin shell slice.
- F25 registers only manifest-relative `login` and admin-home index routes plus relative `dev/*` and a guarded wildcard under the `/panel` basename. The old `/forgot-password`, `/register`, `/index`, `/dashboard`, `/profile`, and `/logout` registrations are absent. Frozen Velzon links to unavailable placeholders resolve through the guest/admin fallback without activating a replacement page.
- Laravel registers no non-vendor `/panel/*` server route. The approved F29 standalone admin Nginx service owns production `/panel/*` redirects, static files, and history fallback without changing Laravel delivery.
- Root-admin developer/toolbox/demo routes are under `/panel/dev/*`.
- Former public Velzon demo/auth-inner/landing/maintenance routes are no longer public; they are root-admin protected under `/panel/dev/*`.
- Normal admin menu output shows only the neutral product home. After `/me` confirms `root-admin`, a lazy menu contribution additionally supplies the retained Developer Toolbox.
- Product-admin route definitions live in `frontend/src/panel/routes.tsx`; product-admin menu definitions live in `frontend/src/panel/menu.ts`.
- Root-admin toolbox/demo route definitions live in `frontend/src/devtools/toolboxRoutes.tsx`; root-admin toolbox menu behavior lives in `frontend/src/devtools/toolboxMenu.tsx`.
- `frontend/src/Routes/allRoutes.tsx` and `frontend/src/Layouts/LayoutMenuData.tsx` are small composers. F24B1/F25 leave one relative `dev/*` route entry in the former and a product-only context plus root-role lazy import in the latter; BrowserRouter adds `/panel` exactly once.
- `frontend/src/devtools/ToolboxRouter.tsx` owns the dynamically imported route inventory and page boundaries; `frontend/src/devtools/ToolboxNavigationData.tsx` owns the dynamically imported menu hook. Neither chunk is preloaded by the production HTML.
- Route rendering uses a lightweight `Suspense` fallback in `frontend/src/Routes/index.tsx`.
- A 2026-06-28 build reduced the then-current main JS bundle from 13,716,961 bytes to about 594 KB. Phase 2 must produce fresh bundle evidence before treating this as the current budget.
- That historical build still contained large lazy toolbox/vendor chunks and a shared shell chunk over Vite's warning threshold.
- Retained Velzon shell/customizer assets remain grouped in `frontend/src/Layouts/shellAssets.ts` and the restored header/sidebar/profile/customizer intentionally use the original logo, avatar, and preview assets as the frozen visual baseline.
- The active header mounts the restored Velzon search, language, fullscreen, color-mode, and profile controls, and the layout mounts the original `RightSidebar` customizer. F18 remains additive and unmounted.
- User browser review confirmed normal admin and root-admin views behave correctly after the split.
- F23 removes `frontend/src/helpers/fakebackend_helper.ts`, its global Axios client/Themesbrand config, the all-thunks/common-data barrels, and every demo reducer from the statically verified normal entry/auth/dashboard graph. The active dashboard retains its exact local ecommerce fixtures; Revenue now selects those arrays locally instead of issuing failed fake requests. Root-toolbox route loading dynamically installs retained demo reducers, which keeps their source recoverable and opt-in. F24B1 adds lazy menu and route-inventory boundaries; F24B2 remains deferred for styles, locale payloads, fonts, images, allowlisting, and recoverable quarantine.

## Open First

Backend/admin surface:

- `routes/admin.php`
- `routes/api.php`
- `app/Http/Controllers/Admin/*`
- `app/Http/Controllers/Api/Admin/*`
- `resources/views/admin/*`

Frontend shell:

- `frontend/src/App.tsx`
- `frontend/src/Routes/AuthProtected.tsx`
- `frontend/src/Routes/allRoutes.tsx`
- `frontend/src/Routes/routeHelpers.tsx`
- `frontend/src/Routes/routeTypes.ts`
- `frontend/src/panel/routes.tsx`
- `frontend/src/panel/registry.ts`
- `frontend/src/panel/menu.ts`
- `frontend/src/devtools/toolboxRoutes.tsx`
- `frontend/src/devtools/toolboxMenu.tsx`
- `frontend/src/Layouts/index.tsx`
- `frontend/src/Layouts/VerticalLayouts/index.tsx`
- `frontend/src/Layouts/HorizontalLayout/index.tsx`
- `frontend/src/Layouts/TwoColumnLayout/index.tsx`
- `frontend/src/Layouts/Sidebar.tsx`
- `frontend/src/Layouts/Header.tsx`
- `frontend/src/Components/Common/ProfileDropdown.tsx`
- `frontend/src/Components/Common/LanguageDropdown.tsx`
- `frontend/src/slices/layouts/*`
- `frontend/src/helpers/session_api.ts`
- `frontend/src/modules/checkupino/auth/*`
- `frontend/src/modules/checkupino/query/*`
- `frontend/src/helpers/fakebackend_helper.ts`
- `frontend/src/locales/fa.json`
- `frontend/src/i18n.ts`

## Heavy Paths

Avoid broad scans of:

- `frontend/src/pages/`
- `frontend/src/assets/`
- `frontend/public/assets/`

Open individual pages only when moving a specific route.

## Guardrails

- Do not treat the Velzon demo inventory as product admin functionality.
- Do not delete demo/fake helper code until the root-admin/devtool boundary is designed.
- Normal admin initial load should not pay for root-admin/demo utilities.
- Keep admin React styling Bootstrap-oriented.
- Keep public/client React styling Tailwind-oriented.
- Browser admin auth must remain session-cookie based.
- Backend policy remains authoritative; route/menu visibility is not authorization.
- Multilingual integration must preserve the original Velzon composition: existing worded elements move to complete Persian/English translation keys in place, the existing flag selector owns language, and language exclusively owns document direction. Do not change markup, assets, classes, control placement, or visual design while translating. Documentation, task logs, and code comments remain English.
- F15A is approved: product locale is limited to Persian and English, and language is the sole direction authority (`fa` -> RTL, `en` -> LTR). Remove the separate direction preference/control rather than trying to synchronize two user settings.
- F15 implements that foundation: pre-render startup applies versioned locale/direction and System/Light/Dark preferences; Redux no longer owns direction; the customizer has no standalone direction control; Persian/Arabic-Indic input digits normalize to ASCII at the formatter seam; Farsi dates use the Persian calendar, English dates use Gregorian, and timestamps display in Asia/Tehran. The active Persian font is the pinned local OFL Vazirmatn v33.003 variable WOFF2. Live review proved the then-active retained RTL imports broke shell geometry, so those imports remain excluded pending diagnosis. F22 must preserve the original Velzon composition, determine the template-supported RTL/LTR asset path, and request approval before any visual correction.
- F16 provides paired Persian/English loading, empty, error, visible-status, and imperative-toast primitives. It preserves the F10 wire classification, field errors, status/code/retry/correlation details, leaves cancellation quiet, and exposes retry UI only for caller-supplied actions. Toastify product ownership is confined to `modules/checkupino/feedback/Toast.tsx`; the shared legacy Loader delegates to the primitives without a render side effect. F22 removed the retained registration page's render-time toast and the ratcheted render-time-toast allowlist is now empty.
- F17 exactly pins RHF 7.86.0, Zod 4.4.3, and resolvers 5.9.1 behind one Checkupino form adapter. Plain Bootstrap text/textarea/select/native-date/file primitives remain library-independent, accessible, bilingual, document-direction-owned, and keyboard-native. Server validation preserves exact dotted API or ordinary `/login` field keys plus global/unmatched/support metadata; known errors apply to RHF without losing the complete result. Formik/Yup remains outside product modules. Focused OSV results for the new four-package resolved family are empty; this is not a claim about the retained legacy lock.
- F18 implements additive native-dialog/drawer, reasoned archive, and ephemeral recent-password presentation. Automated interaction tests prove focus trap/return, Escape, logical direction, busy/duplicate suppression, non-optimistic promise completion, exact `{ reason }`, retained structured failures, and the F13 cancel/abort/one-confirm/one-retry contract; the correctly configured focused rerun passes 3 files/10 tests on 2026-09-02. The user explicitly deferred F18 so work continues from F22 onward. It remains unmounted after the Velzon restoration and resumes only at an approved real product consumer; do not add a harness route or replace the original customizer merely to close it.
- F19 pins TanStack React Table 9.2.3. Checkupino owns one native-v9 controlled server-table contract; the two retained Velzon v8-style wrappers are explicitly isolated on v9's `/legacy` bridge. Product tables register no client sort/filter/pagination row model, serialize only endpoint-allowlisted URL/backend parameters, preserve mixed route identifiers, use collision-safe stable row IDs, standard responsive overflow, paired Persian/English copy, keyboard-native controls, and logical start/end pinning. Optional controlled selection is current-page-only, clears on query changes, and does not imply bulk actions. F12 adapters normalize incompatible Laravel envelopes before rendering. F27E has removed the separate unused `react-table` v7 runtime/types.
- F20 provides presentation-only local file selection, safe file metadata, and an immutable audit timeline. Its file contract mirrors only the six safe fields emitted by `ReservationMedicalFileResource`; unavailable entries have no open action, client file constraints are visibly non-authoritative hints, and no storage/scan/retention internals render. Its audit contract accepts only public ID, translated action/actor labels, timestamp, outcome, and reason from an authorized caller; it does not fetch and cannot render raw snapshots, route, IP, user-agent, or subject internals. Interface and network/privacy ratchets protect both surfaces.
- F21 stabilizes the retained shell without redesigning it: search/scroll/overlay/resize/fullscreen listeners and the preloader timer now clean up, DOM reads are guarded, horizontal menu records are not mutated during render, and search state is React-owned. One shell provider fans out the shared F11 auth snapshot. Only System color preference subscribes to `prefers-color-scheme`; explicit Light/Dark never does. Lifecycle/auth/theme ratchets and focused tests protect these seams. Full quality passes 27 files/164 tests and the production build passes in 10.65 seconds; the user confirms the required live navigation/resize/search/fullscreen/theme smoke. F21 is complete.
- F22 is complete for technical integration under the technical-only approval. The user selected the checked-in vanilla notification/dashboard behavior; no dormant control was mounted and no dashboard semantics were invented. The original Velzon composition remains frozen, translated in place, connected to shared auth identity, role-derived navigation, controlled logout, and language-owned direction. The restored-baseline production build passes in 10.89 seconds on 2026-09-02. User-observed physical utility/custom-class RTL geometry defects are transferred to Phase 3 demo-delivery item 11; they are not claimed fixed, but they do not block functional work.
- F23 is complete: startup Redux is limited to RTK Query, Layout, and retained auth-page state. Root-toolbox routes opt into demo reducers through a dynamic installer; active shell imports direct layout actions, dashboard cards import their specific fixture module, and Revenue no longer reaches fake Axios. Static graph and runtime-state tests protect both absence and opt-in installation, and an integrated test proves a real `/panel/dev/pages-starter` lazy page renders after retained reducer installation. Full lightweight quality passes 36 files/181 tests with `any` debt at 2,518. Artifact inspection confirms separate, non-preloaded installer and fake/Themesbrand chunks. The user confirms root menu/Starter loading and ordinary-admin menu/direct-route denial.
- F24A completes root-admin ecosystem authority without changing a demo page: one shared contract owns the `/panel/dev` base/default/compatibility paths; all 181 unique retained menu targets match the retained route inventory; all retained routes carry the root-only role contract; `/me` role-derived capability controls menu visibility; and direct-route tests cover root, ordinary admin, and non-admin outcomes.
- F24B1 is complete without URL, page, reducer, label, DOM, style, asset, or dependency changes. Ordinary-admin navigation never imports the toolbox menu; confirmed roots lazy-load it. The guarded `/panel/dev/*` entry lazy-loads the route inventory, retained pages, and F23 installer. Full quality passes 37 files/183 tests. The 7.32-second production artifact emits non-preloaded 21,161-byte menu, 44,394-byte router, and 21,553-byte installer chunks and reduces initial JS from 412,180 to 364,819 bytes. The shared catalogs and neutral default-path constant retain toolbox strings but not eager toolbox imports. The user confirms ordinary-admin menu/direct-route denial and root-admin menu, Starter, and Swiper behavior with no blank/reset shell.
- F24B2 is deferred and does not block F25. It later closes style/locale/font/image startup isolation and recoverable quarantine through bounded F27G-F27I evidence. It cannot absorb full RTL geometry repair, design changes, or physical deletion.
- F25 is complete with exact Router 7.18.3, which officially supports Node >=20 and React/ReactDOM >=18. The active product router derives from the relative registry; Vite/BrowserRouter share `/panel`; bare `/panel` redirects to `/panel/` in development/preview; devtool links/routes are router-local; removed and unknown routes have role-aware canonical fallbacks; and the original Velzon composition is unchanged. F29 implements the approved production equivalent in a separate Node 24.19.0/Nginx admin image: only `/panel/*` receives SPA fallback, missing assets and outside paths return 404, hashed assets cache immutably, and the browser calls the separately configured Laravel origin. The image rejects the reserved example API origin. Laravel's local CSRF/login/me sequence passes 204/200/200 after the first container smoke exposed a placeholder build and competing hostnames; the user confirms the aligned Vite panel now logs in and loads. Full quality passes 44 files/203 tests and the local production build passes in 5.50 seconds with all initial references under `/panel/` and no toolbox preload. The user-run rebuilt-image/deployed-origin smoke and F27I disposition remain before F29 completes.
- F27A is complete under the user-approved GPL path. Exact modular `ckeditor5` 48.5.0 and React adapter 11.2.0 replace the deprecated predefined build; one common adapter owns `licenseKey: "GPL"`, selected plugins, and CSS while the five retained Velzon consumers keep their composition. `lodash-es` resolves to 4.18.1 without an override, and `public/THIRD_PARTY_NOTICES.txt` ships with the artifact. Exact `react-quilljs` 2.0.4/Quill 2.0.2 closes the independent constructor crash. Full quality passes 40 files/194 tests, build passes in 9.65 seconds, the editor chunk decreases to 905.76 kB/239.35 kB gzip and stays lazy, the F27A audit then contained only two moderate ECharts records (subsequently cleared by F27B), and the user-confirmed editor route passes.
- F27B/F27C are complete after user browser confirmation on 2026-09-07. Exact ECharts 6.1.0/wrapper 3.0.6 use the official v5 theme through VelzonEChart, including preserved rich-label behavior; all charts at `/panel/dev/charts-echarts` render without blanks, displaced labels, overlaps, or console errors. The lazy chunk is 1,183.68 kB/391.14 kB gzip and remains absent from initial HTML. Three retained landing pages use dependency-free VelzonScrollspy after deprecated `react-scrollspy` removal; `/panel/dev/landing` tracks active sections on scroll and its links reach the correct sections.
- F27D-F27F are complete. Exact Moment 2.30.1 stays lazy in 17 retained demos with no locale imports; table v7 runtime/types are absent; `classnames` 2.5.1, `lodash` 4.18.1, `prop-types` 15.8.1, and toolbox-only wrapper-compatible `nouislider` 14.7.0 are exact direct dependencies. Ambient shims are 10 and undeclared runtime families are zero.
- F27G is complete under the user's modular-toolbox approval. The lazy `ToolboxRouter` owns one ordered stylesheet entry containing 42 retained demo plugin/page families, two vendor bases, and their exact former shared-theme overrides; shared product/shell families remain global. Full quality passes 42 files/196 tests and build passes in 7.24 seconds. Initial CSS falls from 1,118,288/179,743 gzip to 1,005,308/158,726; the separate 112,887/20,886 toolbox stylesheet is absent from initial HTML. Ratchets protect order, lazy ownership, and global exclusion.
- F27H is complete under the user's WOFF2-only approval. Active HKGrotesk, variable Vazirmatn, Material Design Icons, Boxicons, Line Awesome, and Remix Icon declarations retain their current families/weights and reference 11 WOFF2 files only; the unused local Roboto TTF face is excluded. Emitted fonts fall from 34 files/8,375,625 bytes to 11/1,135,684, while legacy files remain recoverable in source. Only `en`/`fa` are imported; seven retained reference catalogs emit no payload. The build passes in 7.30 seconds with initial CSS at 1,002,953/158,135 gzip. Ratchets reject every active legacy font URL. The user-confirmed combined matrix passes on 2026-09-11.
- The first F27G/F27H browser matrix found `/panel/dev/apps-chat` calling the obsolete Themesbrand API, then crashing because failed response data was not an array. The retained Chat route now imports its direct thunk; that thunk clones local room fixtures and performs add/delete locally. Its built static closure has no fake helper, aggregate thunk barrel, or external URL marker. The Alert transition timeout warning is fixed without changing markup/classes. A focused state regression passes, complete quality passed 43 files/197 tests before the final direct-import isolation, and the final boundary passes typecheck, focused Chat/Quill, lint/fixtures, ratchets, formatting, and an 8.77-second build. One repeat suite hit only the known Quill timeout. The user confirms the live Chat repair on 2026-09-10.
- F26 is complete and exactly pins/locks Swiper 14.2.0 without changing any Velzon component configuration, markup, classes, placement, or styling. All active and retained imports pass TypeScript unchanged, the real React wrapper renders the original four review cards in a focused DOM test, current full lightweight quality passes 36 files/181 tests, and the production build passes in 5.45 seconds. The Swiper React chunk decreases from 81.34 to 79.22 kB minified (24.71 to 24.34 kB gzip); lock audit decreases from 65 findings/one critical to 64 findings/zero critical with no Swiper key. A ratchet enforces the exact manifest/lock version, and the user confirms `/panel/dev/advance-ui-swiper` renders through the verified toolbox. Exact 12.2.0 is the fixed rollback only if a later real v14 defect appears.
- The checked-in Velzon header baseline does not mount the retained `NotificationDropdown`; reintroducing it would change header composition/placement and requires explicit approval. The retained RTL styles have multiple known geometry/placement defects and are expected to require substantial dedicated effort. Inventory and reproduce them separately, then obtain approval for bounded CSS fixes; do not mix RTL repair into otherwise independent backend or localization slices.
- Do not finalize canonical routes, core/module ownership, dependency choices, visual direction, or toolbox deletion without user approval.
- Report each Phase 2 gate separately and use the dated latest evidence above; earlier feature-specific counts are historical. F23-F27H and F28 are complete except the deliberately deferred F18. F27I page/image allowlisting and quarantine are user-deferred until 2026-09-21; its 191 toolbox-only media assets/12,402,463 bytes remain outside normal startup. F28's active shell consumes product navigation from the manifest, the root-only System slot retains paired locale entries and remains inert with no UI or route, and the lazy Developer Toolbox stays last. The user accepted the focused admin/root sidebar behavior. Paired English/Farsi text and language-owned direction remain continuous requirements. F24B2/F27I, F18's genuine consumer/browser gate, deployed fallback, CI, and portability remain open.
- The user explicitly defers local `/me` cold latency. Unauthenticated probes reproduce 1.19-1.36 second post-idle TTFB versus 65-73 ms immediate warm responses; live PHP has OPcache timestamp validation enabled with a two-second interval, and Compose bind-mounts the Windows repository including `vendor` into `/var/www`. The pending Vite WebSocket is normal HMR. Treat this as local container/filesystem performance debt, not an auth or editor regression.

## Verification

```powershell
cd frontend
npm.cmd run quality
npm.cmd run build
```

The user runs clean/install, genuinely long, and Docker commands. Codex may run the already-installed frontend quality/build commands while they remain fast. CI scripts/workflows remain gated and absent.

If backend authority or routes change too:

```bash
docker compose exec app php artisan route:list --except-vendor
docker compose exec app php artisan test
```

## Update After Changes

- This module for durable admin shell/toolbox facts.
- `CURRENT_TASK.md` when the active route/menu implementation queue changes.
- `docs/architecture/boundaries.md` if UI ownership boundaries change.
