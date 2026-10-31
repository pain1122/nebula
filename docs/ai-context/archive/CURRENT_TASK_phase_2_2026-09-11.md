# CURRENT_TASK.md

Historical archive preserved October 1. Superseded by the active root CURRENT_TASK.md and the user's Phase 3A authorization. Instructions and pending dates below are historical, not the active work queue.

Snapshot date: 2026-09-11

## Status And Approval Boundary

Phase 1A-1E and every roadmap item before Phase 2 are complete, validated, documentation-reconciled, and protected. The canonical Phase 1 verification record remains `docs/audits/phase-1-verification-gate-2026-08-16.md`:

- SQLite: 304 tests and 1,796 assertions, with three intentional MySQL-only concurrency skips;
- user-confirmed disposable MySQL: 307 tests and 1,816 assertions;
- 121 non-vendor routes, including 68 API routes;
- Composer audit: zero advisories at that gate.

Phase 2 is active in dependency order until a genuinely heavy user-run command or design/detail gate is reached. F00-F17, F19-F24A, F24B1, F25-F26, F27A-F27H, and F28 are complete. F24B2 remains deferred. F22 restored and preserved the original Velzon design/logo/assets/component hierarchy/classes and placements while retaining only the approved session/backend wiring, controlled logout, lifecycle fixes, and locale-owned direction behavior. F18 is implemented, explicitly deferred, and unmounted until a genuine approved product consumer exists; it does not block non-overlay work. Product UI is multilingual-first: existing Velzon worded surfaces must be connected to the shared flag/i18n system in place, with complete `fa` and `en` coverage, without redesigning their composition. Locale owns direction (`fa` -> RTL, `en` -> LTR), so no separate direction preference/control may compete with language. Project documentation and logs remain English. F25 now owns and verifies canonical route activation; F29 separately owns deployed static-host history fallback.

Stop for the user's decision before any work involving:

- route ownership, canonical paths, redirects, history fallback, deployment topology, or base-path behavior;
- reusable-core, Checkupino-module, devtool, workspace, or package boundaries;
- dependency additions, removals, upgrades, version floors, runtime versions, or package-manager policy;
- UI/UX, accessibility, responsive behavior, Persian/RTL behavior, typography, tokens, density, dates, or numerals;
- normal-admin, root-admin, system, or developer navigation;
- Velzon deletion, quarantine, retained-reference allowlists, asset pruning, or licensing choices;
- CI provider, blocking policy, audit exceptions, browser ownership, or bundle thresholds;
- portability proof, extraction format, publication, or support promises.

Do not start Phase 3. Features with a design, CI-policy, licensing, deletion, workspace-extraction, or other named detail gate require that additional approval before their own implementation. Codex may run the already-installed frontend quality and production-build commands while they remain fast; clean/install operations, genuinely long commands, Docker image builds, and Docker Compose commands remain user-run unless the user later directs otherwise.

## Current Checkpoint

On 2026-09-11 the user explicitly authorized deadline-driven Phase 3A product implementation while Phase 2's deferred delivery/portability gates remain parked. Broad RTL styling remains deferred as agreed, but every delivered screen must have accurate, complete English/Farsi labels.

The F27F implementation checkpoint (2026-09-05) passes full quality at 42 test files/196 tests, a 5.50-second production build, and a production npm audit with zero findings. On 2026-09-07 the user confirmed both pending browser checks: all `/panel/dev/charts-echarts` charts render without blanks, displaced labels, overlaps, or console errors; `/panel/dev/landing` follows scrolling with the active navbar item and its links reach the correct sections.

F27B/F27C and F27G/F27H are complete. F27G moves 42 retained demo plugin/page stylesheet families, two vendor bases, and their exact toolbox-only overrides behind `ToolboxRouter`; the separate stylesheet remains 112,887 bytes/20,886 gzip and absent from initial HTML. F27H retains the same HKGrotesk, Vazirmatn, and icon families/weights while active declarations ship WOFF2 only. Emitted fonts fall from 34 files/8,375,625 bytes to 11/1,135,684, with legacy source assets retained but excluded from the build. Only `en` and `fa` enter the locale graph; the seven retained reference catalogs emit no payload. Full quality passes 42 files/196 tests and the production build passes in 7.30 seconds. Initial CSS is 1,002,953 bytes/158,135 gzip. Package and lock hashes remain unchanged, so the prior zero-finding production audit still applies. On 2026-09-11 the user confirmed the full normal-panel/toolbox typography, icon, style, and console matrix after the Chat repair. F28 is also complete with user-accepted focused sidebar behavior. F27I remains gated.

The user approved F29's API-connected separate-origin deployment topology on 2026-09-11. A standalone `frontend/Dockerfile` builds the Vite admin with Node 24.19.0 and copies only `dist` into Nginx under `/panel`. The production Compose service supplies Laravel `APP_URL` as the browser API origin, and the build rejects the reserved example origin instead of producing a misleading artifact. Admin Nginx redirects `/` and `/panel` to `/panel/`, applies history fallback only to canonical panel routes, returns 404 for missing assets and outside paths, and caches hashed assets immutably. The offline demo now uses its existing local Velzon GIF instead of the remote copy. Full quality passes 44 files/203 tests; the 5.50-second local production build contains only `/panel/*` initial references and no toolbox preload. After aligning the active Vite and Laravel loopback hosts, the user confirms the panel login/load path works. F29 remains open for the user-owned rebuilt Nginx image/deployed-origin smoke and the deferred F27I external-demo-helper disposition.

The first combined browser pass exposed a retained `/panel/dev/apps-chat` regression unrelated to CSS/fonts: its legacy thunks called `api-node.themesbrand.website`, failed, stored a non-array response, and crashed message rendering. The toolbox-only page now imports its direct chat thunk, which clones room-scoped local fixtures and keeps add/delete local; the external thunk barrel and fake helper are absent from the built Chat closure. Reactstrap Alert receives its required transition timeout. The chat regression test passes, the initial repair passed complete quality at 43 files/197 tests, and post-boundary typecheck, focused Chat/Quill tests, lint/fixtures, ratchets, formatting, and an 8.77-second manifest build pass. One repeat full run hit only the known intermittent Quill five-second timeout; no timeout/config relaxation was made. The user confirmed the repaired Chat route loads without the reported 401/DNS failures, `.map()` crash, or Fade warning on 2026-09-10.

Local environment constraints: the user's separate healthy `hazelnut2.0` Docker stack uses `127.0.0.1:18080` for `hazelnut2-0-app-1` and includes `hazelnut2-0-database-1`; preserve that stack and do not assign its container names or host port to Checkupino services. The active Vite process serves `127.0.0.1:3000`, so its ignored local API URLs also use `127.0.0.1:8080`; mixing that page host with `localhost:8080` prevents Axios from reading Laravel's host-scoped XSRF cookie and produces login 419.

The user reports widespread Persian layout defects and missing or incorrect label translations in the currently loaded panel. This is explicitly recorded for Phase 3 demo-delivery item 11 because it falls after the next five dependency-ordered product workflows. Every screen touched before then must still ship complete paired English/Farsi labels immediately; item 11 owns the comprehensive residual catalog review and broad class-level RTL geometry stabilization, which remains approval-gated and must preserve Velzon composition.

## Read-Only Audit Scope And Evidence Limits

The blueprint was reconciled against the required sources:

- `AI_BOOT.md`;
- `CODEX_RULES.md`;
- the prior `CURRENT_TASK.md`;
- `docs/ai-context/modules/admin-panel.md`;
- all nine Phase 2 items in `docs/TODO.md`;
- `docs/PROJECT_MAP.md`.

The audit also inspected the actual frontend manifest, lockfile, TypeScript/Vite/bootstrap configuration, routes, menus, auth, state, layouts, i18n, helpers, components, styles, assets, tests, and representative Velzon pages. Consumed Laravel contracts were checked against web/API routes, controllers, middleware, resources, policies, services, configuration, and focused backend tests. At the original read-only audit checkpoint, this document was the only file intentionally changed. The historical observations below are retained as evidence; completed feature records and the current checkpoint supersede their former pending instructions.

Evidence limits:

- The user ran the F02/F03 `npm install`; the reconciled lock resolves TypeScript 7.0.2, PostCSS 8.5.26, and nanoid 3.3.18. The first strict TypeScript 7 run reported 180 retained-template diagnostics, which were classified and resolved through explicit aliases, stylesheet typing, and one ledgered legacy Apex adapter; the final `npm.cmd run typecheck -- --pretty false` passes.
- `frontend/node_modules` is present after the user-run installs. The latest quality/build/audit evidence passes through F27F; the user-confirmed F27B/F27C browser checks close the remaining dependency-family gates. The user has authorized Codex to run the installed workspace's fast quality/build commands and asks to be involved only when evidence warrants a manual/environment-owned check. Docker build and Compose remain out of scope and user-run.
- `.github/` is absent, so no frontend CI implementation exists.
- F01 pins Node 24.19.0 LTS with its bundled npm 11.17.0 in `packageManager`, `engines`, `devEngines`, and lock-root metadata. The local machine now reports that exact pair, and `npm ls` resolves the approved compiler graph without an engine error.
- F02 pins and locks TypeScript 7.0.2, supplies the passing `npm run typecheck`, replaces removed `baseUrl` behavior with five explicit project-relative aliases, removes the missing forgot-password reducer import, and records 2,530 `any` tokens, 13 ambient declarations, 40 retained Velzon Apex adapter consumers, and one compatibility cast in `frontend/type-debt.json`.
- F03's exact npm overrides and lock resolve PostCSS 8.5.26 and nanoid 3.3.18. A fresh lock audit contains neither vulnerability key and reports 67 findings in separately owned families (63 moderate, three high, one critical). Typecheck, the corrected production build, and preview startup pass.
- F04 installs and locks exact Sass 1.103.1 with Immutable 5.1.9. The retained stylesheet inventory has 112 SCSS files, 117 `@import` statements, no `@use`/`@forward`, and at least 34 legacy color/global-function call sites; broad stylesheet migration is not folded into this security slice. Typecheck and production build pass, preview/backend return 200/204, and a fresh audit no longer contains Immutable (66 separately owned findings remain: 63 moderate, two high, one critical).
- F05 installs and locks exact current Axios 1.19.0. Current session-client URLs are well formed, retain credentialed XHR/XSRF behavior, and do not use the malformed-protocol form intentionally rejected by Axios 1.18+. Typecheck/build pass; the user verified login, dashboard, refresh persistence, logout, and logged-out profile denial; a fresh audit contains no Axios key (65 separately owned findings remain: 63 moderate, one high, one critical).
- F06 installs exact Vitest 4.1.11/jsdom 30.0.1, keeps Testing Library in development scope, removes Jest/CRA test remnants, and passes one neutral React/jsdom smoke with explicit APIs and cleanup.
- F07 installs exact Oxlint 1.79.0, `oxlint-tsgolint` 7.0.2001, and Prettier 3.9.6; removes the phantom CRA `eslintConfig`; and passes the combined quality command in about nine seconds. Six negative lint fixtures prove Hooks, accessibility, restricted imports, render effects, unused code, and Vitest rules. Ratchets preserve 2,530 `any` tokens, 13 ambient declarations, 40 legacy Apex consumers/one cast, four exact undeclared dependency families, one unchanged lint exclusion, two unchanged startup boundary exceptions, case-correct internal imports, and no ESLint/baseUrl regression.
- F07A exactly pins Vite 8.0.16/plugin-react 6.0.2. The post-quality production build, preview startup, and authenticated/protected-shell smoke passed in the user-owned environment, closing the isolated maintenance slice.
- F08 adds one typed runtime boundary for backend origin, API base, router base, locale defaults, and build mode. Sixteen Vitest cases cover the selected separate-origin production topology, local fallback, root/subpath bases, missing/malformed values, HTTPS enforcement, and overlap-safe path/URL joining. Active source has exactly one ratcheted `import.meta.env` read and no `process.env` read; the stale fake-auth environment flag is absent. TypeScript, tests, governed lint, negative fixtures, debt/boundary ratchets, and formatting pass. The user-run production build transforms 3,784 modules and completes in 5.17 seconds; its retained Velzon Sass, Tailwind-content, browser-data, asset-timing, and large-chunk warnings are later-owned debt. The user then confirms preview, login, refresh, protected-shell access, logout, and logged-out denial all work.
- F09 defines the internal core public API, framework-facing transport/auth/localization/token interfaces, relative route/navigation/module manifest contracts, an empty Checkupino product module, and an empty optional Velzon-reference devtool module without activating legacy routes. Twelve manifest tests reject duplicate module/route/path/navigation identities, absolute or basename-repeating paths, unresolved navigation, invalid inert slots, and devtools forced into a product manifest. Static ratchets enforce core neutrality, core public-entry use by Checkupino modules, and corrected file-level directory import resolution. Full quality reports 28 tests passing at the F09 gate.
- F10 implements one credentialed Axios transport at the Checkupino adapter boundary, safe deterministic query serialization, AbortSignal forwarding, raw body/header/status preservation, 204 no-body handling, and classified 401/ordinary-403/inactive-403/404/419/422/423/429/server/network/cancel failures with field/meta/retry/correlation data. Session CSRF/login/me/logout now use this adapter; `AuthUser.public_id` and nullable envelope metadata match the consumed contract. Ratchets allow Axios/backend-origin access only in the adapter plus one unchanged F23-owned global fake-client exception. Full frontend quality reports four files and 44 tests passing. Host PHP is unavailable, so focused backend verification remained user-run; the user then confirms the requested backend/build/preview/auth regression works as before.
- F11 implements one observable admin-session authority over the F10 gateway: shared guard/header/menu/profile state, deduplicated bootstrap, controlled login/logout, safe one-shot internal redirect intent, explicit non-admin denial with server logout, immediate trust clearing on every logout attempt, and transport-driven invalidation for 401/`account_inactive` while retaining identity on ordinary 403. A bootstrap/expiry 401 is a silent guest transition rather than a login-page error, while inactive and submitted-login failures remain displayable. The legacy Redux thunks and `session_api.ts` now delegate to this authority/gateway instead of owning parallel session truth. Static ratchets prohibit browser/token persistence in the authority, additional reactive auth stores, session endpoint ownership drift, and bypasses from the legacy hook/thunk seams. Full lightweight quality passes five test files and 52 tests; after the initial expected-401 display defect was corrected, the user confirmed the browser behavior is good. F11 is complete.
- F12 adds the already-approved RTK Query service through the existing Redux store, backed only by the F10 transport. Separate runtime-checked adapters preserve admin `data.users`, modern admin arrays, envelope-contained Laravel paginators, public naked lists, and raw compatibility paginator shapes. Five actual endpoint families have exact typed filter/sort allowlists and fixed/capped pagination behavior. Cache identity is derived from the emitted canonical query, AbortSignal reaches the transport, cancellations have a non-toast predicate, and list invalidation is explicit. Tests prove fixtures, malformed-shape rejection, semantic deduplication, explicit invalidation, and cancellation. Anti-drift ratchets enforce one RTK API, its reducer/middleware wiring, and no second server-state dependency. Full quality passes seven test files and 63 tests with unchanged debt baselines; the user confirms the production build and preview regression. F12 is complete.
- F13 derives presentation-only capabilities from the exact session roles without inventing permissions. Normal admin receives common product-user, doctor-verification, questionnaire/rating-option, and reservation-reschedule visibility; admin identity/account-state, reservation-status override, payment-adjustment, platform configuration, system navigation, and developer-tool visibility remain root-only. The active protected-route outcome consumes the capability seam while the lint-excluded legacy toolbox menu remains frozen for its later owner. A UI-agnostic recent-password coordinator preserves the password-only confirmation payload, server-owned expiry, CSRF/session transport, and original operation closure; it intercepts only 423, prompts once, confirms once, retries once, and never loops. 403/419/422 pass through, prompt/AbortSignal cancellation does not confirm or retry, and no password/expiry state is persisted. Full quality passes nine test files and 74 tests; the user verified the current admin/root browser regression. F13 is complete.
- F14 extends the validated manifest into one additive production registry composer. The Checkupino manifest contributes only neutral relative `login` and admin-home records with module ownership, title keys, breadcrumbs, ordered navigation, lazy loaders, and exact guest/admin/root visibility. Validation rejects unresolved breadcrumbs, duplicated or over-broad navigation roles, and ownership/shape drift; selectors and href composition cover optional devtools, missing modules, and root/subpath bases. The active legacy route/menu composers are intentionally unchanged, so canonical route activation and the `/logout` compatibility-page removal remain owned by F25 and F22. Full quality passes ten test files and 81 tests, and the production build passes in 4.87 seconds with only the already-owned legacy asset-plugin timing and large-chunk warnings. F14 is complete.
- F15 implements the approved two-locale foundation: `fa` and `en` are the only product locales and exclusively own `rtl`/`ltr`; the competing Redux direction state and customizer control are removed. A pre-render bootstrap applies versioned locale/direction and System/Light/Dark preferences before UI paint, safely migrates legacy locale/layout values, and preserves explicit device-scoped color choices across logout. Shared formatters normalize Persian and Arabic-Indic wire digits, use Persian-calendar date display for Farsi, Gregorian display for English, and Asia/Tehran timestamps. The active Persian font is the locally pinned OFL Vazirmatn v33.003 variable WOFF2 (SHA-256 `4E3FA217D38FDAFC1FEA4414CEB58CA5E662CF0AB5FA735A8C8C20E8B42CAD92`). A live review proved that the then-active retained RTL imports created broken shell geometry, so those imports were removed pending diagnosis. That evidence does not authorize a replacement shell or custom geometric rewrite: F22 must preserve the original Velzon design, inspect its supported RTL/LTR asset path, and request approval before any visual correction.
- The user accepted F15's focused browser handoff on 2026-08-26. F15 is complete; that acceptance covers locale-owned direction and color-preference startup/persistence, not full retained-shell RTL repair.
- F16 adds one bilingual feedback boundary with typed loading, empty, structured error, visible status, and imperative toast primitives. All eleven visible transport failure classes render under both `fa`/RTL and `en`/LTR without a local direction override; cancellation is silent, unknown/backend messages remain visible, field errors and support-relevant status/code/retry/correlation data are preserved, and retry UI exists only when the caller provides an explicit safe action. Toastify ownership is confined to the wrapper, the retained shared Loader no longer performs a render-time toast, and the sole remaining render-time toast is exact-ratcheted to the root-toolbox registration demo owned by F22. The debt ceiling falls from 2,528 to 2,527 `any` tokens. Full quality passes 15 test files and 115 tests; the production build passes in 7.42 seconds with only the already-owned warnings. F16 is complete; its toast viewport remains additive until the F22 product-shell composition.
- F17 installs and exactly pins current stable React Hook Form 7.86.0, Zod 4.4.3, and `@hookform/resolvers` 5.9.1. Plain Bootstrap field props remain library-independent while one adapter owns RHF/Zod integration; Formik/Yup cannot enter Checkupino modules. Typed text, textarea, select, native date, and file seams provide complete Persian/English label/help/required/error behavior, inherit document direction, preserve native keyboard order, and normalize Persian/Arabic-Indic digits through the F15 formatter. One library-independent server adapter preserves both API-envelope and ordinary JSON `/login` 422 shapes, exact dotted field names, global errors, unmatched fields, message/code/correlation metadata, and backend authority; the RHF adapter focuses only the first known field and returns the complete result. Full quality passes 18 test files and 126 tests; the production build passes in 7.36 seconds with no active bundle growth because the primitives remain additive. Direct OSV queries report no advisories for the four exact new resolved packages. The broader legacy npm audit timed out and remains owned by the existing dependency/security gates rather than being presented as clean. F17 is complete.
- F18 implements portal-based dialog/drawer primitives with native dialog semantics, document-owned direction, logical-end drawer placement, focus trap/return, Escape, backdrop behavior, scroll restoration, and busy-state close suppression. The separate bilingual archive dialog sends only trimmed `{ reason }`, uses archive/history-preserving language, validates locally, blocks duplicate submit, stays open until a void/204-style promise resolves, and retains structured failure/reason state for retry. A separate ephemeral password prompt bridges the F13 coordinator without storage or reason coupling; cancel/AbortSignal never confirms or retries, while 423 collects one password, confirms once, and retries the exact operation once. Reactstrap and browser storage are ratcheted out of the product overlay boundary. Full quality passes 21 test files and 136 tests; the production build passes in 7.01 seconds with no active bundle growth. F18 remains open only because its blueprint also requires a user real-browser keyboard check and no approved active route currently mounts these additive primitives.
- F19 exactly pins TanStack React Table 9.2.3 and moves the two retained Velzon v8-style wrappers onto v9's explicit `/legacy` export while the Checkupino table uses only the native v9 feature API. The controlled primitive owns server pagination/single-sort/search/filter state, deterministic debounced query commits, URL/backend allowlist serialization, standard responsive overflow, keyboard-native sort/pagination/selection controls, and logical `start`/`end` pinning. It registers no client sorted, filtered, or paginated row model, so a received server page is never locally reshaped. Selection is optional, controlled, current-page-only, cleared on query changes, and creates no bulk-action contract. Type-tagged table IDs prevent numeric/string collisions while route identifiers remain uncoerced. Two incompatible F12 Laravel list envelopes render through the same `ListResult`; FA/RTL and EN/LTR narrow/wide fixtures pass. Full quality passes 23 test files and 148 tests with unchanged debt ratchets, and the production build transforms 3,895 modules and passes in 8.25 seconds with only already-owned retained warnings. No route or product screen was activated. F19 is complete.
- F20 adds presentation-only local file selection, safe server-file metadata, and immutable audit timeline primitives. The file surface matches the actual `ReservationMedicalFileResource` allowlist (`public_id`, label, MIME, byte size, availability, and created timestamp), renders no storage/original-name/checksum/scan/retention/uploader facts, and offers an open callback only for server-marked available files. Browser accept/size checks are explicitly non-authoritative hints and never claim upload acceptance. The audit surface accepts only public ID, translated action/actor labels, timestamp, outcome, and reason; it cannot fetch and renders no raw snapshots, route, IP, user-agent, subject internals, or correlation data. React escaping, malformed timestamp/size fallbacks, unavailable/error/empty behavior, FA/RTL and EN/LTR direction inheritance, and logical timeline geometry pass 12 focused fixtures. Static ratchets freeze both safe interfaces and reject networking/raw HTML/private audit fields. Full quality passes 25 test files and 160 tests with unchanged debt, and the additive production build passes in 8.31 seconds with only already-owned warnings. No API, route, upload/download flow, or product screen was added. F20 is complete.
- F21 removes the retained shell's accumulating search, scroll, sidebar-overlay, vertical/two-column resize, fullscreen, and preloader timer lifecycles. Every added listener now has colocated cleanup, DOM access is guarded, the horizontal menu no longer mutates navigation records while rendering, search visibility/filtering is React-owned, and the header selects the actual sidebar-visibility value rather than the whole layout object. One `ShellAuthProvider` reads the F11 authority and fans the snapshot to menu/profile consumers. System color mode alone owns one cleaned-up media-query subscription; OS changes re-resolve System without changing explicit Light/Dark. Static ratchets reject shell auth fan-out drift, render-time `window.onscroll`, listener-without-cleanup regressions, and System-listener drift. Full quality passes 27 test files/164 tests with debt improved to 2,526 `any` tokens; the production build transforms 3,897 modules and passes in 10.65 seconds with only already-owned warnings. Local dev/preview now binds IPv4 loopback so the normal command avoids this Windows host's unreachable IPv6 `::1` listener. The user confirmed navigation, repeated responsive/sidebar behavior, search, fullscreen, and System-versus-explicit theme behavior in the live browser. F21 is complete.
- The exact lock was queried read-only against OSV on 2026-08-23. `npm audit --package-lock-only --json` also completed read-only and returned findings; its non-zero exit is the expected audit failure signal, not a command failure.
- Static imports and backend source/tests are evidence of reachability and contract intent. They are not proof of a current Linux build, browser behavior, cross-origin behavior, emitted chunks, or deployed deep links.

## Actual Frontend Baseline

### Existing pieces worth preserving behind approved seams

- Vite 8, React 18, TypeScript strict/no-emit configuration, and a lockfile v3 exist.
- The shell uses Bootstrap 5/Reactstrap, has persisted layout choices, light/dark controls, local fonts, i18next resources, and a protected-layout RTL default.
- Active first-party browser auth uses a Sanctum session cookie: CSRF bootstrap, JSON web login, `/api/auth/me`, and JSON web logout. No active browser auth path persists bearer tokens.
- Product route/menu files and root-only toolbox route/menu files are separate in source. F24B1 keeps the toolbox route inventory behind one root-only `/panel/dev/*` lazy entry and loads the toolbox menu definition only after the shared `/me` identity confirms `root-admin`.
- There are 182 unique lazy toolbox page routes plus the `/panel/dev` redirect. The toolbox menu contains 181 unique navigable links; neither inventory is an initial-module dependency after F24B1.
- Laravel already supplies policies, role boundaries, recent-password enforcement, reason requirements, audited mutations, public identifiers, and reviewed resource projections. These remain backend authority.
- The packaged production rollback surface is still Laravel/Blade. The production image does not currently include `frontend/`.

### Historical audit observations and explicitly updated findings

Untouched observations in this section describe the original audit baseline, not current unresolved defects. Consult the completed feature records for their resolution; do not repeat the audit or reopen completed work from this inventory.

- F02 removed the unused missing `./reducer` import from `frontend/src/pages/Authentication/ForgetPassword.tsx`; the strict TypeScript 7 gate now passes.
- `dev`, `start`, `build`, `typecheck`, `preview`, test, Oxlint, formatting, fixture, and ratchet scripts now exist. F06/F07 removed the stale CRA/Jest assertion and phantom ESLint configuration. No CI workflow or approved CI policy exists yet.
- `frontend/global.d.ts` contains 10 ledgered compatibility declarations after F27D-F27F, including a stylesheet-only `swiper/css*` subpath declaration; the stale `react-apexcharts` shim was removed in favor of package types plus one explicit retained-template adapter. Broad `any` remains common; the existing table components alone contain at least 35 occurrences. Case correctness was statically sampled but has no Linux build proof.
- F25 disposed of the old SPA registrations. The active frontend outcomes are relative `login`, authenticated index, root-only `dev/*`, and a role-aware wildcard under one `/panel` Vite/`BrowserRouter` basename. Laravel still owns its separate Blade GET paths. F29 now implements static-host fallback in the separately approved admin image, with its user-run deployed smoke still pending.
- Toolbox source definitions still express their frozen legacy paths, but the active adapter translates them to router-local `/dev/*` destinations. Tests and the production artifact reject doubled `/panel/panel` paths; the user-confirmed live browser matrix closes F25.
- Laravel registers no `/panel/*` fallback. Production Docker builds only the root Laravel Vite inputs and copies root `public/build`; Nginx falls unknown paths through to Laravel. A `/panel/*` deep link therefore fails today.
- `.env.production.example` models a separate-origin topology: API at `api.example.com`, admin at `admin.example.com`, shared cookie domain, stateful admin host, and credentialed CORS origin. A same-origin Laravel `/panel/*` deployment is an architecture change, not an existing convention.
- F23 removes normal-startup reach to demo infrastructure. The base store now contains only Layout, retained auth-page reducers, and RTK Query; root-toolbox routes dynamically install retained demo reducers before loading their pages. The active dashboard imports its existing ecommerce fixtures directly, and Revenue switches the exact local period arrays without fake Axios. The 2026-09-02 production artifact keeps the devtool installer and the fake/Themesbrand client thunk in separate dynamic chunks that are absent from `index.html` modulepreloads; the main entry contains only Vite's dynamic-dependency filename map, not eager imports of those chunks. The user confirms live root-toolbox loading and ordinary-admin exclusion.
- The current product `/dashboard` is Velzon `DashboardEcommerce`. It still displays approved unchanged fake business data, but Revenue no longer issues the external fake request. Its source graph reaches `ReviewSlider`, so Swiper remains product-reachable; F26 upgrades it to exact 14.2.0, removes the critical audit record, and verifies its retained demo page in the browser.
- F23 and F24B1 remove the known normal-startup JavaScript reach to demo reducers, fake-client barrels, the 1,106-line toolbox menu hook, the toolbox route inventory, and retained demo pages. The global English/Farsi catalogs, global styles, fonts, images, and some shared product/demo dependencies remain in the startup/build graphs; lazy JavaScript alone does not close those F24B2 concerns.
- Product and toolbox identities still reuse the same demo dashboard page. F24B1 changes loading boundaries only; it does not functionalize or redesign either surface.
- Global `themes.scss` imports broad template/plugin/page/RTL styles. The audited style graph contains 31 plugin families, 22 page/demo groups, four complete RTL groups, 19 `@font-face` declarations, and 92 font files. No emitted CSS/font isolation is proven.
- `frontend/src` contains 1,712 files: 433 page files and 1,114 asset files. This is inventory, not a claim that every file ships.
- `api_helper.ts` is untyped, changes global Axios state, manually constructs query strings, and collapses errors to strings. `session_api.ts` and `types/api.ts` are only partly typed: `AuthUser` omits `public_id`, while envelope/error types omit real nullable and variant fields.
- Login Redux state is not the shared auth authority. Guards, menu, header, and profile call independent `useProfile()` instances backed by an indefinitely resolved promise cache. Failed logout or inactive-account logout can leave a trusted cached user.
- There is no centralized policy for 401, ordinary 403, `account_inactive` 403, 419, 422, 423, 429, cancellation, network failure, or redirect intent.
- Doctor and patient accounts can complete web login but are then rejected by the admin guard. Redirecting them back to login without clearing or explaining the valid non-admin session creates a loop risk.
- Public login retains the original multilingual Velzon composition and connected backend submission. Register, forgot-password, profile-edit, dashboard aliases, and public GET `/logout` are not registered; frozen links to unavailable surfaces reach the role-aware fallback. Logout remains a controlled JSON POST authority action.
- Protected layout defaults to RTL, but `index.html` starts with `lang="en"`, public auth does not establish the same direction contract, product/menu copy remains English, locale and direction can drift independently, and persisted values are not versioned.
- Runtime defects include repeated uncleaned listeners in search, layout, sidebar-overlay, and vertical-layout code, plus render-time toast behavior in `Loader`. DOM access is not consistently guarded for tests or non-browser evaluation.
- Existing `TableContainer*`, `Pagination`, `DeleteModal`, `Loader`, and breadcrumb components are template demos: client filtering/sorting/pagination, endpoint flags, broad `any`, physical-delete wording, manual metadata, and render side effects. They are not Phase 2 reusable primitives.
- The manifest declares 83 runtime dependencies and two development dependencies. The lock contains 470 package records: the root plus 469 non-root records.
- F27F closes the four undeclared runtime families with exact direct dependencies: `classnames` 2.5.1, `lodash` 4.18.1, `prop-types` 15.8.1, and wrapper-compatible toolbox-only `nouislider` 14.7.0. Commented template imports remain inactive.
- F27E removes unused `react-table` v7 and its types. Checkupino uses native TanStack v9; the two retained Velzon wrappers remain on v9's explicit `/legacy` export.
- Six files directly read frontend environment values. `frontend/public/index.html`, `public/manifest.json`, `reportWebVitals`, and the fake-auth env key are stale CRA/Velzon artifacts.

### Historical documentation findings (superseded by completed slices)

- `docs/ai-context/modules/admin-panel.md`, `docs/PROJECT_MAP.md`, and `frontend/README.md` claim the fake helper is confined to the toolbox. The original audit disproved that claim; F23/F24B1 subsequently verified the normal-startup JavaScript boundary, while F24B2 remains open for styles/assets.
- Statements that Persian/RTL is already in place describe only part of the protected shell and overstate public-auth and component-level acceptance.
- The recorded 2026-06-28 build/browser result is historical. It cannot establish current type, bundle, route, or browser health.
- "One normalized envelope" is a Phase 2 client target, not a universal current backend response shape.

## Consumed Backend Contracts That Phase 2 Must Preserve

### Browser session flow

| Step | Preserved request | Actual success contract | Important variation |
| --- | --- | --- | --- |
| 1 | credentialed `GET /sanctum/csrf-cookie` | initializes XSRF/session state | 419 recovery must repeat this step safely |
| 2 | JSON `POST /login` with `email`, `password`, optional `remember` | web response `{success,message}`; session regenerates | inactive and bad credentials are intentionally indistinguishable; web validation is Laravel's web 422 shape |
| 3 | `GET /api/auth/me` | v1 envelope with only `id`, `public_id`, `name`, `email`, `roles`, `doctor_profile` | route uses `auth:sanctum,account.active`; it does not require `verified` and exposes no verification or permissions flag |
| 4 | JSON `POST /logout` | web response `{success,message}`; session invalidates and CSRF rotates | an account made inactive can receive a thin 403 after middleware has already invalidated the session |
| 5 | `POST /api/auth/confirm-password` | session-only timestamps on success | missing session is 409; bad password is 422; high-authority freshness is 900 seconds; protected mutations can return thin 423 |

Do not substitute `/api/auth/login`, `/api/auth/logout`, or `/api/auth/refresh`: those are bearer-token endpoints. A browser call to token logout can leave its web session alive. Never store first-party access/refresh tokens in browser persistence.

Web login is active-only, rate-limited by normalized email plus IP, and deliberately does not reveal inactive status. CORS covers `api/*`, CSRF, login, and logout with credentials. Allowed origins, stateful hosts, session cookie domain/path/secure/httpOnly/SameSite, and the default 120-minute session lifetime remain environment/server contracts.

### Response and error variation matrix

| Case | Actual wire shape/behavior | Required client meaning |
| --- | --- | --- |
| standard API success | `{success,message,data,meta}` plus API/correlation headers | preserve nullable message and metadata |
| standard API error | normalized `{success,message,code,errors,meta}` for covered exceptions | retain code, fields, message, correlation metadata |
| unauthenticated 401 | default Laravel `{message}` | clear trusted auth and route to the approved guest/access outcome |
| ordinary authorization/Spatie/controller 403 | normalized or default `{message}` depending source | do not clear a valid session merely because an action is forbidden |
| inactive-account 403 | thin `{success,message,code: account_inactive}` | clear trusted auth; server may already have invalidated session |
| route/model 404 | default framework JSON | render not-found/domain outcome without inventing a v1 code |
| CSRF 419 | default/non-normalized framework response | re-bootstrap CSRF and retry only when operation safety permits |
| API validation 422 | normalized keyed errors | map fields and retain global/domain errors |
| web-login validation 422 | Laravel web validation shape | adapt at the login endpoint, not through a false global v1 type |
| recent-password 423 | thin `{success,message,errors.password_confirmation}` with no stable code/meta | open step-up, then retry the explicit mutation at most once |
| throttled 429 | normalized API form where handler applies | preserve retry/backoff meaning |
| archive 204 | no response body | never parse JSON; invalidate/refetch only after success |
| cancellation/network | no server envelope | distinguish abort from offline/timeout/transport failure |

`X-API-Version` and `X-Correlation-ID` are attached to API responses, and standard bodies repeat them in `meta`. Current CORS exposes no custom response headers, so browser JavaScript on the modeled separate origin cannot read those headers. Correlation capture must be best-effort unless same-origin deployment or a separately approved backend CORS change makes them readable.

Auth invalidation is code-sensitive: clear trust on 401, explicit `account_inactive`, and every logout attempt/failure; do not clear auth for an ordinary 403. Treat 419 as CSRF recovery, 422 as field/domain validation, 423 as recent-password orchestration, and 429 as backoff.

### Endpoint-family list and identifier matrix

| Endpoint family | Preserved response/list behavior |
| --- | --- |
| admin users | `data.users[]` plus `meta.pagination` |
| modern admin reservations/questionnaires/submissions/rating options | `data[]` plus `meta.pagination` |
| admin doctors/checkups and several patient/doctor booking lists | full Laravel paginator inside `data`; fixed/default page size; no `meta.pagination` |
| public questionnaires | non-v1 naked bodies, including `{data,meta:{current_page,...}}` |
| compatibility responses | some admin doctor operations and reservation reschedule return raw paginator/model data |

Only the modernized admin list subset accepts capped `per_page` (maximum 100), allowlisted filters, and `sort_by`/`sort_dir` with `sort`/`direction` aliases. Endpoint adapters may normalize these wire shapes into a core list result, but the transport must not globally reshape responses or emit filters an endpoint does not support.

Numeric IDs and public IDs coexist. Route builders must model binding endpoint by endpoint; a public-ID preference must not rewrite existing v1 URLs.

### Authority, privacy, mutation, and resource boundaries

- Backend Spatie roles are authoritative: `root-admin`, `admin`, `doctor`, and `patient`. `/api/auth/me` provides roles, not permissions or capabilities.
- API admin routes require active Sanctum auth plus admin/root role but, unlike Blade `/admin/*`, currently do not require verified email. The frontend cannot infer verification from `/me`; adding API verification is a separate backend compatibility decision.
- Normal admin user lists exclude admin/root identities. Root can see/manage admins but never root identities. `AdminUserResource` contains reviewed, authorized PII; "safe" means an approved resource subset, not global absence of PII.
- Account-state mutation is root-only, cannot target self/root, requires a reason and recent password, revokes tokens and database sessions, and audits transactionally.
- Reservation status override and payment adjustment are root-only. Reschedule is admin/root subject to lifecycle rules. Doctor verification and questionnaire/rating-option actions are admin/root but retain route step-up, reason, audit, and policy checks.
- Exact no-body archive endpoints are questionnaire, questionnaire submission, and reservation rating option. They require a reason, soft-delete in an audited transaction, and return 204.
- Questionnaire-submission resources exclude contact, answer, and result bodies. Medical-file resources expose reviewed metadata/availability, not disk/path/scanner internals.
- No audit-history API exists. The reusable audit primitive must be presentation-only until an authorized caller supplies safe events. File primitives must not invent upload/download capabilities.
- Backend policy, ownership, tenant, lifecycle, payment, medical, booking, audit, transaction, recent-password, reason, and safe-resource rules cannot be weakened by route visibility, generic hooks, retries, optimistic state, or UI abstractions.

Focused backend evidence for future slices includes `SanctumSessionSecurityTest`, `AuthenticationTest`, `AccountStateAccessTest`, `ApiV1ContractTest`, `AuthTokenTest`, `ListingFilterSortTest`, `AdminUserStepUpTest`, `AdminAuthorityBoundaryTest`, `AdminAccountStateTest`, and `HighAuthorityRouteContractTest`. Existing tests do not directly prove the full JSON login -> `/api/auth/me` -> logout browser contract. Cross-origin header readability, session rotation, inactive-session logout, 419 recovery, and packaged `/panel/*` fallback remain browser/integration-unverified.

## Comparison Against All Nine Phase 2 Items

| # | Roadmap item | Classification on 2026-08-23 | What actually exists | Partial, missing, stale, or unverified | Evidence required to close |
| --- | --- | --- | --- | --- | --- |
| 1 | Type/build clean; scripts; lint/format/CI | **Partial and unverified** | strict TS/noEmit, Vite build and prepared TypeScript 7 typecheck scripts, explicit alias config, debt ledger, lockfile | TypeScript 7 lock/install/typecheck still pending; stale CRA test; phantom ESLint config; no lint/format/runnable-test/boundary/audit/CI commands; ambient/`any` debt; undeclared imports; no current Linux/build evidence | user install, clean type/lint/test/build, dependency/case/boundary checks, approved CI run |
| 2 | Canonical `/panel/*`; isolate `/panel/dev/*`; path/base behavior | **Partial, stale, and unverified** | lazy `/panel/dev/*` route set; BrowserRouter basename input | product/auth routes still collide with Laravel; all eight legacy aliases need disposition; no chosen topology/base/fallback/package; current separate-origin env conflicts with assumed same-origin plan | approved route/deployment table; direct/refresh/auth/404 tests at dev and packaged origin; no Blade shadowing |
| 3 | Reusable core vs Checkupino modules | **Missing despite reusable-looking inventory** | shell/layout/i18n/auth concepts can be candidates | no `core`/`modules`/manifest/adapter contract; fake state/helper, listeners, styles, locales, fonts, images, and toolbox menu enter startup | enforced import graph; neutral manifest boot; no reverse imports or business routes in core |
| 4 | Typed API/auth client, normalized errors/envelopes, session adapter, cancellation/query | **Partial** | implemented Sanctum calls, two Axios instances, small types, promise dedupe | conflicting HTTP systems; incomplete real error/list shapes; no central auth authority, code-sensitive invalidation, cancellation policy, mutation/query cache, endpoint adapters, or access-denied outcome | representative wire fixtures, focused backend regressions, browser auth/error matrix, cancellation/dedupe tests |
| 5 | Shared route/menu/permission registry | **Partial** | separate product/toolbox registries; role discovery; F24A parity/authority tests; F24B1 root-only lazy composers | no single title/breadcrumb/loader/module/capability source; UX visibility can be mistaken for authorization | duplicate/coverage tests for guest/admin/root; one canonical registry; backend remains authority |
| 6 | Reusable admin primitives with Persian/RTL | **Partial; reusable feedback/forms/overlays/table complete, shell proof pending** | typed F16-F19 Checkupino primitives plus quarantined Bootstrap/Velzon references | file/audit primitives remain; F18 browser proof and full shell RTL behavior wait for F22; retained toolbox debt is not product evidence | focused component/integration fixtures in FA/RTL and EN/LTR, responsive and keyboard checks, real error/list shapes, then F22 browser proof |
| 7 | First-class root-admin navigation/system extension slots | **Role/toolbox detection exists; product/system IA missing** | root role can reveal toolbox | root merely gains developer references; no root system area, extension-slot type, or future-safe non-clickable metadata | approved IA and registry role matrix; no fabricated Phase 3 routes |
| 8 | Remove/quarantine Velzon and isolate bundle | **Partial; JavaScript control plane isolated, visual/assets deferred** | F23 base store and devtool reducer injection; F24B1 lazy menu/route inventories; direct active-dashboard fixtures; artifact proof; F26 fixed Swiper | global styles/locales/fonts/images and packages remain shared; no approved allowlist/license decision or full emitted-asset isolation proof | deferred F24B2 through F27G-F27I, with per-family graph/build/browser/bundle evidence |
| 9 | Document/prove portability and minimal manifest | **Missing and unverified** | exact frontend runtime contract, Vite env example, prepared explicit TypeScript path mappings, conceptual session adapter | no declared-import closure, typed env, module manifest, boundary rules, extraction format, clean fixture, support policy, or packaged product | clean minimal-manifest install/typecheck/test/build, adoption exercise, accurate versioned documentation |

Phase 2 completion is recorded feature-by-feature below. Historical build/browser notes and static source inspection remain supporting evidence only unless the corresponding feature status names the current gate.

## Dependency Maintenance, Security, Support, And Bundle Assessment

This section records choices and risks; it does not authorize a manifest or lockfile change.

### Exact 2026-08-23 security view

- OSV queried all 469 non-root exact lock entries. Eleven entries were affected, producing 26 package-to-GHSA associations and 25 distinct GHSA IDs. Those are advisory records, not 25 independent vulnerabilities; the lodash records include alias-linked/overlapping reports.
- `npm audit --package-lock-only --json` reported 69 package/meta-vulnerability records keyed by package name: 63 moderate, five high, and one critical. That total is largely dependency-graph propagation through CKEditor and must not be described as 69 exact lock paths or separate advisories.
- The pre-F26 2026-09-02 refresh reported 65 package/meta-vulnerability records: 63 moderate, one high, and one critical. After exact Swiper 14.2.0, the lock-only audit reported 64 records. After exact React Router 7.18.3, the F25 audit reported 62 records: 61 moderate, one high, and zero critical, with no Swiper/Router vulnerability key. F27A/F27B subsequently resolved the remaining observed records; the 2026-09-05 production audit reports zero findings.

| Exact lock entry | Fixed floor covering observed records | Reach/support interpretation |
| --- | --- | --- |
| `axios@1.17.0` | fixed floor `1.18.0`; select a reviewed 1.x release | normal startup/session transport; targeted fixed-line update is urgent and lower risk than a transport rewrite |
| `react-router@7.18.3`, `react-router-dom@7.18.3` | exact approved 7.18.3 maintenance line | F25 normal startup; Node >=20 and React/ReactDOM >=18 support the pinned toolchain, all observed Router records are absent, and an exact-version ratchet prevents floating into Router 8 |
| `swiper@11.2.10` | fixed floor `12.1.2`; current candidates are exact `12.2.0` or `14.2.0` | critical advisory; current product dashboard and toolbox reach it; remove/upgrade before any production gate |
| `react-quilljs@2.0.4`, `quill@2.0.2` | exact audited compatibility pair | root-toolbox FormEditor only; wrapper v2 restores Quill's ESM constructor under Vite without adopting Quill 2.0.3's low-severity XSS record |
| `echarts@5.5.1` | `>=6.1.0` | toolbox reach; decide retained page vs major upgrade/removal |
| `@ckeditor/ckeditor5-html-support@43.3.1`, `ckeditor5@43.3.1` | `>=47.6.0` | toolbox editor only; emitted vulnerable-function reach unverified; deprecated predefined build cannot reach the fixed line without migration |
| `lodash-es@4.17.21` | comprehensive floor `4.18.0`; current 4.18 line exists | CKEditor 43.3.1 pins 4.17.21 exactly, so independent lock refresh/override is not the default fix; CKEditor removal/migration must precede or be atomic with lodash remediation |
| `postcss@8.5.15` | `>=8.5.23` | Vite build chain; treat as build-input risk, not browser-only risk |
| `nanoid@3.3.12` | `>=3.3.18` | Vite/PostCSS build chain |
| `immutable@4.3.8` | `>=4.3.9` | Sass build chain; two high records |

The critical Swiper issue is not deferrable as "toolbox-only" while `/dashboard` imports it. CKEditor General HTML Support configuration was not found, but configuration absence is not a fixed-version or emitted-bundle proof.

### Maintenance and compatibility tradeoffs

- The lock has Vite 8.0.16 and plugin-react 6.0.2; registry releases on the snapshot date are Vite 8.2.2 and plugin-react 6.1.0. Vite 8 requires Node `^20.19.0 || >=22.12.0`. The current semver ranges already permit fixed PostCSS/nanoid resolutions, so a lock-only security update is smaller than coupling those fixes to Vite/plugin maintenance.
- Node 20 is end-of-life. F01 pins the current Node 24.19.0 LTS and bundled npm 11.17.0 pair exactly for `frontend/`; no floating `latest` contract is allowed. The production Dockerfile's Node 20 stage still builds only root Laravel assets and is intentionally outside F01 until a selected frontend delivery path needs container convergence.
- Axios 1.19.0 is available on the existing major. Retaining one upgraded Axios adapter preserves Sanctum/XSRF behavior with less simultaneous risk than changing transport and auth semantics together. Native `fetch` remains a replaceable-adapter option.
- React Router 7.18.3 is the current v7 maintenance patch and contains the observed fixes. F25 couples it to canonical basename, manifest, authority, removed-route, build, and browser gates rather than treating it as a blind lock refresh.
- Swiper 12.2.0 is the compatibility-first fixed candidate. Swiper 14.2.0 is the current latest and advertises the same public API with smaller runtime output and stricter generated types, but its ground-up TypeScript rewrite raises the browser floor to Chrome/Edge 110+, Safari/iOS 16.4+, and Firefox 110+. The pinned Node 24 toolchain satisfies its build floor; browser support still requires explicit approval.
- TanStack Table v9 is stable; F19 pins the reviewed current 9.2.3 release. D08 accepts its breaking migration now, including logical start/end pinning for RTL, because the product surface is still blank enough to avoid a later table rewrite.
- Redux Toolkit is already installed, so the D07 RTK Query choice avoids another server-state package and its official comparison estimates roughly 11 KB min+gzip including React hooks when RTK is already present.
- Keeping React 18 avoids combining route, template, type, and React-major migrations. React 19 can be evaluated later through the wrapper seam.
- D08 selects React Hook Form plus Zod and prohibits an indefinite Formik/Yup dual stack. Typed field and server-error adapters remain required.
- D10 selects TypeScript 7.0.2, a separate authoritative `tsc --noEmit` gate, Oxlint 1.79.0 plus `oxlint-tsgolint` 7.0.2001 in type-aware mode, an exact reviewed Prettier release, Vitest 4.1.11, and jsdom 30.0.1. Biome is not the TypeScript 7 lint gate, Oxfmt remains deferred while pre-1.0, and the phantom CRA ESLint stanza must be removed rather than repaired.
- Oxlint currently covers 59 of 61 comparable type-aware `typescript-eslint` rules. React, Hooks, JSX accessibility, import, and Vitest rule families are built in but must be enabled explicitly; rule fixtures and the separate compiler gate cover parity gaps. Type-aware memory/Windows behavior must pass a focused repository spike before CI enforcement.
- TypeScript 7 removes `baseUrl`. F02 preparation replaced the former `baseUrl: "./src"` lookup with explicit `Components/*`, `Layouts/*`, and `common/*` project-relative mappings; the user-run TypeScript 7 resolution/typecheck must still prove them before the gate passes.
- `@ckeditor/ckeditor5-build-classic` is deprecated. Modern CKEditor migration is also a GPL/commercial licensing decision because current releases require a license key. Removal is preferable if no retained reference/product need is approved.
- `react-scrollspy` is registry-deprecated and no longer actively maintained. Moment is in maintenance mode. Reactstrap 9.2.3 remains latest but has not published since 2024; retain it only behind small wrapper seams if Bootstrap/Reactstrap is approved.
- Do not add packages merely to preserve abandoned template pages. Prune/quarantine first, then upgrade one retained dependency family per slice.

### Determinism and bundle implications

- F27F resolves the former transitive-only runtime imports with exact direct declarations; the undeclared-family ratchet is zero.
- F27E removes the duplicate unused `react-table` v7 runtime/types; native TanStack v9 and its bounded retained-wrapper `/legacy` bridge remain.
- Route lazy loading alone is insufficient. Redux, menus, locale JSON, global SCSS, fonts, assets, shared component barrels, and transitive packages must be measured separately.
- No absolute byte budget is proposed from the historical 2026-06-28 build. The first approved clean build must record entry/route JS, CSS, fonts/assets, locale chunks, source maps, and external network origins. Only then can the user approve absolute and regression thresholds.
- Dependency/lock changes must be atomic by concern and reversible together. `npm audit` is lock-wide and cannot prove emitted reachability; production-reach gates require a build graph. Security exceptions, if approved, need an owner, reachability evidence, expiry date, and removal/fix feature.

Primary external evidence for the approval review:

- [OSV API](https://google.github.io/osv.dev/api/), [npm registry metadata](https://registry.npmjs.org/), and the [Swiper critical advisory](https://github.com/advisories/GHSA-hmx5-qpq5-p643);
- upstream React Router advisories [GHSA-337j-9hxr-rhxg](https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg), [GHSA-wrjc-x8rr-h8h6](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6), and [GHSA-jjmj-jmhj-qwj2](https://github.com/remix-run/react-router/security/advisories/GHSA-jjmj-jmhj-qwj2);
- official [Vite 8 support](https://vite.dev/blog/announcing-vite8), [Node release status](https://nodejs.org/en/about/previous-releases), [CKEditor predefined-build migration](https://ckeditor.com/docs/ckeditor5/latest/updating/nim-migration/predefined-builds.html), and [CKEditor v44 licensing change](https://ckeditor.com/docs/ckeditor5/latest/updating/guides/update-to-44.html);
- official [Moment project status](https://momentjs.com/docs/#/-project-status/) and [RTK Query comparison](https://redux-toolkit.js.org/rtk-query/comparison).
- official [TypeScript 7 release notes](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [Oxlint type-aware documentation](https://oxc.rs/docs/guide/usage/linter/type-aware.html), [Oxlint built-in plugins](https://oxc.rs/docs/guide/usage/linter/plugins), [Vitest environment guidance](https://vitest.dev/guide/environment), and [Biome language support](https://biomejs.dev/internals/language-support/).

## Approved Human Decision Record

The user accepted these directions on 2026-08-23. `ACCEPTED - STAGED` means the architecture direction is fixed while the named feature still needs its small execution-detail approval. No row grants blanket implementation authority.

| ID | Accepted decision | Guardrails and deferred detail | Status |
| --- | --- | --- | --- |
| D01 | Use option B: a separate admin origin serves canonical `/panel/*`; the Laravel/API origin remains separate. | Preserve credentialed CORS, Sanctum stateful hosts, shared cookie scope, and the current `.env.production.example` topology. Do not add Laravel/Nginx `/panel` ownership or claim same-origin header visibility. | ACCEPTED |
| D02 | Retain the original Velzon panel design as the visual and structural baseline. Connect it to Vite and the backend without changing its logo, assets, component composition, classes, control placement, page layout, or visual design. Logout is a controlled JSON `POST /logout` action, never a navigable page load. | The restored `/login`, `/forgot-password`, `/register`, `/`, `/index`, `/dashboard`, and `/profile` registrations are baseline-preservation adapters, not final route-architecture approval. Do not restore a React `/logout` route. Any route removal, placeholder disposition, composition change, or replacement surface requires a separate explicit approval. | ACCEPTED - REPLACED 2026-08-28 |
| D03 | Registry paths are relative to one validated `/panel` router basename. | No feature may independently embed absolute `/panel/*` paths or produce `/panel/panel`. | ACCEPTED |
| D04 | Begin with enforced internal `src/core`, `src/modules/checkupino`, and `src/devtools` boundaries plus one manifest. | Create a workspace/package only when the portability evidence demonstrates a concrete benefit. Keep interfaces extraction-ready; no publication commitment. | ACCEPTED - STAGED |
| D05 | Use Node 24.19.0 LTS with its bundled npm 11.17.0 for `frontend/`. | F01 pins the pair exactly in manifest/lock metadata and fails unsupported npm source commands. Later CI/delivery must consume the same contract; container convergence remains deferred unless the selected delivery path needs it. | ACCEPTED - F01 VERIFIED |
| D06 | Retain one fixed, observed-safe Axios 1.x adapter and migrate the canonical router to one reviewed `react-router-dom` 7.18.x release. | Avoid a fetch rewrite and do not float into Router 8. Each family keeps its own tests and rollback. | ACCEPTED |
| D07 | Use a slim Redux Toolkit store plus RTK Query behind reusable interfaces. | Remove demo reducers and do not add a second server-state system. | ACCEPTED |
| D08 | Migrate now to React Hook Form plus Zod and TanStack Table v9. | The project is blank enough to absorb migration now. Do not retain indefinite Formik/Yup or table-v8/v9 dual stacks; endpoint wire adapters stay library-independent. | ACCEPTED |
| D09 | Keep React 18 and Bootstrap for the Velzon-based admin; isolate Reactstrap behind primitives. | This decision does not constrain the future public/client application to the admin UI stack. | ACCEPTED |
| D10 | Use TypeScript 7.0.2, authoritative `tsc --noEmit`, Oxlint 1.79.0 plus `oxlint-tsgolint` 7.0.2001 in type-aware mode, a reviewed exact Prettier release, Vitest 4.1.11, and jsdom 30.0.1. Remove the phantom CRA ESLint config; do not add ESLint or `typescript-eslint`. | Migrate removed `baseUrl` behavior to explicit project-relative `paths`; enable React/Hooks/JSX-a11y/import/Vitest rule families; retain negative rule fixtures and a dependency-graph check; prove Windows/repository memory behavior before CI. Biome and pre-1.0 Oxfmt are not selected. | ACCEPTED |
| D11 | Make the retained Velzon UI multilingual through its flag-based language-selection behavior: existing and newly touched worded screen/shell elements use shared translation keys with complete Persian and English copy. Locale is the sole direction owner: selecting `fa` applies `dir="rtl"` and selecting `en` applies `dir="ltr"`; there is no standalone RTL/LTR product setting. The initial color-mode preference is `system`; an explicit light/dark choice persists across reload and logout, and a System option removes that override. | Persian-label support and direction ownership remain mandatory throughout implementation, but visual RTL geometry/class remediation is reserved for the final demo stabilization pass after functional workflows exist. Do not bulk-rewrite retained Velzon directional utilities during feature work. Prefer logical Bootstrap/custom utilities in new code and record physical margin/padding/float/position defects for the final inventory. Whether that pass uses Bootstrap's RTL build, a bounded override layer, or both remains a later approval decision. Project documentation, code comments, and task logs are English. | ACCEPTED - AMENDED 2026-09-02 |
| D12 | Navigation visibility is role-based using the exact roles returned by `/api/auth/me`. Admin sees product navigation; root-admin sees product plus separately grouped system navigation; retained developer references are optional/root-only; future slots are inert metadata. | Visibility is UX only and never replaces backend authorization. Do not invent permissions or clickable future routes. | ACCEPTED |
| D13 | Keep the complete Velzon source/assets available while the panel is connected and customized; the original Velzon panel remains the active visual baseline. | Do not delete, replace, quarantine out of the active panel, or restyle a Velzon component merely because it is demo/template material. Later isolation or deletion requires reachability evidence, a completed replacement, explicit approval, and rollback evidence. | ACCEPTED - RETAIN UNTIL FINISHED |
| D14 | Start with option A, lock-wide audit evidence; add production-reach/bundle evidence when the first reliable isolated build exists; operate as option C before Phase 2 closes. | F32A must separately approve provider, blocking severities, exception owner/expiry, browser owner, and initial regression/bundle thresholds. No CI workflow is inferred from this staged direction. | ACCEPTED - POLICY DETAIL GATE |
| D15 | Prove internal minimal-manifest portability first. After the admin platform is stable, begin an external consumer transition using the smallest useful extraction mechanism. | A workspace is conditional on demonstrated value; public npm publication and support promises are out of scope. F31A owns the external-consumer proof and its separate execution approval. | ACCEPTED - STAGED |
| D16 | Use option B as two independent steps: lock-only PostCSS/nanoid remediation first, then a separately reviewed Vite/plugin-react maintenance feature. | Do not hide maintenance churn inside the security batch; each has its own versions, changelog review, user-run build evidence, and rollback. | ACCEPTED |

F00-F15A are complete. The D14 CI-policy details, D13 physical deletion, and D04/D15 extraction mechanism remain intentionally delegated to their named later gates rather than guessed here.

## Dependency-Ordered Phase 2 Feature Queue

F00-F02 are checked. The user's instruction to continue in dependency order authorizes subsequent non-design slices until a long-running user command or named design/detail gate is reached. `Depends` still requires prerequisite acceptance/evidence, and no feature may advance past its own deferred gate.

### Gate

- [x] **F00 - Approve and freeze the decision record.**
  - Depends: none.
  - Scope: retain the accepted 2026-08-23 D01-D16 record and add the first explicitly authorized slice or bootstrap batch.
  - Preserve: Phase 1 evidence, current backend/Blade production behavior, and every contract above.
  - Acceptance: no D01-D16 row is pending; staged detail gates remain explicit; the user names the first authorized slice; decision approval is not interpreted as blanket implementation authority.
  - Verification: D01-D16 user responses and the explicit TypeScript 7/Oxlint follow-up are recorded; the user's "lets start" authorizes only the dependency-ordered F01 start.
  - Non-goals: code, manifest, lockfile, infrastructure, or durable architecture-doc changes.
  - Rollback: revert only the decision-record edit and return the affected feature to blocked.

### Foundation and quality commands (Phase 2 item 1)

- [x] **F01 - Declare the supported runtime and package-manager contract.**
  - Depends: F00; D05.
  - Scope: pin Node 24.19.0 LTS with bundled npm 11.17.0 in `packageManager`, `engines`, npm `devEngines`, and lock-root metadata; reconcile frontend commands/docs and make the metadata authoritative for later CI/delivery consumers.
  - Preserve: lockfile v3 and Laravel asset build ownership until packaging is separately approved.
  - Acceptance: unsupported npm install/ci/run execution fails rather than merely warning; the exact pair is recorded once for later CI/delivery consumption; the unrelated root Laravel-assets Docker stage is not presented as frontend runtime support.
  - Verification: official Node evidence identifies 24.19.0 as LTS and its release bundles npm 11.17.0; JSON/lock metadata checks pass; the earlier Node 24.18.1/npm 11.16.0 pair was rejected with expected `EBADDEVENGINES`; the updated local runtime reports Node 24.19.0/npm 11.17.0 and the user-run install completed. No production build ran.
  - Non-goals: dependency upgrades, frontend build, or Docker/Compose execution.
  - Rollback: revert metadata/docs together; do not partially retain an unenforced version claim.

- [x] **F02 - Establish deterministic typecheck and a known-debt ledger.**
  - Depends: F01; D02/D05/D10.
  - Status: COMPLETE - the exact runtime/compiler graph is installed and the strict TypeScript 7 command passes.
  - Scope: pin TypeScript 7.0.2, add an authoritative `tsc --noEmit` script, replace removed `baseUrl` behavior with explicit project-relative `paths` plus matching Vite resolution, make the quarantined `ForgetPassword` file's missing reducer reference compiler-safe without registering a route, classify ambient modules, and contain retained Velzon chart-option debt behind one explicit adapter.
  - Preserve: strict mode, import meaning/case, relative router paths, and no weakening of `strict`, `noEmit`, or casing checks.
  - Acceptance: TypeScript 7 accepts the config without removed-option diagnostics; typecheck runs independently; existing aliases resolve through explicit mappings; the Swiper declaration describes stylesheet-only package subpaths; the sole new unsafe compatibility cast is named, counted, and forbidden to product code; existing `any` count does not increase.
  - Verification: manifest/config/lock JSON and the five-root alias inventory (`assets`, `Components`, `Layouts`, `common`, `slices`) pass; Node 24.19.0/npm 11.17.0 resolve TypeScript 7.0.2 exactly; `npm.cmd run typecheck -- --pretty false` passes; debt ratchets remain 2,530 `any` tokens, 13 ambient declarations, 40 legacy Apex consumers, and one adapter cast; `git diff --check` passes. The production build then exposed and verified the previously masked `assets/*` resolution gap; the explicit fifth mapping corrects it without externalizing a real source asset.
  - Non-goals: route activation/disposition (owned by F22/F25), bulk typing or modernization of quarantined Velzon pages, framework changes, lint, or formatting.
  - Rollback: restore TypeScript/config/import changes as one batch and reopen F02; never roll back by disabling strictness or recreating implicit `baseUrl` lookup behavior.

- [x] **F03 - Resolve the PostCSS/nanoid build-chain findings under current Vite ranges.**
  - Depends: F02; D05/D16.
  - Status: COMPLETE - exact lock resolution, focused audit, typecheck, corrected production build, and preview startup pass.
  - Scope: make the smallest lock resolution to PostCSS 8.5.26 and nanoid 3.3.18 while retaining Vite 8.0.16/plugin-react 6.0.2; any Vite/plugin maintenance requires a separately approved feature under D16.
  - Preserve: Vite React behavior, approved TypeScript pin, base path unchanged, and root Laravel Vite build separation.
  - Acceptance: exact lock has no observed PostCSS/nanoid advisory; no unrelated direct or transitive family changes.
  - Verification: the user-run install resolves PostCSS 8.5.26/nanoid 3.3.18; a fresh npm audit contains neither package; strict TypeScript 7 passes; the first build exposed the now-corrected fifth `assets/*` alias; the rerun builds and starts preview successfully. The separately observed login network error is environmental—port 8080 is closed—and is not a PostCSS/nanoid or bundle failure.
  - Non-goals: Vite/plugin maintenance, Router, Axios, Sass, React, or toolbox upgrades.
  - Rollback: restore the lock only as one diagnostic batch, reopen F03, and keep F29/F32 blocked unless a time-bound approved security exception covers the restored findings.

- [x] **F04 - Remediate the Sass/Immutable build-chain batch.**
  - Depends: F03; D05/D16.
  - Status: COMPLETE - exact current Sass/Immutable, focused audit, typecheck, production build, preview, and CSRF-origin smoke pass.
  - Scope: move Sass to exact current 1.103.1 and its supported Immutable 5.1.9 dependency, containing no Immutable below 4.3.9, with no style redesign.
  - Preserve: current SCSS entry and visual output until D11/D13 work.
  - Acceptance: exact lock clears both observed Immutable records; Node engine compatibility holds; Sass deprecation output is inventoried without hiding it by blanket silencing; retained theme output passes the current preview smoke.
  - Verification: lock resolves Sass 1.103.1/Immutable 5.1.9; a fresh npm audit contains no Immutable key; strict TypeScript 7 and frontend production build pass; preview returns 200 and credentialed-origin CSRF returns 204. The build reports existing asset-plugin timing and large-chunk warnings but no correctness failure. Root Laravel assets do not consume this frontend Sass package, so no unrelated root build is required for this resolution.
  - Non-goals: converting the 117 retained `@import` statements to modules, changing legacy color/global functions, SCSS pruning, RTL redesign, font work, or unrelated dependency refresh.
  - Rollback: restore Sass and lock resolution together only for diagnosis, reopen F04, and keep F29/F32 blocked unless a time-bound approved security exception covers Immutable.

- [x] **F05 - Move Axios to the approved observed-fixed 1.x release.**
  - Depends: F04; D06.
  - Status: COMPLETE - exact lock, focused audit, typecheck, build, and live Sanctum browser regression pass.
  - Scope: select exact current Axios 1.19.0 (not an open-ended `>=` range) and regression-test current session calls before transport consolidation.
  - Preserve: credentialed requests, XSRF cookie/header behavior, JSON web login/logout, `/api/auth/me`, and AbortSignal support.
  - Acceptance: exact lock clears observed Axios records; no global bearer-token or base-URL behavior is added.
  - Verification: lock resolves Axios 1.19.0 and fresh audit contains no Axios key; current session-client/source URL review passes; strict TypeScript and production build pass; the user confirms login -> dashboard -> refresh persistence -> logout and logged-out `/profile` denial against the live Compose backend.
  - Non-goals: fetch migration, full client rewrite, or Router changes.
  - Rollback: revert Axios and lock together only for diagnosis; retain no mixed interceptor assumptions, reopen F05, and block F29/F32 unless a time-bound approved exception covers the restored Axios findings.

- [x] **F06 - Replace the stale CRA test with a runnable Vite test harness.**
  - Depends: F02/F05; D10.
  - Status: COMPLETE - exact install, TypeScript, jsdom harness, and focused test pass.
  - Scope: pin Vitest 4.1.11 and jsdom 30.0.1, add Vite-aligned configuration/setup, move Testing Library to development scope, remove obsolete Jest types, and replace the CRA assertion with a neutral bootstrap smoke test.
  - Preserve: Testing Library behavior and production entry isolation.
  - Acceptance: tests do not require real network, current date, or product-route/store import; Vitest APIs are explicitly imported, Testing Library cleanup is explicit, jsdom is configured, and the CRA assertion/setup/Jest types are removed.
  - Verification: exact Vitest 4.1.11/jsdom 30.0.1 resolve; strict TypeScript passes; `npm test` reports one file and one test passing. The browser-baseline data package emits a non-blocking age notice, with no automatic upgrade folded into F06.
  - Non-goals: broad page snapshots, end-to-end browser tooling, or CI.
  - Rollback: remove harness and test dependencies together; restore no stale CRA claim.

- [x] **F07 - Add lint, format, dependency, boundary, and quality ratchets.**
  - Depends: F02/F06; D04/D10.
  - Status: COMPLETE - exact tools, type-aware governed lint, format checks, rule fixtures, and custom ratchets pass.
  - Scope: pin Oxlint 1.79.0 plus `oxlint-tsgolint` 7.0.2001 and one reviewed current Prettier release, use stable JSON/JSONC type-aware configuration, explicitly enable React/Hooks/JSX-a11y/import/Vitest families, remove the phantom CRA ESLint stanza, and add case/import/dependency/boundary checks plus ambient-`any` ratchets.
  - Preserve: TypeScript 7 explicit path mappings, Vite resolution, separate `tsc --noEmit` authority, and changed-code quality gates.
  - Acceptance: no ESLint/`typescript-eslint` dependency remains; no undeclared runtime import, case-wrong path, new ambient module, increased `any`, forbidden reverse import, hooks violation, basic accessibility violation, or render-side-effect pattern enters changed code; non-default Oxlint families are demonstrably active.
  - Verification: `npm run quality` passes TypeScript, Vitest, governed type-aware lint, one valid/six rejected lint fixtures, dependency/case/boundary/debt self-tests, and Prettier in about nine seconds on Windows. Retained `toolboxMenu` effect debt is contained behind F24B1's root-only lazy boundary; the two legacy-to-devtool boundary exceptions remain exact, named, and ratcheted pending their owning route/dependency slices.
  - Non-goals: Oxfmt/Biome adoption, experimental TypeScript config for Oxlint, custom type-aware JS plugins, zero-warning cleanup of untouched quarantine inventory, or CI policy.
  - Rollback: revert Oxlint/config/package entries atomically and reopen F07; retain the compiler/dependency/boundary checks and do not silently substitute an unsupported ESLint parser or drop an invariant.

- [x] **F07A - Refresh Vite/plugin-react as an isolated maintenance slice.**
  - Depends: F03/F06/F07; D05/D10/D16.
  - Status: COMPLETE - exact current pair, install, TypeScript, tests, lint, formatting, user-run production build/preview, and shell smoke pass.
  - Scope: review changelogs and pin one mutually compatible current Vite 8/plugin-react 6 patch pair after the first clean TypeScript/test/lint baseline; keep this separate from the PostCSS/nanoid security lock batch.
  - Preserve: React 18 behavior, TypeScript 7 aliases, root Laravel Vite separation, frontend base-path semantics, and the clean quality commands.
  - Acceptance: exact versions and Node engines agree; no unrelated dependency family changes; dev/preview behavior, transforms, tests, and asset/base handling remain stable.
  - Verification: manifest/lock diff and focused commands pass; the user-run production build completes with only the recorded asset-plugin timing and large-chunk warnings, preview starts, and the current authenticated/protected shell remains reachable.
  - Non-goals: Router, Axios, Sass, React-major, packaging, or UI changes.
  - Rollback: restore the Vite/plugin package and lock entries atomically while retaining the independent PostCSS/nanoid security resolution; reopen F07A.

### Runtime config and reusable composition (items 2, 3, and 5)

- [x] **F08 - Centralize typed runtime/environment configuration.**
  - Depends: F02/F07/F07A; D01/D03/D05.
  - Status: COMPLETE - lightweight quality, user-run changed-entry production build/preview, and auth/protected-shell smoke pass.
  - Scope: validate backend origin, API base, router base, locale defaults, and build mode once; remove stale fake-auth config.
  - Preserve: local backend override and credentialed origin configuration.
  - Acceptance: core code reads no raw `import.meta.env`; malformed production config fails clearly; URL joining cannot double `/panel` or `/api`.
  - Verification: unit tests for the selected separate-origin backend, root/subpath admin bases, missing/malformed configuration, and URL joining; generic core helpers may retain a same-origin fixture but Checkupino delivery does not claim support for it.
  - Non-goals: choosing or implementing fallback/packaging.
  - Rollback: restore documented prior env reads while retaining the old env contract.

- [x] **F09 - Define core/module/devtool contracts and one manifest schema.**
  - Depends: F07/F08; D04/D12/D13.
  - Status: COMPLETE - additive public contracts, product/devtool separation, manifest validation, tests, and static boundary ratchets pass without route activation.
  - Scope: minimal internal public interfaces for runtime config, transport/auth adapters, tokens/i18n, module registration, route/nav contributions, and optional devtools; start inside `src/core`, `src/modules/checkupino`, and `src/devtools` without creating a workspace package.
  - Preserve: current shell can register through a transition adapter; backend roles remain opaque inputs.
  - Acceptance: core imports no Checkupino module/devtool; modules import only core public APIs; devtools cannot enter a normal manifest; duplicate IDs fail.
  - Verification: boundary fixtures and static graph checks.
  - Non-goals: bulk moves, publishable packages, domain pages, or portability claims.
  - Rollback: remove additive contracts/rules if no consumer has migrated.

### Transport, auth, server state, and authority UX (items 4 and 5)

- [x] **F10 - Implement one typed transport and wire-error adapter.**
  - Depends: F05/F08/F09; D06.
  - Status: COMPLETE - 44 frontend tests, full lightweight quality, and the user-run backend/build/preview/auth regression pass.
  - Scope: one credentialed client, safe query serialization, AbortSignal, 204 handling, and types for every real success/error variant above.
  - Preserve: endpoint wire bodies, headers, messages, codes, field errors, web/API differences, and no browser bearer tokens.
  - Acceptance: migrated product/auth code uses no global Axios defaults and imports HTTP only through the adapter; the legacy fake client is a named, forbidden-for-new-code exception scheduled for F23; 401/403/inactive/404/419/422/423/429/network/cancel remain distinguishable; correlation headers are optional cross-origin.
  - Verification: mocked fixtures copied from representative backend responses and 204 cases.
  - Non-goals: backend envelope normalization, `/api/v2`, or endpoint implementation.
  - Rollback: delegate the interface back to `session_api.ts`; do not expand the named legacy fake/global-client exception or let it enter migrated code.

- [x] **F11 - Create one reactive Sanctum auth authority and replaceable adapter.**
  - Depends: F10.
  - Status: COMPLETE - five test files and 52 tests plus typecheck, governed lint, negative fixtures, auth/boundary/debt ratchets, formatting, and the user-confirmed browser behavior pass. Expected guest/expiry 401 is silent; inactive and submitted-login failures remain explicit.
  - Scope: CSRF/login/me/logout, deduped bootstrap, redirect intent, one shared snapshot, code-sensitive invalidation, and explicit non-admin access-denied/logout UX.
  - Preserve: exact browser flow, `/me` allowlist, role spellings, server session rotation, and backend authorization.
  - Acceptance: guard/header/menu/profile share one snapshot; clear on 401, `account_inactive`, and any logout attempt/failure; ordinary 403 retains auth; doctor/patient cannot loop through admin login.
  - Verification: unit state/error matrix; focused backend tests; user browser matrix for login, refresh, logout, inactive session, non-admin, and expiry.
  - Non-goals: bearer auth, registration, password reset, profile editing, permissions API, or email-verification policy.
  - Rollback: keep the interface and temporarily delegate to prior session calls while always clearing trust on logout.

- [x] **F12 - Add endpoint-specific query/list adapters and cancellation.**
  - Depends: F10/F11; D07.
  - Status: COMPLETE - full lightweight quality passes seven test files and 63 tests, and the user confirms the production build/preview regression. No dependency change or route/screen activation occurred.
  - Scope: approved query layer, dedupe/cancel/cache invalidation, typed filters, and adapters for each preserved list shape.
  - Preserve: endpoint-specific caps, filter/sort allowlists, array/users/paginator/naked/raw bodies, and mixed route identifiers.
  - Acceptance: no generic helper emits unsupported parameters or globally reshapes wire data; unmount cancellation is not an error toast; mutation invalidation is explicit.
  - Verification: fixtures for users, modern admin arrays, paginator-in-data, public naked data, and raw compatibility response.
  - Non-goals: Phase 3 endpoint screens, backend pagination modernization, or offline cache.
  - Rollback: endpoint adapters call transport directly while retaining their typed result contracts.

- [x] **F13 - Add UX capability predicates and recent-password orchestration.**
  - Depends: F11/F12.
  - Status: COMPLETE - full lightweight quality passes nine test files and 74 tests, and the user verifies the current admin/root browser regression; no prompt UI or product mutation is activated before its later primitive/screen owner.
  - Scope: role-derived presentation predicates and explicit 423 -> password confirmation -> retry-once coordination.
  - Preserve: backend policy authority, 900-second server timeout, CSRF, reasons, exact payloads, and no optimistic privilege.
  - Acceptance: root-only controls are absent for admin; ordinary 403 never triggers logout; step-up retries once only after user confirmation; cancellation leaves mutation unapplied.
  - Verification: unit/integration fixtures for 403/419/422/423 and user browser admin/root matrix.
  - Non-goals: inventing permissions, exposing root records, or bypassing step-up.
  - Rollback: disable retry orchestration and show the server error; never bypass policy.

- [x] **F14 - Compose routes, navigation, titles, breadcrumbs, loaders, and visibility from one registry.**
  - Depends: F09/F11/F13; D02/D03/D12.
  - Status: COMPLETE - the additive registry is validated and tested without activating canonical routes or changing current UI behavior; full lightweight quality passes ten test files and 81 tests, and the production build passes in 4.87 seconds.
  - Scope: migrate neutral entries first; define lazy loader, module owner, title key, breadcrumb data, nav placement, and UX visibility once.
  - Preserve: role names and backend enforcement; hidden navigation is not claimed authorization.
  - Acceptance: duplicate IDs/paths fail; every navigable entry has one canonical record; no fake future slot becomes clickable; devtools registration is optional.
  - Verification: registry tests for guest/admin/root, missing modules, and base-path variants.
  - Non-goals: canonical route activation, product-domain pages, or backend permission changes.
  - Rollback: registry can feed the old composers until migration passes.

### Approved design and reusable primitives (item 6)

- [x] **F15A - Freeze the multilingual UX, locale-owned direction, and accessibility detail contract.**
  - Depends: F09; D09/D11.
  - Status: COMPLETE - the user approved the compact matrix and clarified that language owns direction (`fa` -> RTL, `en` -> LTR); a separate RTL/LTR setting is forbidden.
  - Scope: present and record the smallest coherent choices for translation-key ownership, Persian font and shipped weights/formats, Persian/Latin numerals, Jalali/Gregorian inputs and display, Tehran/server timestamps, density, breakpoints/mobile navigation, loading/empty/error behavior, archive wording, modal/drawer/focus behavior, WCAG target, and supported browsers/viewports. Retain the already-approved System/Light/Dark color-preference model and require complete Persian/English copy in the matrix.
  - Preserve: every newly designed product-facing worded element uses the shared translation system with complete Persian/English coverage, Persian uses standard RTL rather than bespoke RTL behavior, React 18/Bootstrap admin constraints remain, backend date/time meanings remain unchanged, device-scoped color/layout personalization survives logout, and no UI code begins before the remaining approval.
  - Acceptance: every listed choice has an explicit user-approved value and verification example; a fresh browser defaults color mode from `prefers-color-scheme`, explicit light/dark persists, System removes the override, and system color never changes locale/direction; Velzon behavior is reference evidence rather than an implicit decision.
  - Verification: user review of a compact written matrix and representative FA/RTL and EN/LTR acceptance examples.
  - Non-goals: component implementation, asset/font installation, broad translation, product-page design, or future public/client UI decisions.
  - Rollback: revert only this detail record and keep F15 and all dependent UI slices blocked.

- [x] **F15 - Establish locale, direction, tokens, typography, and shell bootstrap.**
  - Depends: F09/F15A; D09/D11.
  - Status: COMPLETE - automated quality/build/asset evidence passes and the user accepted the focused browser handoff on 2026-08-26.
  - Scope: apply approved document `lang`/`dir` before public/protected rendering; couple locale/direction by policy; establish the ordinary Bootstrap RTL/logical-property baseline needed by later components; version persisted settings; limit shipped fonts; represent color preference as System/Light/Dark without conflating it with direction or structural layout.
  - Preserve: approved RTL default, English/LTR option, existing explicit light/dark choices, device-scoped personalization across logout, and safe fallback for old stored values.
  - Acceptance: no wrong-direction or wrong-color flash; the base uses semantic DOM order and logical layout properties without bespoke RTL behavior; approved Persian typography/numerals/dates apply; public and protected roots share the contract; a manual color override remains stable until the user explicitly returns to System. This base gate does not claim that the current Velzon shell is visually repaired.
  - Verification: focused DOM tests and user browser checks in FA/RTL and EN/LTR at approved widths.
  - Non-goals: product page design or full translation of retained toolbox references.
  - Rollback: fall back to the last versioned theme/locale schema without breaking startup.

- [x] **F16 - Build feedback, loading, empty, error, status, and toast primitives.**
  - Depends: F10/F15.
  - Status: COMPLETE - 15 test files/115 tests, quality ratchets, and the 7.42-second production build pass.
  - Scope: accessible localized presentation that retains structured server details and best-effort correlation IDs; all newly authored default labels/messages are Farsi and render correctly under standard RTL.
  - Preserve: backend wording/code where support-relevant and safe retry semantics.
  - Acceptance: no render-time toast; status never relies on color alone; unknown/default Laravel errors remain visible; aborts remain quiet.
  - Verification: component tests in both directions with every error class.
  - Non-goals: domain status maps or global response rewriting.
  - Rollback: adapt old spinner/toast presentation to the structured error contract.

- [x] **F17 - Build typed fields and server-validation adapters.**
  - Depends: F16; D08/D11.
  - Status: COMPLETE - exact dependencies resolve, 18 test files/126 tests and the 7.36-second production build pass, and focused OSV queries return no advisory for the new package family.
  - Scope: React Hook Form/Zod-backed typed text/select/textarea/date/file seams and endpoint-aware 422 mapping for API and web-login shapes, with library-independent public props where practical.
  - Preserve: exact backend field names and backend validation as final authority.
  - Acceptance: accessible Persian/English label/help/error/required states; keyboard and ordinary RTL/LTR alignment pass; unknown/global errors are not discarded.
  - Verification: focused components with representative Laravel payloads.
  - Non-goals: Checkupino domain forms, date-policy invention, or upload endpoints.
  - Rollback: render controlled Bootstrap fields without schema integration using the same props; do not restore a second long-lived Formik/Yup stack.

- [ ] **F18 - Build dialog/drawer, reasoned archive, and step-up presentation.**
  - Depends: F13/F17; D11.
  - Status: DEFERRED AFTER IMPLEMENTATION; the user explicitly deferred F18 on 2026-09-02 so work continues from F22 onward. The original full 21-file/136-test quality gate and 7.01-second production build passed, and the correctly configured focused rerun passes 3 files/10 tests. No approved product route currently mounts these primitives, so real-browser keyboard/RTL evidence is intentionally deferred with the feature. The former plan to collect it through F22 was superseded when the replacement shell/preferences drawer was reverted to preserve Velzon. F18 is not a prerequisite blocker for subsequent non-overlay Phase 2 slices; resume it only when an approved real product operation genuinely consumes an overlay, without adding a harness or changing the Velzon shell merely to close the checkbox.
  - Scope: accessible modal/drawer primitives and separate reason/password-confirmation flows.
  - Preserve: archive rather than physical-delete meaning, exact reason payload, 204 success, focus restoration, and non-optimistic destructive mutations.
  - Acceptance: complete Persian/English confirmation/action copy, focus trap/return, Escape, duplicate-submit, retry, cancel, and ordinary RTL/LTR behavior are defined; no JSON parse on 204.
  - Verification: focused interaction tests plus user keyboard/browser check.
  - Non-goals: new destructive endpoints or policy changes.
  - Rollback: use inline confirmation while retaining reason and step-up contracts.

- [x] **F19 - Build the controlled server-data-table primitive.**
  - Depends: F12/F16; D08/D11.
  - Status: COMPLETE - exact native v9 contract, retained-wrapper legacy bridge, 12 focused fixtures, full 23-file/148-test quality gate, and 8.25-second production build pass.
  - Scope: TanStack Table v9 server pagination/filter/sort/search, URL/query synchronization, responsive overflow, keyboard behavior, logical start/end pinning, and approved selection policy.
  - Preserve: backend allowlists, endpoint adapter metadata, stable row identifiers, and mixed ID routing.
  - Acceptance: one v9 table contract remains; never re-sort/filter a single server page client-side; debounce/cancel is deterministic; at least two incompatible list shapes render through adapters; labels/states have complete Persian/English coverage and pinning uses standard logical start/end semantics.
  - Verification: focused table fixtures in FA/RTL and EN/LTR, narrow and wide.
  - Non-goals: domain columns, export, virtualization, or bulk actions.
  - Rollback: render a simple Bootstrap table from the same typed list result.

- [x] **F20 - Build presentation-only file and audit primitives.**
  - Depends: F16/F17.
  - Status: COMPLETE - 12 safe presentation fixtures, interface/network/privacy ratchets, full 25-file/160-test quality gate, and 8.31-second production build pass.
  - Scope: metadata/file-selection presentation and a sanitized immutable-event timeline supplied by an authorized caller.
  - Preserve: private-file metadata boundaries; no disk/path/scanner/provider/PII leakage; no audit fetch in the primitive.
  - Acceptance: client limits are hints only; unavailable files and server errors render safely; actors/timestamps/reasons are escaped and immutable.
  - Verification: focused safe fixtures and accessibility tests.
  - Non-goals: upload/download APIs, medical workflow, audit-history API, or Phase 3 screen.
  - Rollback: native file input/plain event list using the same safe data contracts.

### Shell, neutral surfaces, and Velzon isolation (items 3 and 8)

- [x] **F21 - Stabilize shell lifecycle and DOM behavior.**
  - Depends: F11/F14/F15/F16.
  - Status: COMPLETE - lifecycle fixtures, full 27-file/164-test quality gate, static anti-drift ratchets, 10.65-second production build pass, and user-confirmed navigation/resize/search/fullscreen/theme browser smoke.
  - Scope: clean up search/layout/sidebar/resize listeners, guard DOM access, remove render-time effects, consume the shared auth snapshot, and add one cleaned-up `prefers-color-scheme` subscription that is active only while color preference is System.
  - Preserve: approved layout behavior, responsive contract, and keyboard navigation.
  - Acceptance: listener counts do not grow across render/navigation; tests can import shell modules; one auth subscription drives shell state; OS color changes update System mode but never overwrite a persisted explicit light/dark choice.
  - Verification: focused lifecycle tests and user navigation/resize smoke.
  - Non-goals: product visual redesign or demo deletion.
  - Rollback: revert one listener/effect fix at a time while preserving shared auth authority.

- [x] **F22 - Connect the original Velzon surfaces without redesigning them.**
  - Depends: F11/F14/F15/F16/F21; D02/D11/D13.
  - Scope: keep the restored Velzon login, dashboard, profile, header, sidebar, footer, search, notifications, language flag, color/customizer controls, logo assets, and their exact composition; connect existing behavior to the approved Vite runtime, Sanctum authority, `/me` identity, role-derived navigation, translations, and locale-owned direction. Keep logout as a controlled action and keep `/logout` unregistered.
  - Preserve: exact Velzon markup/class/asset/layout baseline; exact Sanctum endpoints and error semantics; Blade routes; safe `/me` data; retained reference inventory; F21 lifecycle fixes.
  - Acceptance: no hard-coded credentials or navigable logout page; login/profile/header consume the single auth authority; the existing flag control changes language and language alone changes document direction; translated text changes in place without moving/replacing controls; no custom replacement shell, landing, not-found page, preferences drawer, logo, or geometric RTL rewrite enters the active composition without separate approval.
  - Verification: structural regression tests for Velzon markers/classes/assets, route/logout/auth tests, catalog parity and direction tests, the restored 10.89-second production build, and user browser observation that language/direction switching is present while retained physical utility/custom classes cause known RTL geometry defects. Pixel-level visual regression is transferred to `docs/TODO.md` Phase 3 demo-delivery item 11 rather than misreported as passing here.
  - Non-goals: visual redesign, component replacement, route-architecture finalization, fake-data disposition, Phase 3 metrics, registration/password-reset/profile backend implementation, toolbox quarantine/deletion, bundle optimization, CI, or portability.
  - Rollback: revert one integration seam while retaining the Velzon surface; never replace the surface to solve an adapter defect.
  - Status: COMPLETE FOR TECHNICAL INTEGRATION; VISUAL RTL DEBT TRANSFERRED, NOT CLOSED. The frozen Velzon composition remains intact. Search, customizer, retained auth pages/frame, profile, and the active ecommerce dashboard translate existing visible text through paired `en`/`fa` keys in place; language remains the only document-direction writer. Login, header, profile, and dashboard heading consume the shared `/me` identity. Registration's unavailable-backend failure no longer leaves its loader stuck, and its render-time toast side effect is removed. Active toolbox visibility is proven to derive from the `/me` `root-admin` role. The user explicitly selected the checked-in vanilla behavior for the dormant notification control and dashboard presentation/data; no component placement or product semantics were added. Current lightweight quality passes 36 test files/181 tests, governed Oxlint/fixtures, ratchets, and formatting. The restored-baseline production build passes in 10.89 seconds on 2026-09-02 with only retained Sass/Tailwind/bundle warnings. The user prioritizes a working demo and reserves class-level RTL geometry remediation for final demo stabilization. The checkbox closes only the technical connection contract; Phase 3 demo-delivery item 11 now owns the visible RTL defect inventory and final regression.

- [x] **F23 - Remove demo reducers, fake helper, and broad thunk reach from normal startup.**
  - Depends: F22.
  - Scope: reduce Redux to approved layout/auth/RTK Query state, remove global fake Axios reachability, and make any retained devtool reducer opt-in behind its isolated entry.
  - Preserve: approved layout/auth/query state and retained toolbox behavior behind its boundary.
  - Acceptance: normal entry static graph contains no `fakebackend_helper`, Themesbrand API config, demo reducer, all-thunks barrel, or demo common-data barrel.
  - Verification: static graph and boundary tests; user later confirms built chunks.
  - Non-goals: package/file deletion, stylesheet pruning, or toolbox UI changes.
  - Rollback: restore only an approved isolated adapter, never global fake client state.
  - Status: COMPLETE. The startup reducer contains only RTK Query, Layout, Login, Account, ForgetPassword, and Profile. Root-toolbox routes dynamically import one installer that injects the retained demo reducers before a toolbox page loads. Active shell components import the layout thunk directly; the active dashboard imports `dashboardEcommerce.ts` directly; Revenue selects the exact existing local arrays without Redux or a fake request. Static reachability ratchets fail if the normal entry/auth/dashboard graph reaches `fakebackend_helper`, `api_helper`, Themesbrand config, the all-thunks/common-data barrels, devtool installer, or a demo reducer. Tests prove base-state absence, explicit idempotent devtool installation, unchanged Revenue period data, and the integrated lazy loading of a real `/panel/dev/pages-starter` page after the retained reducers are installed. Full lightweight quality passes 36 files/181 tests with `any` debt at 2,518. The 10.89-second production build keeps the 21.55 kB devtool installer and the fake/Themesbrand thunk in separate dynamic chunks absent from the initial HTML modulepreloads; all retained toolbox artifacts were still emitted before the later F24B1/F24B2 split. The user confirms the root-admin toolbox menu and Starter route load successfully, while an ordinary admin sees no toolbox and is redirected from its direct route.

- [x] **F24A - Tighten the root-admin developer-toolbox route/menu authority.**
  - Depends: F09/F14/F23; D12/D13.
  - Status: COMPLETE - all 181 retained toolbox menu links are unique and represented by the retained route inventory; the 182-route count differs only by the toolbox base/default compatibility entry. Shared path constants now own the base, default, and compatibility alias. Every retained demo route carries the root-only role contract, direct access is proven for root/admin/non-admin roles, and normal admins receive no toolbox menu. Full lightweight quality passes 34 files/179 tests with the existing `any` ceiling of 2,518.
  - Scope: connect the existing static Velzon demo pages to one Developer Toolbox menu and make `/me` role-derived `root-admin` capability the sole client-side visibility/direct-route guard.
  - Preserve: original Velzon page/menu design and static fake demo behavior; backend authorization remains authoritative.
  - Acceptance: every retained menu target resolves to a root-only route, no duplicate toolbox target exists, normal admins do not receive toolbox navigation, and direct URL access denies ordinary admin and non-admin roles.
  - Verification: exhaustive route/menu parity test, capability-seam ratchet, and guarded-route tests.
  - Non-goals: functionalizing demo pages, visual changes, package/style/locale/asset isolation, physical deletion, or claiming client-side guards are security authorization.
  - Rollback: remove the shared contract/test seam while restoring the previous root-only composer behavior; never make demo routes public.

- [x] **F24B1 - Lazy-isolate the devtool JavaScript control plane.**
  - Depends: F09/F14/F23/F24A; D12/D13.
  - Status: COMPLETE. One root-only `/panel/dev/*` entry dynamically imports the toolbox route inventory; only a confirmed `/me` `root-admin` identity dynamically imports the 1,106-line toolbox menu hook; retained reducers remain installed only by the lazy toolbox route path. Full quality passes 37 files/183 tests with unchanged ceilings. The 7.32-second build emits non-preloaded `ToolboxNavigationData` (21,161 bytes), `ToolboxRouter` (44,394 bytes), and `installReducers` (21,553 bytes) chunks; initial JS falls from 412,180 to 364,819 bytes. Shared translation catalogs still contain toolbox labels, and after F25 the neutral default-path constant is router-local `/dev/dashboard-analytics`; neither is an eager menu/route/page import. The user confirms ordinary-admin navigation/direct-route denial and root-admin menu, Starter, and Swiper behavior after the split, with no blank or reset shell.
  - Scope: isolate toolbox menu definitions, route inventory, demo pages, and reducer installer behind the existing role-aware runtime boundaries without changing URLs, labels, pages, reducers, or Velzon composition.
  - Preserve: root-only visibility/direct access, the complete retained static-demo inventory, original Velzon markup/design, product navigation, translations, and backend authority.
  - Acceptance: an ordinary-admin startup never evaluates the toolbox menu/route inventories or demo reducers; root menu data loads only after `/me` confirms `root-admin`; toolbox routes load only after the guarded `/panel/dev/*` entry renders; all existing paths and parity checks remain intact.
  - Verification: static import ratchets, role-loaded menu tests, integrated real-page/reducer test, full quality/build, emitted HTML/chunk inspection, then one root/admin browser regression.
  - Non-goals: CSS, locale-catalog, font, image, dependency, allowlist, quarantine, deletion, Router migration, RTL repair, visual change, or treating client visibility as security.
  - Rollback: restore the previous eager composer imports while retaining F23 reducer injection and F24A root-only guards; reopen F24B1 and block F25 rather than weakening authority.

- [ ] **F24B2 - Isolate devtool styles, locales, fonts, and assets after functional convergence.**
  - Depends: F24B1 and the approved F27 dependency dispositions; D11/D13.
  - Status: DEFERRED by user priority. It is an evidence umbrella implemented in bounded F27G-F27I batches after the functional JavaScript/dependency path is stable; it is not a prerequisite for F25.
  - Scope: define the retained-page allowlist and optional asset/style entry boundaries, then exclude zero-reach devtool/page CSS, locale, font, and image families from normal-product startup while keeping Velzon source recoverable.
  - Preserve: original Velzon design/assets, approved toolbox pages, English/Farsi label parity, locale-owned direction, licenses, rollback history, and normal-product styling.
  - Acceptance: normal-product startup excludes allowlisted-devtool-only style/locale/font/image families; each batch has measured pre/post reach and visual evidence; no source is physically deleted without a later explicit decision.
  - Verification: F27G-F27I source graphs, build manifest/network evidence, and normal/root EN/LTR plus FA/RTL browser matrix; full RTL geometry remains the separate final-demo stabilization gate.
  - Non-goals: Router work, dependency-family upgrades, physical deletion, logo/layout redesign, bulk RTL repair, or treating emitted-but-unrequested lazy assets as startup downloads.
  - Rollback: re-admit only the failed family at its isolated import boundary; keep the rest of F24B2 open and the F24B1 JavaScript boundary intact.

- [x] **F25 - Migrate Router and activate canonical paths one family at a time.**
  - Depends: F11/F14/F22/F24B1; D01-D03/D06.
  - Status: COMPLETE. `react-router-dom` and its sole `react-router` dependency resolve exactly to 7.18.3. Vite and `BrowserRouter` share `/panel`; an exact development/preview redirect canonicalizes bare `/panel` to `/panel/`; the active product router derives relative `login` and index records from the approved manifest; devtools use relative `dev/*` route records and router-local `/dev/*` links; authenticated unknown/removed paths return to `/panel`, while guests return to `/panel/login`. The frozen legacy toolbox hook remains byte-unchanged behind an adapter. Full quality passes 38 files/192 tests with unchanged debt ceilings. The 7.72-second artifact uses `/panel/assets/*`, contains no `/panel/panel` or root-asset reference, and does not preload toolbox chunks. Router 7 raises initial JS from the F24B1 364,819-byte baseline to 406,099 bytes (+41,280; +11.3%), an accepted measured compatibility/security cost pending later bundle budgets. The user confirmed the logged-out/admin/root route, denial, removed-route, and controlled-logout matrix; a local HTTP probe confirms bare `/panel` returns `307 Location: /panel/` and canonical `/panel/` returns 200. F29 still owns deployed static-host refresh/fallback proof.
  - Scope: pin one reviewed `react-router-dom` 7.18.x release (exact 7.18.3, never an open range into Router 8), activate relative records under the validated `/panel` basename, and implement only `/panel/login`, authenticated `/panel`, allowlisted root-only devtools, and the approved unknown-route behavior.
  - Preserve: separate admin/API origins, Laravel-owned Blade routes, and POST-only logout; do not create client routes for `/api`, `/sanctum`, Laravel public pages, or the removed SPA placeholders.
  - Acceptance: all eight old SPA registrations are absent with explicit not-found outcomes; router-level direct URL, auth redirect, logged-out redirect, role denial, and 404 behavior works without `/panel/panel` drift. Static-admin-host refresh/fallback behavior remains explicitly unverified until F29.
  - Verification: registry/router tests and user browser matrix on the selected separate-origin development topology; F29 owns deployed admin-origin refresh/fallback proof.
  - Non-goals: static-host delivery, Laravel/Nginx fallback, Blade cutover, compatibility redirects, or Phase 3 routes.
  - Rollback: restore the previous SPA-only route adapter and Router package/lock entries atomically; leave Blade production untouched, reopen F25, and block F29/F32 unless a time-bound approved exception covers the restored Router findings.

- [x] **F26 - Resolve product-reachable Swiper and the critical advisory.**
  - Depends: F22; D13. F24B1 is additionally required only when a retained toolbox carousel must be JavaScript-isolated before its disposition is proven.
  - Status: COMPLETE. `swiper` is exactly pinned and locked at 14.2.0. TypeScript accepts every active and retained import without source compatibility edits; an actual React-wrapper test renders the unchanged four-card review inventory; current full lightweight quality passes 36 files/181 tests with all debt ceilings unchanged; and the production build passes in 5.45 seconds. The Swiper React chunk falls from 81.34 to 79.22 kB minified and from 24.71 to 24.34 kB gzip. The lock-only audit falls from 65 findings with one critical to 64 findings with zero critical and no Swiper key. An exact manifest/lock ratchet prevents a silent downgrade. After the product dashboard offered no accessible test surface, the user confirmed the retained `/panel/dev/advance-ui-swiper` page renders through the now-verified root-admin toolbox. No temporary route, hidden dashboard exposure, or Velzon composition change was introduced.
  - Scope: confirm the clean product graph no longer reaches Swiper, then remove it from the active manifest/lock if the quarantined allowlist does not need it or select/test one fixed major: current v12.2.0 or reviewed v14.2.0. Retained source may remain quarantined without its package. The 2026-09-02 audit confirms current 11.2.10 is affected by GHSA-hmx5-qpq5-p643 (`>=6.5.1 <12.1.2`); the package/release refresh supersedes the earlier provisional v14.1.0 candidate.
  - Preserve: only user-approved reference behavior.
  - Acceptance: no critical Swiper record in the exact lock and no unreviewed carousel API migration.
  - Verification: import graph, lock audit, focused real-wrapper test, production build, exact-version ratchet, and user-confirmed `/panel/dev/advance-ui-swiper` browser rendering.
  - Non-goals: unrelated chart/editor/date packages.
  - Rollback: disable the affected page or retain the last fixed package. A diagnostic v11 restore reopens F26 and blocks F29/F32 unless D14 grants a time-bound exception; never restore product reach to the vulnerable line.

- [x] **F27A - Resolve the coupled CKEditor/lodash-es family and license decision.**
  - Depends: F24B1; D13/D14.
  - Status: COMPLETE. The user approved the GPL path. The deprecated predefined build is replaced by exact modular `ckeditor5` 48.5.0 plus `@ckeditor/ckeditor5-react` 11.2.0 behind one common adapter with `licenseKey: "GPL"`; all five retained consumers use that adapter without changing their Velzon composition. `lodash-es` resolves to 4.18.1 without an override. A distributable notice is emitted from `public/THIRD_PARTY_NOTICES.txt`, and ratchets enforce exact/aligned CKEditor versions, adapter ownership, GPL configuration, notice retention, and absence of the predefined build. Together with exact `react-quilljs` 2.0.4/Quill 2.0.2, full quality passes 40 files/194 tests; the exact production audit reports only the two F27B ECharts moderate records; and the production build passes in 9.65 seconds. The editor chunk stays lazy and decreases from about 1.36 MB/332 kB gzip to 905.76 kB/239.35 kB gzip. The user confirms CKEditor toolbar/editing/bold, Quill rendering, and no editor runtime/license error at `/panel/dev/forms-editors`. Local `/me` latency remains separately deferred.
  - Scope: exclude unapproved editor references from every active manifest and remove their packages from the active manifest/lock while retaining source in quarantine, or migrate every allowlisted CKEditor package together to a fixed modern installation with the explicitly approved GPL/commercial license; remediate its exact-pinned lodash-es atomically.
  - Preserve: approved editor reference behavior and required license notices only.
  - Acceptance: no deprecated predefined build, no mixed CKEditor versions, no npm override used as the default lodash fix, and no observed CKEditor/lodash advisory unless D14 records a time-bound exception.
  - Verification: import/config/license review and exact-lock audit; user install/build and retained-editor browser check.
  - Non-goals: adding an editor to the product, content workflows, or unrelated lodash package changes.
  - Rollback: disable the retained editor manifest or restore the entire aligned family together; block F29/F32 if findings return.

- [x] **F27B - Resolve the ECharts reference family.**
  - Depends: F24B1; D13/D14.
  - Status: COMPLETE. Exact `echarts` 6.1.0 and `echarts-for-react` 3.0.6 resolve with valid v6 peer support. One common adapter forces ECharts' official `v5` compatibility theme, and the retained rich-label chart disables v6 inheritance to preserve Velzon appearance. Full quality passes 42 files/196 tests, production audit reports zero findings, and the 5.50-second build keeps ECharts out of initial HTML. The lazy chart chunk is 1,183.68 kB/391.14 kB gzip versus the previous 1,062.93 kB/344.53 kB gzip. On 2026-09-07 the user confirms all charts at `/panel/dev/charts-echarts` render without blanks, displaced labels, overlaps, or console errors. This measured compatibility cost is recorded; it does not establish a bundle threshold.
  - Scope: quarantine ECharts pages and remove `echarts`/`echarts-for-react` from the active manifest/lock if outside the allowlist, or migrate retained references atomically to reviewed ECharts 6.1.0 and a wrapper release whose peer range supports v6 (currently `echarts-for-react` 3.0.6).
  - Preserve: only approved chart-reference behavior.
  - Acceptance: no observed ECharts advisory, wrapper peer support is valid, and no silent option/renderer incompatibility remains.
  - Verification: static reach and lock audit; user install/build and retained-chart browser check.
  - Non-goals: product analytics, other chart libraries, or visual redesign.
  - Rollback: disable the affected reference page or restore the ECharts package/lock batch; do not restore a vulnerable production artifact.

- [x] **F27C - Remove or replace deprecated react-scrollspy usage.**
  - Depends: F24B1; D13.
  - Status: COMPLETE. Deprecated `react-scrollspy` and its lock entry are removed. Three retained landing pages use the internal dependency-free VelzonScrollspy component, preserving list markup, classes, offset, active-item behavior, and cleaned-up scroll/resize/animation-frame work. Focused behavior, typecheck, ratchet, full quality, production audit, and build gates pass. On 2026-09-07 the user confirms `/panel/dev/landing` updates its active navbar item while scrolling and navbar links reach the correct sections. No replacement package or navigation redesign was introduced.
  - Scope: quarantine unreachable references and remove the deprecated package from the active manifest/lock; if an allowlisted page requires the behavior, amend the approved dependency decision before selecting a maintained replacement.
  - Preserve: approved in-page navigation semantics.
  - Acceptance: no active import or manifest entry relies on deprecated `react-scrollspy`; no unapproved replacement is added.
  - Verification: import graph, package/lock diff, and focused retained-page behavior.
  - Non-goals: global navigation redesign or unrelated scrolling libraries.
  - Rollback: disable the reference page; restore the old package only under a named temporary support exception.

- [x] **F27D - Isolate or remove Moment/date-demo usage.**
  - Depends: F15/F24B1; D11/D13.
  - Status: COMPLETE. Moment remains exactly 2.30.1 because the 17 unchanged consumers are allowlisted retained demos. None enters the normal product/core graph, no `moment/locale/*` import exists, and the 60.27 kB/19.63 kB gzip base chunk remains lazy and absent from initial HTML. The obsolete ambient declaration is removed so real package types are checked.
  - Scope: remove unapproved demo reach; if retained, keep Moment outside reusable core, bound locale imports, and record its maintenance/bundle cost.
  - Preserve: the user-approved Persian/calendar/time-zone policy; do not substitute date semantics implicitly.
  - Acceptance: core has no Moment dependency; retained usage is allowlisted, lazy, locale-bounded, and measured.
  - Verification: import/build graph and date fixture review; user bundle/browser check.
  - Non-goals: selecting a new product date library without D11/dependency approval.
  - Rollback: disable the affected demo page or restore only its isolated date adapter.

- [x] **F27E - Close the table-package duplication.**
  - Depends: F19/F24B1; D08/D13.
  - Status: COMPLETE. Unused `react-table` 7.8.0 and `@types/react-table` 7.7.20 are removed from manifest, lock, installation, and ambient declarations. Checkupino keeps native TanStack v9, while the two unchanged retained wrappers remain explicitly bounded to the v9 `/legacy` bridge. Existing table fixtures, typecheck, ratchets, full quality, audit, and build pass.
  - Scope: remove unused `react-table` v7 and its types after the selected TanStack major is proven across product and retained references.
  - Preserve: server-table contracts and approved retained table examples.
  - Acceptance: one table major remains; stale ambient declarations and v7 types are absent; no reference imports v7 transitively.
  - Verification: dependency/import checks, table fixtures, and user build/browser check.
  - Non-goals: table UX redesign or another table library.
  - Rollback: restore package/lock/types only with the specific broken reference and a removal deadline.

- [x] **F27F - Close undeclared runtime imports one package pair at a time.**
  - Depends: F23/F24B1; D04/D09/D13.
  - Status: COMPLETE. Existing runtime imports are now direct exact dependencies: `classnames` 2.5.1, `lodash` 4.18.1, `prop-types` 15.8.1, and wrapper-compatible toolbox-only `nouislider` 14.7.0. No source rewrite or visual change was made. The undeclared-family ratchet drops from four to zero, ambient shims drop from 13 to 10, full quality passes 42 files/196 tests, audit is zero, and build passes in 5.50 seconds.
  - Scope: umbrella gate for separately authorized micro-slices, each removing or explicitly approving/directly declaring exactly one of `classnames`, `lodash`, `prop-types`, or toolbox-only `nouislider`; do not confuse `lodash` with CKEditor's `lodash-es` family.
  - Preserve: normal shell behavior and allowlisted toolbox controls.
  - Acceptance: clean dependency check has no transitive-only runtime imports and no commented import is promoted without need.
  - Verification: manifest/import graph and clean-install resolution; user typecheck/build.
  - Non-goals: blanket declaration of every transitive package or preserving discarded demos.
  - Rollback: restore one import/package pair atomically or remove the dependent reference.

- [x] **F27G - Isolate and prune devtool/page stylesheet families.**
  - Depends: F24B1; D11/D13.
  - Status: COMPLETE; USER-CONFIRMED BROWSER MATRIX PASSED on 2026-09-11. The user approved the complete technical stylesheet boundary on 2026-09-10 so future toolbox sections remain modular. `ToolboxRouter` owns one ordered `toolbox.scss` entry containing 42 retained demo plugin/page families, `shepherd.css`, `mermaid.min.css`, and the exact toolbox-only overrides formerly emitted by the shared theme. Shared authentication/dashboard/ecommerce and shell plugin styles remain global. No selector, declaration, component markup, route, asset, translation, or dependency changed.
  - Evidence: full quality passes 42 files/196 tests and the production build passes in 7.24 seconds. Initial CSS is 1,005,308 bytes/158,726 gzip versus the post-ECharts 1,118,288/179,743, a reduction of 112,980 bytes/21,017 gzip. The separate toolbox stylesheet is 112,887 bytes/20,886 gzip, has no inspected toolbox marker leak into initial CSS, and is absent from initial HTML. Package/lock/ECharts hashes are unchanged; the prior zero-finding audit remains applicable.
  - Visual evidence/rollback fixture: source order and all original style rules are preserved at the root-only lazy entry. The user confirmed login/home and the retained calendar, editor, upload, slider, Chat, profile, and landing surfaces remain styled and error-free. If a demonstrated retained-page regression appears, restore only its family at the global import location while keeping the other isolated families lazy.
  - Anti-drift: ratchets enforce exact family order, absence from global `app.scss`/`themes.scss`, ownership by `ToolboxRouter`, preserved ECharts lazy ownership, and zero undeclared dependency families. The first broad suite had one unrelated Quill timeout; its focused rerun and the final complete suite passed without timeout/config changes.
  - Scope: move allowlisted devtool/page/plugin styles behind their entry and exclude one zero-reach style family from active build graphs per micro-batch while retaining recoverable source until deletion is separately approved.
  - Preserve: approved Bootstrap shell/RTL output and retained-page styling.
  - Acceptance: normal product CSS graph excludes devtool/page/plugin families not used by product; every removal has a visual rollback fixture.
  - Verification: SCSS graph; user build CSS manifest and normal/root visual matrix.
  - Non-goals: token redesign, Sass upgrade, or broad stylesheet deletion.
  - Rollback: restore only the failed style-family import and assets.

- [x] **F27H - Minimize font and locale payloads.**
  - Depends: F15/F24B1/F27G; D11/D13.
  - Status: COMPLETE; USER-CONFIRMED BROWSER MATRIX PASSED on 2026-09-11. The user approved removing legacy shipped font formats on 2026-09-10. Active HKGrotesk 300/400/500/600, Vazirmatn variable 100-900, Material Design Icons, Boxicons, Line Awesome, and Remix Icon declarations reference WOFF2 only. The unused local Roboto TTF declaration is absent, while the existing CSS fallback family name remains unchanged. Legacy font files stay recoverable in source and do not enter the production artifact.
  - Evidence: emitted font assets fall from 34 files/8,375,625 bytes to 11 WOFF2 files/1,135,684 bytes, a 23-file/7,239,941-byte reduction. Initial CSS falls from 1,005,308/158,726 gzip to 1,002,953/158,135 because legacy source lists are gone; the 112,887/20,886 toolbox stylesheet is unchanged and absent from initial HTML. Only `en` and `fa` are imported by i18n; retained `ar/ch/fr/gr/it/ru/sp` reference files already emit no build payload. Full quality passes 42 files/196 tests and build passes in 7.30 seconds. The unchanged lock retains zero-finding audit evidence.
  - Anti-drift: the quality ratchet strips comments, inspects every active product/icon `url(...)`, rejects non-WOFF2 font sources or a restored local Roboto TTF declaration, and fixes the active source count at 11.
  - Scope: ship only approved font families/weights/formats and lazy/bound retained devtool locales.
  - Preserve: FA/RTL and EN/LTR typography, fallback fonts, and selected reference translations.
  - Acceptance: normal entry contains only approved locales/fonts; missing glyph/weight and direction fallback tests pass.
  - Verification: source graph and font/locale inventory; user build/network/browser proof.
  - Non-goals: translating every retained demo or changing product copy outside approved surfaces.
  - Rollback: restore the smallest required weight/locale chunk with measured evidence.

- [ ] **F27I - Quarantine page and image assets by the approved allowlist.**
  - Depends: F24B1/F27G-F27H; D13.
  - Status: DEFERRED UNTIL 2026-09-21 by user decision on 2026-09-11. The current artifact already keeps 191 toolbox-only media assets/12,402,463 bytes outside normal startup, so page/image allowlisting and quarantine resume in the first post-demo cleanup window. No route, page, image, or recoverable Velzon source is removed before the demo. A separately approved allowlist remains required when this feature resumes.
  - Scope: exclude one zero-reach page/image/reference group from active manifests and build graphs per independently reviewed micro-batch; keep recoverable Velzon source/assets until a later physical-deletion approval.
  - Preserve: approved shell branding, selected devtool references, license attribution, and recoverable history.
  - Acceptance: every batch has pre/post JS/CSS/asset reach, package effect, browser behavior, and bundle delta; no broad directory deletion.
  - Verification: static graph for each batch; user production build and normal/root browser check.
  - Non-goals: physical deletion, aesthetic rewrite, or quarantine based only on filename/text search.
  - Rollback: re-admit only the failed page/image batch and its exact imports to the isolated reference manifest.

### Root navigation, production ownership, portability, and CI (items 2, 7, and 9)

- [x] **F28 - Register normal-product, root-system, and developer-reference navigation areas.**
  - Depends: F13/F14/F15/F24A/F24B1/F25; D12.
  - Status: COMPLETE. On 2026-09-11 the user approved and accepted Product Admin first, an inert root-only System extension slot with paired English/Farsi catalog entries, and the existing root-only Developer Toolbox last. The active shell adapts clickable product navigation from the canonical manifest. The System slot has no route and therefore renders no header, link, or dead target; Developer Toolbox remains a separate lazy contribution. Typecheck, 43 files/199 tests except the known unrelated Quill timeout that passed immediately in isolation, lint, fixtures, ratchets, formatting, and a 10.44-second production build pass. The user accepted the focused admin/root sidebar behavior.
  - Scope: implement approved IA and typed extension slots without registering nonexistent product routes.
  - Preserve: normal admin product access, root product access, root-only system/devtool visibility, and backend authority.
  - Acceptance: future slots are metadata only; direct routes and menus use identical predicates; developer references never masquerade as system/product pages.
  - Verification: registry snapshots/tests and user admin/root browser matrix.
  - Non-goals: Phase 3 tenant/content/mobile/jobs pages or future-platform implementation.
  - Rollback: remove additive root-system registration; retain normal product and separately gated devtools.

- [ ] **F29 - Package and serve the approved SPA topology.**
  - Depends: F07A/F10/F11/F12/F13/F14/F15/F16/F21/F22/F23/F24A/F24B1/F24B2/F25/F26/F27A-F27I/F28; D01/D02/D03/D14.
  - Status: IMPLEMENTED; USER-RUN IMAGE/DEPLOYED-ORIGIN SMOKE AND F27I DISPOSITION PENDING. The user approved a standalone Node 24.19.0 build plus Nginx admin image on a separate origin. Compose passes Laravel `APP_URL` to Vite, while the browser continues using the typed credentialed API/Sanctum client. `/` and `/panel` redirect to `/panel/`; only canonical panel paths receive SPA fallback; missing assets and outside paths return 404; hashed assets receive immutable caching. Static delivery tests, full quality at 44 files/203 tests, and a 5.50-second local build pass. Every initial artifact URL is under `/panel/`, and toolbox chunks remain unpreloaded. No Docker image build/service startup or deployed-origin claim is made.
  - Scope: produce the standalone frontend artifact for the selected admin origin, define asset base/cache behavior and `/panel/*` history fallback on that static/admin host, and reconcile frontend environment documentation with `.env.production.example` plus the separate API origin.
  - Preserve: Laravel/API and Blade delivery unchanged and recoverable, credentialed cross-origin behavior, no whole-project bind mount, and no accidental mixing of root/admin Vite outputs.
  - Acceptance: no hard-coded credentials or external demo calls; selected lock-wide and production-reach gates pass, including retained root devtools; canonical admin-origin deep links/refresh/assets/404 work; CORS/header observability limits and static-host ownership are documented consistently.
  - Verification: lightweight route/config inspection; user runs the frontend production build and selected admin-host deployment smoke. Docker build/Compose is required only if a later explicitly approved delivery mechanism uses it.
  - Non-goals: Laravel/Nginx `/panel` fallback, container convergence for its own sake, workspace/package extraction, deleting Blade, production-readiness declaration, or Phase 8 release work.
  - Rollback: withdraw only the separate admin artifact/host mapping; Laravel/Blade remains the unaffected fallback product.

- [ ] **F30 - Prove a clean minimal module manifest.**
  - Depends: F29; D04/D15.
  - Scope: after the admin platform is stable, an internal neutral manifest supplies config, adapters, tokens, translations, shell, and zero/one fixture module without Checkupino or devtools; use a workspace only if this proof identifies a concrete need.
  - Preserve: production Checkupino manifest remains separate; Sanctum is its adapter rather than a universal core requirement.
  - Acceptance: core has declared dependency closure; no Checkupino URL/noun/page/data import; fixture boots neutral auth/error/form/table examples; no phantom package supplies success.
  - Verification: boundary/static tests; user performs clean minimal-manifest install, typecheck, test, and production build.
  - Non-goals: public npm package, second product, or cross-framework portability.
  - Rollback: remove the fixture without changing production registrations.

- [ ] **F31 - Document the portability and adoption contract.**
  - Depends: F30; D15.
  - Scope: supported runtime/packages, required vs peer deps, env/base path, adapter interfaces, tokens/fonts/i18n, manifest registration, extraction triggers/checklist, upgrades/security, and limitations.
  - Preserve: Checkupino-specific auth/routes/modules remain outside reusable core.
  - Acceptance: a reader can classify every dependency and directory as core, app adapter, Checkupino module, or optional devtool; commands match the clean fixture; concrete criteria say when an external fixture or workspace is worth its cost.
  - Verification: execute the adoption checklist against F30 and check all links/commands.
  - Non-goals: publication/version-support promise or Tailwind client app implementation.
  - Rollback: version the document and retain the last verified contract.

- [ ] **F31A - Prove one extraction-ready external consumer after the admin stabilizes.**
  - Depends: F29/F30/F31; D04/D15.
  - Scope: use the smallest mechanism justified by F30/F31 to consume the neutral core outside the Checkupino application boundary; prefer a disposable external fixture, and create a workspace package only when it materially simplifies dependency closure or adoption.
  - Preserve: internal manifest success, framework-neutral interfaces, exact dependency ownership, and no Checkupino routes/nouns/data in the consumer.
  - Acceptance: the external consumer resolves only declared dependencies and can typecheck/test/build from its own manifest; the selected extraction mechanism and why it was necessary are recorded.
  - Verification: boundary/static evidence; user performs the clean external install, typecheck, test, and production build.
  - Non-goals: public npm publication, semver/support promise, a second product, or forcing the future client UI onto Bootstrap.
  - Rollback: remove the external fixture/workspace wiring without changing the proven internal core contracts; keep F31A open.

- [ ] **F32A - Freeze the CI, security-exception, browser, and bundle policy details.**
  - Depends: F29/F30/F31/F31A; D14.
  - Scope: obtain explicit user choices for CI provider, blocking versus informational jobs, lock-wide severity threshold, production-reach timing, exception owner/evidence/expiry, browser-run owner, cache/secrets model, and initial regression/bundle thresholds based on the first clean artifact.
  - Preserve: option A first and option C before Phase 2 closure, user ownership of heavy commands, and no credentials/workflow writes before approval.
  - Acceptance: every policy field has an owner and objective pass/fail rule; byte thresholds derive from a recorded clean baseline rather than the historical build.
  - Verification: user review of the compact policy matrix against local gate evidence.
  - Non-goals: workflow implementation, provider account changes, secrets, deployment, or Docker execution.
  - Rollback: revert only the policy record and keep F32 blocked.

- [ ] **F32 - Add approved CI jobs after local gates are stable.**
  - Depends: F32A; D14.
  - Scope: provider workflow for approved runtime, lock install, typecheck, lint/format, unit tests, boundary/import checks, audit, build, and optional browser/bundle gates.
  - Preserve: user ownership of heavy local/Docker commands; Laravel CI remains separate unless explicitly composed.
  - Acceptance: blocking vs informational jobs, cache keys, secrets, advisory exceptions/expiry, browser ownership, and bundle thresholds are explicit; no flaky unowned gate.
  - Verification: workflow validation and an actual provider run using user-approved credentials/resources.
  - Non-goals: Docker build/Compose in Codex, deployment, or Phase 8 release automation.
  - Rollback: disable only a defective new job with a named issue and deadline; never silently erase an accepted invariant.

- [ ] **F33 - Close the Phase 2 evidence gate and reconcile documentation.**
  - Depends: F01-F26, F07A, F15A, F27A-F27I, F28-F31A, F32A-F32, or an explicitly user-approved equivalent path that closes all nine roadmap items with the same contract and evidence gates.
  - Scope: collect command output, backend/browser matrices, graphs, audit, bundle baselines, portability proof, deployment smoke, and rollback status; update the smallest durable docs.
  - Preserve: historical evidence and unchecked roadmap items until their own gates pass.
  - Acceptance: each of the nine Phase 2 items links to current evidence; stale fake-helper/RTL/build/topology claims are corrected; no static inference is presented as runtime proof.
  - Verification: evidence review by the user; `docs/TODO.md` changes only after its gates pass.
  - Non-goals: Phase 3 or production-readiness declaration.
  - Rollback: reopen only the failed item with its last known-good evidence; Phase 1 remains closed unless a real regression appears.

## Strong Anti-Drift Guardrails

- Backend policy, role, ownership, tenant, lifecycle, public-ID, PII, safe-resource, medical, payment, booking, reason, step-up, audit, transaction, and privacy rules are authoritative and non-negotiable.
- Client route/menu/capability visibility is UX only. Do not infer permissions or verification state absent from `/api/auth/me`.
- First-party browser auth is session-cookie Sanctum. Never persist bearer/access/refresh tokens in localStorage, sessionStorage, Redux persistence, IndexedDB, URLs, logs, analytics, or error reports.
- Preserve web CSRF/login/logout and API `/me`; never swap browser logout for token logout.
- Auth invalidation is code-sensitive: clear on 401, explicit inactive code, and every logout attempt/failure; never turn an ordinary 403 into logout.
- Preserve 419 recovery, 422 field/domain errors, 423 step-up, 429 backoff, and 204 no-body semantics. Do not globally coerce wire responses.
- List behavior and numeric/public route identifiers are endpoint-specific. Generic adapters cannot invent filters, pagination, safe fields, or route bindings.
- Correlation-header access is optional across origins until CORS or deployment makes it readable. Do not promise support IDs that browser code cannot observe.
- Checkupino delivery is a separate admin origin with canonical `/panel/*`; route records are relative to one `/panel` basename. Do not add Laravel/Nginx history fallback, same-origin assumptions, compatibility aliases, or absolute duplicate panel paths without a new decision.
- Only the transport adapter may import the HTTP implementation or read backend-origin config. Only the registry defines navigable paths. Only manifests register modules.
- Core imports only core/vendor contracts. Checkupino modules import core public APIs. Optional devtools import core and isolated demo code. Reverse imports fail the boundary gate.
- No Checkupino business noun, API route, role-specific page, or backend-specific session mechanism belongs in reusable core; those enter through typed adapters/modules.
- TypeScript 7 plus `tsc --noEmit` is authoritative. Do not restore `baseUrl`, add ESLint/`typescript-eslint`, treat Oxlint's experimental type-check output as the compiler gate, or use unsupported parser suppression to make a gate green.
- No new ambient declaration, increased `any`, relaxed TypeScript strictness, undeclared/transitive runtime import, case-wrong import, or suppressed error may be used to make a gate green. Oxlint parity gaps stay covered by explicit rule fixtures and dependency/boundary checks.
- No production SPA packaging while hard-coded credentials, Themesbrand network calls, fake product data, vulnerable product-reachable Swiper, demo reducers, or eager devtool menu/state remain in the normal graph.
- Lazy page JavaScript alone never proves isolation. Prove JavaScript, CSS, state, locales, fonts, assets, external origins, and package reach from a fresh build.
- One concern and one dependency family per change. Manifest and lockfile changes are reviewed and rolled back together. Do not add a phantom dependency merely to keep an unapproved demo page alive.
- One HTTP implementation, one auth authority, RTK Query server state, one slim Redux client store, React Hook Form/Zod, TanStack Table v9, one toast surface, and one route registry are the targets. Temporary dual stacks require a named removal feature and expiry.
- The original Velzon design, logos, assets, DOM/component composition, classes, controls, and placements are frozen visual baselines. Backend, Vite, auth, role, data, and translation integration must adapt to them. Any visual/composition change requires explicit approval before editing.
- Keep Velzon source/assets recoverable and active until customization is finished. Do not delete or substitute template inventory without reachability evidence, an approved completed replacement, and a separate deletion/quarantine decision.
- Multilingual-first means every existing or newly touched screen/shell word uses complete Persian/English translation keys without changing the Velzon composition. The existing flag selector owns language and language exclusively owns `dir`. This requirement is continuous and cannot be deferred with visual RTL work. Class-level RTL geometry remediation is reserved for final demo stabilization: record physical `m*`/`p*`, float, alignment, positioning, and custom-selector defects during implementation, but do not bulk-rewrite them. Bootstrap RTL generation versus a bounded custom override layer remains an approval-gated final-pass decision.
- Keep the admin surface Bootstrap-oriented. Do not pull the future public/client Tailwind architecture into Phase 2.
- Blade remains packaged and recoverable until an explicit cutover. Never shadow its routes, API, Sanctum, or assets accidentally.
- Container convergence and workspace packaging are not default Phase 2 work. Add either only when the selected separate-origin delivery or portability proof demonstrates a concrete need.
- Lock-wide audit evidence comes first; production-reach evidence joins it after the first clean isolated build. No CI workflow may be written before F32A approves provider, thresholds, exception ownership/expiry, and browser ownership.
- No audit-history API, permissions API, upload flow, root record visibility, or backend normalization project is invented to simplify a Phase 2 primitive.
- No Phase 3 domain screen, tenant/content/commerce/mobile/medical workflow, or future-platform route begins in Phase 2.
- No type/build/test/browser/bundle/security/CI/portability checkbox is closed from source inspection alone.
- The user runs clean/install work, genuinely long commands, and all Docker build/Compose verification. Codex may run the already-installed frontend quality/build commands while their measured runtime remains short; request manual evidence only when environment ownership or a material browser behavior makes it necessary.
- After each approved slice, update `CURRENT_TASK.md` with actual evidence and rollback status. Update `admin-panel.md` only for durable verified facts, architecture docs only for accepted decisions, and `docs/TODO.md` only after evidence gates pass.

## Next Action

Begin Phase 3A with a bounded marketplace-user administration slice: add the canonical product route/navigation entry and a real API-backed user directory using the existing typed RTK Query, server table, auth capability, feedback, and localization boundaries. Preserve Velzon composition and defer broad RTL styling to demo-delivery item 11.

F27A-F27F are complete. The F27F implementation checkpoint (2026-09-05) passes full quality at 42 test files/196 tests, a 5.50-second production build, and a production npm audit with zero findings. On 2026-09-07 the user confirmed both pending browser checks: all `/panel/dev/charts-echarts` charts render without blanks, displaced labels, overlaps, or console errors; `/panel/dev/landing` follows scrolling with the active navbar item and its links reach the correct sections. Reuse that evidence; the installed dependency state does not need another install.

F27G, F27H, and F28 are complete with user-confirmed styling, typography, icon, console, and navigation behavior. Keep the ordered lazy toolbox entry, ECharts adapter ownership, 11-source WOFF2-only active graph, manifest-driven product navigation, and inert root-only System slot. F27I is explicitly deferred until 2026-09-21; its separately approved page/image allowlist and external-demo-helper disposition remain required then. F29's approved standalone admin image/fallback implementation is ready for the user-owned Docker image and deployed-origin smoke, but it cannot close before that evidence and F27I. F30-F32 remain blocked by F29 and retain portability, extraction, and CI gates.

F18 remains implemented, deliberately unmounted, and non-blocking until a genuine approved product consumer needs it. Do not introduce a harness, replace the customizer, or alter the Velzon shell to obtain its browser proof.

F22's technical integration is complete. Preserve original Velzon composition and paired English/Farsi text with language-owned direction. Record class-level RTL defects for the final demo stabilization pass; do not repair them now. Root-only retained Developer Toolbox pages remain static fake demos, and `/logout` remains unregistered with controlled JSON POST logout.

The existing dirty worktree is preserved. The approved ECharts batch changes two import sites and the existing quality ratchet, with reconciled documentation; the original stylesheet and package/lock remain unchanged. Local `/me` cold latency stays deferred. No Phase 3, dependency-policy, root-navigation, CI, portability, container, or deployment work begins without its named approval.
