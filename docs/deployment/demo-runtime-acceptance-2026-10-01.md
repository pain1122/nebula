# Local Demo Runtime And User Directory Acceptance

Date: 2026-10-01 (Asia/Tehran). This record describes the existing local Docker demo, not production readiness or completed Phase 3 release scope.

## Runtime Ownership And Recovery

- Development project `checkupino`: existing app/nginx/MySQL/Redis, workspace bind mount and existing DB volume.
- Production project `checkupino_prod`: standalone compiled admin only. The user ran service/project-scoped start/build/recreate commands; no competing production backend was started.
- Browser identity: `http://localhost:3000/panel/`; backend origin: `http://localhost:8080`.
- Initial backend shutdowns were orderly, with zero restarts. The static admin's September 11 image and health flag did not establish application freshness or backend health.
- Development PHP lacked the configured phpredis extension. The Dockerfile now installs/enables it, mirroring the existing production image; the user rebuilt/recreated app and restarted nginx. No application dependency or runtime-version policy changed.
- The separate hazelnut2.0 stack and reserved port 18080 were not operated on. Existing dirty files and all volumes/data were preserved; no install, migration, reset, prune, or reseed was run.

## Static Serving: Passed

| Request | Result |
| --- | --- |
| `/healthz` | 200; static Nginx health only |
| `/` and `/panel` | 308 with relative `Location: /panel/`, retaining browser-facing port 3000 |
| `/panel/`, `/panel/login`, `/panel/users` | 200 HTML |
| `/panel/dev/pages-starter` | 200 SPA fallback; root authorization independently verified in the browser |
| Emitted hashed directory/transport assets | 200 with immutable one-year caching |
| Missing `/panel/assets/*.js`, missing static `.ico`, outside-panel path | 404 |

The original Nginx absolute redirects lost host port 3000. `absolute_redirect off` fixes this without changing topology or canonical paths; live headers and `nginx -t` pass after recreation.

## Backend Health: Passed

- Laravel `/healthz`: 200, maintenance disabled.
- Live database `SELECT 1`: succeeds; migration status shows all existing migrations applied.
- Redis service PING and Laravel configured Redis connection PING: succeed after the PHP extension repair.
- Composer platform requirements: pass; installed packages match composer.lock. Frontend installed package versions also match its lock.
- Laravel config/routes/events/views are not cached; no cache clear was necessary.
- Backend app and static admin are running with zero restart counts. Health/status does not replace the functional checks below.
- No queue worker or scheduler is required for this read-only synchronous directory flow. Existing schedules enqueue hold expiry every minute and slot materialization daily; booking/asynchronous flows still require execution verification.

## Artifact Freshness And API Origin: Passed

- The user rebuilt/recreated only admin after the directory and final cache-security change.
- Final admin image: `sha256:9a51ef7e6a7b7d00dc43f30b7d11ea01247f82b2e4e21e4ad4682e8deb7440e8`.
- Final served entry: `index-CUiCD0xu.js`; SHA-256 `4b3717014938c2010b07881015eaae5bba8773035f32fa5d6c5c07becc709184`. It includes auth identity/role query-cache clearing.
- Final served directory: `UserDirectory-DsUfNNqZ.js`. Its emitted code matches the current local workspace build after normalizing imported chunk hashes; host/Linux artifacts are not claimed byte-identical as a whole.
- Served transport compiles `http://localhost:8080`. Its source/config match the Docker-equivalent local build; browser traffic targets this origin and does not mix localhost/127.0.0.1.
- Directory/toolbox code is absent from initial preload. The home retains ecommerce fixtures and is not counted as Checkupino reporting.

## Functional Acceptance: Passed For This Slice

Live HTTP session checks for both root-admin and admin:

- CSRF cookie 204; deliberately invalid XSRF token rejected with 419.
- JSON login 200; `/api/auth/me` 200 with the expected role.
- Real user directory 200 with server pagination; root records excluded. Normal-admin results exclude admin identities and `role=admin` is rejected with 403; root may use that filter.
- Credentialed CORS returns `http://localhost:3000` and credentials allowed.
- Controlled JSON POST logout 200, followed by `/me` 401.

Real headless Chrome acceptance uses the actual compiled artifact and login form:

- Root login; real user rows; Farsi labels/RTL; existing flag switches to English labels/LTR.
- Root admin-role filter persists through a deep-link refresh; server search returns the translated empty state without fixture fallback.
- Root-only lazy toolbox deep link renders; normal admin cannot enter it. Normal admin sees the directory without privileged role filters; guest deep links return to login.
- Root logout, admin login and directory entry occur in the same tab/app without a reload between accounts, exercising the deployed session-cache boundary.
- Both controlled logout requests are acknowledged by the server before the next login; no uncaught browser exceptions occur.
- API requests for CSRF/login/me/users/logout are observed against the intended backend.

## Source Verification: Passed

- Final `npm.cmd run quality`: 46 files/218 tests, strict typecheck, lint, fixtures, ratchets and formatting pass.
- Dedicated new page/store/registry lint and formatting pass; `git diff --check` passes.
- Final production build: 5.45 seconds, using Docker-equivalent origin/locale arguments. Existing Sass/toolbox chunk/browser-data warnings remain unchanged.
- An earlier full run hit the historically known Quill five-second timeout. It passed in isolation and the final full run; no timeout policy was relaxed.
- Tests cover translated real-transport rendering, URL search/filter/sort/pagination/back behavior, privileged URL filtering, loading/empty/error/retry, route/menu access, and cache clearing on logout/account/role changes.

## Open Work And Release Limits

User create/edit with genuine overlay consumers subsequently passed deployed acceptance on October 2; see `demo-user-mutations-acceptance-2026-10-01.md` for the new artifact and runtime permissions repair. Root-admin account-state controls are next. Broad RTL styling, final cross-surface translation review, the full golden flow, catalog write API decisions, sandbox checkout/callback, medical screens/scan adapter, production TLS/backup, and parked Phase 2 quarantine/portability/CI/performance remain open. F29's remaining requirements are not closed by this local smoke. The full roadmap is preserved in docs/TODO.md; its smaller golden-flow proposal requires a scope decision before release requirements change.
