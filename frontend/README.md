# Checkupino Frontend Workspace

This folder contains the active Velzon React-TS admin workspace.

Current status:
- Migrated from Create React App/react-scripts to Vite.
- Uses React 18, TypeScript, Bootstrap 5, Reactstrap, Redux, Axios, Formik, and Yup.
- Approved admin target is React 18 + Bootstrap on a separate admin origin under canonical `/panel/*` routes; F25 canonical route activation and its live role/logout verification are complete.
- Local Docker static/backend/artifact/browser acceptance passes after the user rebuilt the admin and repaired the development PHP Redis extension. Production environment/TLS, full release workflows, deferred asset disposition, CI, and portability remain open; the panel is not declared production-ready.
- Active admin login/logout/current-user flow uses Laravel Sanctum session cookies.
- Guard, header, menu, profile, login, and logout delegate to one observable admin-auth authority; its lightweight and user-confirmed browser gates pass.
- One RTK Query service is wired through the existing Redux store with endpoint-specific list adapters. The API-backed user directory consumes its typed user endpoint; authenticated identity/role changes clear query data so cache entries cannot carry across sessions.
- Role-derived presentation capabilities and a UI-agnostic recent-password retry coordinator are implemented and browser-verified.
- One product registry owns login/admin-home/user-directory metadata, visibility, loaders, breadcrumbs, and relative href composition under one `/panel` basename. `/panel/users` supplies server search, role/date filters, sorting, pagination, and paired English/Farsi labels.
- The original Velzon design, logo/assets, component composition, classes, controls, and placements are frozen. Multilingual work translates existing text in place through the flag selector; language alone owns RTL/LTR. No custom shell/RTL geometry change is approved.
- Velzon demo routes are lazy and root-admin-gated under `/panel/dev/*`; fake demo helpers remain and require an import/bundle audit before removal or stronger quarantine.
- The retained editors pin `react-quilljs` 2.0.4 with Quill 2.0.2 and use modular CKEditor 5. CKEditor is configured with the approved `GPL` key; its distributable notice is `public/THIRD_PARTY_NOTICES.txt`.

## Commands

October 1 checkpoint: runtime recovery and the user directory are delivered. Development backend and standalone admin remain separate Compose projects. Use `localhost:3000` with `localhost:8080`, and avoid Vite on Docker's occupied port 3000. Full quality passes 46 files/218 tests; the production build passes in 5.45 seconds. Local browser/runtime evidence is recorded in CURRENT_TASK.md. Phase 3A is authorized; deferred CI, portability, quarantine, and performance work do not block it. Historical Phase 2 counts below are dated evidence, not current results.

Required toolchain (exact, fail-fast through `package.json` `devEngines`):

```text
Node.js 24.19.0 LTS
npm 11.17.0
```

Node.js 24.19.0 ships with npm 11.17.0. Confirm both before running workspace commands:

```bash
node --version
npm --version
```

```bash
npm install
npm start
npm run typecheck
npm test
npm run test:watch
npm run lint
npm run lint:fixtures
npm run quality:ratchets
npm run format:check
npm run quality
npm run build
npm run preview
```

Dev server:

```text
http://localhost:3000/panel/
```

Vite binds the local development and preview servers to IPv4 loopback (`127.0.0.1`) because the current Windows host exposes an unreachable IPv6 `::1` listener for `localhost`. Use `http://localhost:3000/panel/` or `http://127.0.0.1:3000/panel/`; the ordinary `npm run dev` command needs no host override.

`npm start` is kept as Vite muscle memory and runs the Vite dev server.

## Verification Status

Historical frontend build/browser evidence (2026-06-28):
- `npm run build` succeeds.
- `npm start` renders the template and redirects to `/login`.
- Build warnings about large chunks are expected while the full Velzon demo inventory is still imported.
- Browserslist/baseline data warnings are maintenance noise, not current blockers.
- Tailwind content warning is not an admin blocker because this workspace is Bootstrap-oriented.
- Active frontend env usage has been converted from CRA-style `process.env.REACT_APP_*`/`PUBLIC_URL` to Vite-style `import.meta.env.VITE_*`/`BASE_URL`.
- The temporary CRA env compatibility bridge has been removed from `vite.config.ts`; `global: "globalThis"` remains for legacy template dependencies.
- The last completed browser auth regression covers login, dashboard refresh, controlled profile-menu logout, and logged-out dashboard/profile denial. Restored baseline adapters register `/profile`, `/register`, and `/forgot-password`; `/logout` remains deliberately unregistered and only the login flow is backend-connected.
- `session_api.ts` is a compatibility re-export over the single credentialed Sanctum gateway and transport.
- Firebase auth helpers, fake JWT auth backend, JWT token-access helpers, and auth-specific browser bearer-token storage have been removed.

The latest F27G/F27H verification (2026-09-11) passes 42 test files/196 tests, strict typecheck, lint/format/ratchets, a 7.30-second production build, and the user-confirmed normal/toolbox browser matrix. The unchanged lock retains the prior zero-finding production audit evidence. Initial CSS is 1,002,953 bytes/158,135 gzip; the separate 112,887-byte/20,886-gzip toolbox stylesheet is absent from initial HTML. Active fonts are 11 WOFF2 files/1,135,684 bytes, down from 34/8,375,625. Feature-specific counts below are historical checkpoints. Node 24.19.0/npm 11.17.0 and TypeScript 7.0.2 remain pinned; ambient declarations are 10 and undeclared runtime families are zero. CI remains approval-gated.

F03's exact PostCSS 8.5.26 and nanoid 3.3.18 overrides are installed and locked; the focused audit no longer contains either package and TypeScript still passes. The first production build exposed a bare `assets/*` import hidden from TypeScript by image declarations; all five first-party roots are now explicitly mapped. The corrected production build and preview startup pass. Browser login still requires a running Laravel service at the configured `http://localhost:8080` origin.

F04 installs exact Sass 1.103.1 with Immutable 5.1.9. Typecheck, production build, preview/CSRF smoke, and the focused Immutable audit pass. The retained Velzon styles still contain 117 legacy `@import` statements; this security/support slice records that migration debt without combining a broad stylesheet-module rewrite with the compiler update.

F05 installs exact current Axios 1.19.0. Typecheck/build and the live login/current-user/logout/protected-route browser regression pass, and the focused audit no longer contains Axios.

F06 installs exact Vitest 4.1.11 with jsdom 30.0.1, Vite-aligned configuration, explicit Testing Library setup/cleanup, and a neutral React/jsdom smoke test. The old CRA assertion/setup and Jest type package are removed; TypeScript and the one-test suite pass.

The same resolved development-tool batch contains exact Oxlint 1.79.0, `oxlint-tsgolint` 7.0.2001, Prettier 3.9.6, and exact pins for Vite 8.0.16/plugin-react 6.0.2. `npm run quality` passes the compiler, unit tests, governed type-aware lint, positive/negative rule fixtures, custom dependency/case/boundary/debt ratchets, and format check. The user-run post-quality production build, preview, and protected-shell smoke close F07A.

F08 centralizes backend origin, API base, router base, locale defaults, and build mode in `src/core/runtime/config.ts`. Production requires an explicit backend origin, non-local production origins require HTTPS, the API origin must match the backend origin for credentialed delivery, and paths are normalized without duplicated `/panel` or `/api` segments. Sixteen runtime/harness tests and the full lightweight quality gate pass. The user-run post-change build transforms 3,784 modules and completes in 5.17 seconds; preview and the auth/protected-shell smoke pass.

F09 adds the internal core public API and validated product/devtool manifest seam without activating routes. Checkupino modules consume only the core public entry, devtools cannot enter the normal product manifest, routes are relative to the future basename, roles remain opaque adapter inputs, and duplicate identifiers/paths fail. F10 moves active session auth onto one credentialed Axios transport with safe query serialization, cancellation, 204 handling, and preserved typed wire errors; its user-run backend/build/preview/auth regression works as before.

F11 adds one observable admin-session authority with deduplicated bootstrap, one-shot internal redirect intent, immediate logout trust clearing, code-sensitive session invalidation, and explicit non-admin denial/logout behavior. Expected bootstrap/expiry 401 responses settle as a silent guest state; inactive and submitted-login failures remain displayable. Legacy hooks, Redux thunks, and session compatibility exports delegate to that source. The lightweight gate passes five test files and 52 tests, and the user confirms the corrected browser behavior is good. F22 subsequently removed the temporary navigable `/logout` page.

F12 adds one RTK Query service backed by the typed transport, with separate adapters for all five preserved list-response families and exact query builders for admin users, admin reservations, admin doctors, checkups, and public questionnaires. Semantic cache keys dedupe equivalent emitted requests; abort signals and explicit tag invalidation are covered. Full lightweight quality passes seven test files and 63 tests, and the user confirms the production build/preview regression. The service is wired but dormant and adds no dependency.

F13 adds presentation-only capability predicates for the exact admin/root authority matrix and a recent-password coordinator that handles only 423, confirms with the existing session transport, and retries the caller's operation once. It passes through 403/419/422, treats prompt/AbortSignal cancellation as unapplied, keeps the 900-second expiry server-owned, and stores no password. Full lightweight quality passes nine test files and 74 tests, and the user verifies the current admin/root browser matrix.

F14 adds the production product-registry composer without activating it in the current router. Its Checkupino module contributes only relative login/admin-home records with one source for title, breadcrumb, loader, module owner, navigation order, and guest/admin/root visibility. Validation and tests cover duplicates, role narrowing, missing/optional devtools, inert future slots, and root/subpath hrefs. Full lightweight quality passes ten test files and 81 tests; the production build passes in 4.87 seconds with only the retained Velzon timing/chunk warnings.

F15 makes language the sole direction authority: only Farsi/RTL and English/LTR are product options, and the old independent direction Redux state/customizer radio is removed. Versioned startup preferences apply locale, direction, and System/Light/Dark before render; legacy locale/layout values migrate safely, and explicit color choices remain device-scoped across logout. Shared formatters normalize Persian/Arabic-Indic digits to ASCII, display Farsi dates with the Persian calendar, English dates with Gregorian, and timestamps in Asia/Tehran. The active Persian font is the local OFL Vazirmatn v33.003 variable WOFF2. A live shell check showed that the then-active retained RTL imports broke shell geometry, so those imports remain excluded pending diagnosis. F22 must preserve the original Velzon design, inspect the template-supported RTL/LTR asset path, and obtain approval before any visual correction.

F16 adds the reusable Checkupino feedback boundary: localized loading/empty states, structured error presentation, text-bearing status badges, and imperative toasts. Component/model tests exercise every visible F10 transport class under Farsi/RTL and English/LTR, preserve backend messages plus field/status/code/retry/correlation detail, keep cancellation quiet, and never infer that retry is safe. The shared retained Loader delegates to this boundary and no longer calls Toastify while rendering. Toastify imports in product code are ratcheted to one wrapper; its viewport remains additive until F22. Full quality passes 15 test files and 115 tests, the `any` ceiling drops to 2,527, and the production build passes in 7.42 seconds with only retained warnings.

F17 exactly pins React Hook Form 7.86.0, Zod 4.4.3, and resolvers 5.9.1. Plain Bootstrap text, textarea, select, native date, and file primitives expose library-independent props and accessible Persian/English required/help/error states; they inherit document direction, retain native tab order, and route digit normalization through F15. One adapter owns RHF/Zod and preserves transformed output typing under TypeScript 7 without a compatibility cast. API-envelope and ordinary JSON `/login` 422 responses retain dotted field names, global/unmatched errors, and support metadata. Full quality passes 18 test files and 126 tests; the production build passes in 7.36 seconds without active bundle growth. Focused OSV queries return no advisory for the exact new package family; the broader legacy lock remains separately gated.

F18 implements additive portal-based dialog/drawer primitives, a bilingual reasoned archive dialog, and an ephemeral recent-password prompt for the F13 coordinator. Tests cover focus trap/return, Escape/backdrop, logical RTL/LTR drawer placement, busy and duplicate-submit suppression, exact `{ reason }`, promise/204-style completion, retained retry state, cancel/abort, and one confirmation/one operation retry. Product overlays import neither Reactstrap nor browser storage, and reason/password remain separate. Full quality passed 21 test files and 136 tests; the production build passed in 7.01 seconds without active bundle growth; and the correctly configured focused rerun passes 3 files/10 tests on 2026-09-02. The slice remains open only for its required real-browser keyboard/RTL proof because no approved route currently mounts it. The former F22 drawer plan was reverted with the replacement shell, and a harness route must not be invented merely to close the checkbox.

F19 exactly pins TanStack React Table 9.2.3. New Checkupino tables use one native-v9 feature contract; the two retained Velzon v8-style wrappers use v9's explicit `/legacy` compatibility export until their later disposition. The product primitive is controlled and server-driven: it registers no client sort/filter/pagination row models, serializes only endpoint-allowlisted URL/backend parameters, preserves mixed route IDs, uses logical start/end pinning, and keeps optional selection current-page-only. Twelve focused fixtures cover incompatible Laravel list envelopes, deterministic debounce cancellation, keyboard controls, responsive FA/RTL and EN/LTR rendering, and numeric/string identity collisions. Full quality passes 23 test files and 148 tests; the production build passes in 8.25 seconds with only the already-owned retained warnings. F27E has since removed unused `react-table` v7 and its types.

F20 adds additive presentation-only file and audit primitives. Local file accept/size checks are visibly browser hints, not upload authority. Server file rows accept only public ID, label, MIME, byte size, availability, and created time, and only available rows can expose a caller-supplied open action. The immutable audit timeline accepts only translated action/actor labels, timestamp, outcome, reason, and public ID from an already-authorized caller; it owns no fetch. Hostile strings remain escaped and raw snapshots, route, IP, browser fingerprint, storage, scan, and retention fields are absent and ratcheted. Full quality passes 25 test files and 160 tests; the production build passes in 8.31 seconds with only the already-owned warnings.

F21 stabilizes the retained shell without changing its visual design. Search, scroll, overlay, resize, fullscreen, and preloader-timer lifecycles now clean up; DOM access is guarded; horizontal navigation is no longer mutated during render; and search visibility is React-owned. One provider supplies the shared auth snapshot to shell menu/profile consumers. Only System mode subscribes to OS color changes, while explicit Light/Dark remains authoritative. The header now selects the actual sidebar-visibility value instead of returning the whole Redux layout object. Full quality passes 27 test files and 164 tests with the `any` ratchet reduced to 2,526; the production build passes in 10.65 seconds. The user confirms the required live navigation, responsive-sidebar, search, fullscreen, and theme smoke. F21 is complete.

F22's source/decision gate is complete under technical-integration-only approval. Original Velzon login/dashboard/profile/header/sidebar/footer/search/customizer surfaces, logos, assets, classes, and placements remain frozen. Search, customizer, retained auth/profile pages, and the ecommerce dashboard translate existing visible text in place through paired English/Farsi catalogs; language alone owns direction. Shared `/me` identity reaches header/profile/dashboard, root-toolbox visibility is role-derived, controlled POST logout remains non-navigable, and registration lifecycle defects are fixed. The user selected the checked-in vanilla notification/dashboard behavior. The dormant notification component and RTL geometry repairs remain explicit composition/design gates.

F23 removes demo state/client reach from normal startup without deleting Velzon source. The base store contains RTK Query, Layout, Login, Account, ForgetPassword, and Profile only. A root-toolbox route dynamically installs retained demo reducers before its page loads. Active shell code imports layout actions directly; dashboard cards import only their ecommerce fixture module; Revenue selects the exact original local period arrays and no longer makes failed fake requests. Static reachability and runtime-state tests enforce the boundary, and an integrated test renders a real `/panel/dev/pages-starter` lazy page after reducer installation. Current lightweight quality passes 36 files/181 tests. The 2026-09-02 artifact keeps the 21.55 kB installer and fake/Themesbrand thunk as separate dynamic chunks absent from initial HTML modulepreloads. The user confirms root toolbox menu/Starter loading and ordinary-admin menu/direct-route denial; F23 is complete.

F24A tightens the approved root-admin developer ecosystem without changing the Velzon demos. Shared constants own the toolbox base/default/compatibility paths, exhaustive tests prove all 181 unique retained menu links match the route inventory, every retained route is root-only, `/me` role-derived capability owns visibility, and direct access distinguishes root, ordinary admin, and non-admin roles. Full lightweight quality passes 34 files/179 tests. Its former combined follow-up is now explicitly divided into F24B1 code isolation and deferred F24B2 asset isolation.

F24B is split into a code boundary and a deferred asset boundary. F24B1 keeps ordinary-admin navigation product-only, dynamically loads the retained toolbox menu only after `/me` confirms `root-admin`, and dynamically loads the complete route inventory/pages/reducer installer only through the guarded `/panel/dev/*` entry. Full quality passes 37 files/183 tests. The production artifact emits separate non-preloaded `ToolboxNavigationData` (21,161 bytes), `ToolboxRouter` (44,394 bytes), and `installReducers` (21,553 bytes) chunks; initial JS decreases from 412,180 to 364,819 bytes. The user confirms the post-split ordinary-admin denial and root-admin menu/Starter/Swiper browser matrix with no blank/reset shell, completing F24B1. F24B2 later isolates styles, locale payloads, fonts, and images through F27G-F27I without deleting or redesigning Velzon.

F25 exactly pins React Router 7.18.3 and activates the relative product manifest under Vite/BrowserRouter basename `/panel`. The only active outcomes are `/panel/login`, authenticated `/panel`, root-only `/panel/dev/*`, and role-aware fallback redirects; old placeholder/dashboard/profile/logout registrations are absent. Bare `/panel` redirects to `/panel/` in development/preview. The frozen legacy toolbox hook is adapted without editing it. Full quality passes 38 files/192 tests, the lock audit has no Router record, and the 7.72-second artifact contains only `/panel/assets/*`, no doubled basename, and no toolbox preload. Initial JS is 406,099 bytes, 41,280 bytes above the F24B1 baseline. The user-confirmed role/logout matrix passes; only F29 static-host fallback remains open.

F27A keeps the original editor-page composition and uses the approved GPL path: exact modular `ckeditor5` 48.5.0 and React adapter 11.2.0 replace the deprecated predefined build behind one common adapter, while `lodash-es` resolves to 4.18.1 without an override. Exact `react-quilljs` 2.0.4 plus Quill 2.0.2 closes the independent constructor crash. The distributable notice is `public/THIRD_PARTY_NOTICES.txt`. Full quality passes 40 files/194 tests, the 9.65-second build keeps the 905.76 kB/239.35 kB gzip editor chunk lazy, the audit has no editor/lodash-es record, and the user-confirmed `/panel/dev/forms-editors` check passes. Local `/me` cold latency remains explicitly deferred.

F26 exactly pins Swiper 14.2.0. Every active and retained Swiper import typechecks without compatibility edits, the actual React wrapper renders the unchanged four-card review slider in a focused DOM test, full lightweight quality now passes 36 files/181 tests, and the production build passes in 5.45 seconds. The shared Swiper React chunk decreases from 81.34 to 79.22 kB minified and from 24.71 to 24.34 kB gzip. Lock audit now reports 64 findings (63 moderate, one high, zero critical) with no Swiper key, and a ratchet enforces the exact manifest/lock version. The user confirms `/panel/dev/advance-ui-swiper` renders through the verified root toolbox; F26 is complete. Version 12.2.0 remains the fixed rollback only if a later real defect appears.

F27B/F27C are complete. Exact ECharts 6.1.0/wrapper 3.0.6 preserve Velzon chart appearance through the official v5 compatibility theme; the 1,183.68 kB/391.14 kB gzip chart chunk stays lazy and absent from initial HTML. The user confirms all charts render without blanks, displaced labels, overlaps, or console errors. Deprecated `react-scrollspy` is replaced by internal VelzonScrollspy in three retained landing pages; the user confirms `/panel/dev/landing` tracks active sections while scrolling and its navbar links reach the correct sections.

F27D-F27H are complete. F27G moves 42 retained demo plugin/page style families, two vendor bases, and exact toolbox-only overrides behind `ToolboxRouter`. F27H keeps the same HKGrotesk/Vazirmatn/icon families and weights through 11 WOFF2 sources, down from 34 emitted font files to 11 and from 8,375,625 bytes to 1,135,684; inactive reference locale catalogs emit no payload. The 7.30-second build reduces initial CSS to 1,002,953 bytes/158,135 gzip and keeps the 112,887-byte/20,886-gzip toolbox stylesheet absent from initial HTML. Quality gates and the user-confirmed combined browser matrix pass. F27I is user-deferred until 2026-09-21.

F28 is complete with the approved order. The shell adapts clickable Product Admin entries from the canonical manifest; normal admins and root admins receive the same product link. Root admins additionally retain the lazy Developer Toolbox last. A typed root-only System slot with paired English/Farsi catalog entries is inert metadata, so it creates no visible header, link, or route until a real system page is approved. Registry/menu role and order tests, typecheck, lint, ratchets, formatting, and a 10.44-second build pass. One full-suite run reached 42/43 files because of the known unrelated Quill five-second timeout; that focused test passed immediately. The user accepted the focused admin/root sidebar behavior.

The first combined browser matrix found `/panel/dev/apps-chat` still using the retired external demo API. Its direct chat thunk now clones room-scoped local fixtures and keeps message mutations local; the page no longer loads the external thunk barrel, and its built static closure contains no fake helper or Themesbrand URL. A focused state regression and artifact ratchet protect the repair, and the user confirms the live route is clean on 2026-09-10.

## Important Migration Notes

The Vite migration and first-party session auth cleanup are both complete for the active admin shell.

Still deferred:
- Run the F29 admin image and deployed-origin `/panel/*` deep-link/auth smoke while keeping Laravel/API delivery on its separate origin.
- Prove the core/domain/toolbox import graph and then trim or quarantine Velzon demo dependencies with user approval.
- Preserve passing local typecheck/build/lint/format/test and browser-authority gates; obtain separate approvals and evidence for full asset isolation, CI, deployment, and portability.
- Build the reusable primitives and later prove the minimal-module boot contract; the shared registry and typed API/auth boundary now exist additively.
- Replace placeholder forgot-password/register/profile-update flows with Laravel-backed endpoints when those screens become product requirements.
- Keep bearer-token auth for mobile/external clients only.

Frontend env declarations:

```text
VITE_BACKEND_URL=http://localhost:8080
VITE_API_BASE_URL=http://localhost:8080/api
VITE_DEFAULT_LOCALE=fa
VITE_FALLBACK_LOCALE=en
```

Keep local defaults in `.env.example`, production placeholders in `.env.production.example`, and local overrides in the ignored `.env.local`. Development falls back to the documented local backend when the URL variables are absent. Production builds require `VITE_BACKEND_URL` and reject the reserved `https://api.example.com` placeholder; `VITE_API_BASE_URL` may be omitted only when the canonical `${VITE_BACKEND_URL}/api` derivation is correct. Use one hostname consistently for the local admin and API so Sanctum's XSRF cookie is readable by the admin page. Vite's configured `/panel/` base supplies the BrowserRouter basename. `Dockerfile` builds the artifact and `nginx/default.conf` serves it under `/panel/`, redirects `/` and `/panel`, applies SPA fallback only to canonical panel paths, returns 404 for missing assets/outside paths, and caches hashed assets immutably.

Backend target for local integration:

```text
http://localhost:8080
```

API base:

```text
http://localhost:8080/api
```

Active Sanctum browser login flow:

```text
GET  /sanctum/csrf-cookie
POST /login
GET  /api/auth/me
POST /logout
```

Use Axios with credentials enabled for browser SPA requests. Do not store bearer tokens in browser storage for the first-party admin UI.

Legacy boundary:
- `frontend/src/helpers/fakebackend_helper.ts` remains only for lazily entered root-toolbox demo-data slices; static ratchets exclude it from the normal entry/auth/dashboard graph.
- Those slices are reached through the root-admin toolbox route inventory, but Phase 2 must prove no reusable/product import reaches them before deletion or stronger quarantine.
