# Demo Quality And Performance Checkpoint

Date: 2026-10-02. Scope: Phase 2 item 1 local quality/build, then item 8 presentation startup/performance. Current presentation paths are login/logout and the real users directory/create/edit. This does not close CI, portability, quarantine, the wider business walkthrough or final visual acceptance.

## Item 1: Local Gate Complete

- Windows, Node 24.19.0, npm 11.17.0; all 93 installed direct dependencies match the lockfile. No reinstall, dependency update or new package.
- `npm.cmd run quality` passes: strict typecheck, 47 test files/234 tests, lint, quality fixtures, ratchets and formatting. Test duration: 14.57 seconds. Existing debt baselines remain 2,515 `any` tokens, 10 ambient shims, 40 retained Apex consumers and zero undeclared runtime families.
- The initial suite hit the existing Quill five-second import deadline under unconstrained jsdom concurrency. Quill passed in isolation; the full suite passed with four workers. `vite.config.ts` now caps workers at four. Assertions and the five-second deadline are unchanged.
- Production build passes in 7.30 seconds using `VITE_BACKEND_URL=http://localhost:8080`, empty `VITE_API_BASE_URL`, default `fa` and fallback `en`. Main entry: 390,036 bytes; main CSS: 1,002,953 bytes. Reference Node gzip is 104,911 and 158,135 bytes respectively. Reference compression is not HTTP delivery evidence.
- Package SHA-256: `a13dfca5a496e36b337e08e3fa42da963468e34cb9c337a32f092a128b23d6fe`. Lock SHA-256: `a274787f98ccd6f42244066ca760faf7977922572d323d3a0b8860842fdde895`.
- Existing served image: `sha256:a2cc2e6a9b4d8ab853ff0fdd24b3660dda88d48f0c45460a1e2c930e2d8cc130`; entry `index-DK8K0eNp.js`, directory `UserDirectory-BSZm_JEG.js`. Directory source matches the fresh local build after platform-specific imported hashes are normalized. This is source comparison, not a claim that Windows/Linux build bytes are identical.
- User restarted the existing development backend services. Backend health returns 200; DB select, configured Redis ping, and PHP-FPM-user cache/log writeability pass. No live migration, reseed or credential change.

Approved CI execution remains open in the full Phase 2 gate. Item 1 is complete for the local demo scope; any later source changes require affected checks again.

## Item 8: Deployed Baseline

Chrome 154.0.8037.93, headless, 1440 x 1000, no CPU/network throttling, same machine and localhost Docker origins. Host exposes 16 logical processors and about 31 GiB RAM. Browser-cache-cold navigations disable and clear the browser cache; backend services remain running. These are not fresh-container cold starts. Ten warm samples per API/interaction and three samples after 15 seconds idle. UI sampling resolution is about 25 ms. Only reads and editor cancellation; no new business records.

| Measurement | Samples | Median ms | Maximum ms |
| --- | ---: | ---: | ---: |
| Authenticated browser-cache-cold directory | 3 | 2,425.7 | 4,971.5 |
| Warm `/api/auth/me` | 10 | 79.3 | 1,137.8 |
| Warm users list | 10 | 89.3 | 1,200.4 |
| Search including debounce | 10 | 935.7 | 1,563.8 |
| Role filter | 10 | 110.3 | 1,168.9 |
| Pagination | 10 | 110.0 | 1,168.2 |
| Open full editor, then cancel | 10 | 134.9 | 1,226.6 |
| `/me` after 15 seconds idle | 3 | 1,615.6 | 1,962.6 |

Single login page readiness: 132.9 ms; login-to-fixture-home: 2,913.2 ms. These are single observations, not repeated acceptance statistics. The fixture home remains reference content and is not product reporting.

No unexpected HTTP failures, uncaught exceptions, external-origin requests or toolbox requests in the measured users path. Cold directory navigations each perform one `/me` and one users list request. Ten editor opens each make one detail read. Search and pagination each make ten list requests; filtering makes eleven (ten measured changes plus one explicit reset before pagination). No repeated request excess was observed. [Recorded samples and request graph](evidence/demo-performance-baseline-2026-10-02.json) contain no credentials or response bodies. Even-sample medians use the mean of the two middle values.

Actual static responses have no `Content-Encoding`, even when gzip is requested. The served main CSS is 1,000,091 body bytes; reference gzip is 158,075 bytes (84.2% smaller). The 14 initial HTML script/preload/CSS bodies total about 1.67 MB uncompressed. Cold directory CDP transfer totals include response headers: JS 907,913 bytes, CSS 1,014,690 bytes, all assets 3,761,019 bytes. Existing fonts, logos and customizer preview images are retained; no asset deletion is inferred.

Slow warm/post-idle API samples spend almost all their time before the first byte, while directory cold responses also show browser scheduling delay between headers and completion. Windows bind-mounted dependencies and enabled OPcache timestamp revalidation are consistent with the previously observed backend pattern; causation is not established by this sample. Compression cannot be claimed to fix that server delay. Source freshness and auth controls remain enabled.

## Budgets Recorded Before The Compression Change

These are local presentation acceptance limits based on the observed machine/runtime, not public production SLOs. The payload target requires a material delivery improvement; latency limits protect the already usable baseline from regressions. Record median and maximum rather than a percentile from these small samples.

| Check | Candidate limit |
| --- | --- |
| Initial HTML-linked JS/CSS body bytes with gzip | At most 425 KiB combined; main CSS at most 170 KiB |
| Browser-cache-cold directory, 3 samples | Median at most 2,500 ms; maximum at most 5,000 ms |
| Warm me/users API, 10 each | Median at most 150 ms; maximum at most 1,500 ms |
| Search including debounce, 10 | Median at most 1,000 ms; maximum at most 1,800 ms |
| Filter/page/editor, 10 each | Median at most 200 ms; maximum at most 1,500 ms |
| Me after 15 seconds idle, 3 | Maximum at most 2,200 ms; report residual delay explicitly |
| Request isolation/reliability | No external template backend, toolbox startup, uncaught exceptions or unexpected failures |

If a candidate exceeds a limit, report it as open instead of widening the limit after the result. Warm up login and the users route before presenting; keep services running. A cold backend boot has not been accepted against these limits.

## Bounded Fix And Pending Deployment

Enable gzip and `Vary: Accept-Encoding` in the standalone static admin Nginx config for compressible text assets. Keep immutable hashed-asset caching, uncompressed-client delivery, origin-preserving redirects and missing-asset 404s. This static service has no private API proxy. No frontend UI, dependency, backend tuning or topology change is required.

Compression is implemented in `frontend/nginx/default.conf`. A temporary loopback-only Nginx listener inside the existing admin container tests the candidate configuration without replacing the running service/config: syntax passes; gzip CSS is 158,463 bytes versus 1,000,091 identity bytes (84.2% smaller); decompressed bytes match exactly; `Vary`, immutable caching and CSS MIME type are present. The temporary listener/files are removed. Existing delivery contract tests pass, four tests. Product JS/CSS source is unchanged, so the production build above remains applicable.

## Compression Deployment And Auth Follow-Up

The user rebuilt/recreated admin. Image `sha256:4356632af0bc24e7ba99c4cf9b8f6c7cc727eec78dd336472645eb554ce506e0` is healthy. Public gzip/identity body equality, Vary on compressed responses, immutable caching, redirects, deep links and missing-asset/outside-path 404s pass. Initial HTML-linked JS/CSS bodies fall from 1,673,075 to 362,066 bytes (78.4%); main CSS is 158,463 bytes (84.2% smaller). Both payload budgets pass. Small files below 1,024 bytes intentionally remain identity responses. [Public static evidence](evidence/demo-static-compression-2026-10-02.json).

The first immediate-submit browser run received login HTTP 419. Source inspection found login could overlap the initial `/me` session probe, allowing concurrent session-cookie responses and a late guest snapshot. Login now waits for the pending probe before CSRF/login begins. Two deterministic regression cases reproduce the previous unsafe ordering and pass with the fix, including a normal 401 and a recoverable 503 bootstrap. No automatic credential retry, cookie bypass or auth weakening.

A repeated compression-only browser run completes without HTTP/JS/external/toolbox failures, but its filter maximum is 6,680.6 ms, exceeding the fixed 1,500 ms budget. A focused Vitest process overlapped this measurement; causation is not proven. The slow request spent 3,705.2 ms before headers and 6,652.9 ms total. Other metrics and [raw intermediate samples](evidence/demo-performance-compression-check-2026-10-02.json) are retained; this run is not accepted as a timing pass. Budgets remain unchanged.

After the auth fix, all quality gates pass again: 47 files/236 tests, test duration 14.84 seconds; production build passes in 5.43 seconds with the same demo origin/locale configuration and unchanged packages/lock. This supersedes the initial source checkpoint above for the final candidate. Product markup/design, dependencies, backend and topology remain unchanged.

## Auth Deployment And GET Transport Follow-Up

User rebuilt/recreated admin again. Image `sha256:896d43c22c22464ab711cf14dbb48ba7576258db10d2e3156402c14f375a44f9`, entry `index-Cff9Dd6z.js`, authority `authority-BEc4NCLx.js`: served authority contains the bootstrap wait and intended API origin. Compression/delivery budgets pass (362,078 initial linked bytes). Isolated browser run has no unexpected HTTP/JS/external/toolbox failures, and its timeline confirms the initial 401 completes before CSRF starts.

Directory cold median/maximum are 1,793.5/2,317.2 ms; all measured limits pass except search (1,069.8/2,123.1 ms versus 1,000/1,800). [Raw auth-candidate samples](evidence/demo-performance-auth-check-2026-10-02.json) retain this failed search result. First search request totals 1,741.1 ms with 598.6 ms GET TTFB, consistent with an additional preflight round trip. Initial login-to-home also takes 12,299.4 ms in this run; do not present warm-route budgets as a cold-login guarantee.

Source transport adds X-Requested-With and X-XSRF-TOKEN to every GET. Those non-simple headers require browser CORS preflight on a new query URL; the live CORS max-age is already 600 seconds, so increasing it is not the fix. The bounded follow-up removes those headers from GETs while preserving credentials and JSON Accept. POST/PUT/PATCH/DELETE retain CSRF and XHR headers. Backend CORS/policies/session configuration, query cancellation, debounce and UI are unchanged.

An actual Axios XMLHttpRequest adapter regression captures outgoing headers: it fails before the change and passes after, checking credentialed GET and CSRF for all four write methods. Full quality passes again, 47 files/237 tests (14.69 seconds); production build passes in 5.47 seconds. Package/lock and ratchets remain unchanged.

## GET Deployment And Search Wait Follow-Up

The user rebuilt admin successfully. Image `sha256:f5b66338f385e56020923b789429f8d4b45e105efa8e5baa0e7da724d12e0144` serves `index-C1IkLzzv.js` and `authority-D18TSheZ.js`; served authority bytes exactly match the tested local build. Public delivery still passes, 362,094 initial linked compressed bytes.

Actual browser GETs omit the custom XHR/XSRF headers and require no preflight. Only login/logout POST preflights remain; actual writes carry CSRF headers and cookie-auth login/me/logout pass. No unexpected HTTP/JS/external/toolbox requests. Search median improves to 648.3 ms, but its 1,836.1 ms maximum exceeds the unchanged 1,800 ms limit. Other budgets pass. [Recorded GET-candidate samples](evidence/demo-performance-get-check-2026-10-02.json) retain this failure. Cold login-to-home is still 12,322.4 ms, outside any claimed cold-login acceptance.

Directory search currently adds 350 ms debounce to API time. A 1,500 ms permitted API response plus that wait and rendering cannot reliably fit the 1,800 ms interaction limit. Set the existing table's debounce to 250 ms only for this directory, retaining keystroke batching, stale-commit cancellation and the shared default for other consumers. No markup/control/API/backend change. Full quality passes, 47 files/237 tests (14.75 seconds), and production build passes in 5.40 seconds; no new tests are needed for this parameter change because the existing table/directory contracts already exercise debounce, cancellation and URL-owned search.

## Final Deployed Candidate And Accepted Local-Demo Exception

User rebuilt/recreated admin. Image `sha256:ad7a4d74d1d77bb318a3ded4d6673dd30001ff69c47f9181fd55d7908209a622` is healthy. Entry `index-DGxiZEtU.js`, authority `authority-D18TSheZ.js`, directory `UserDirectory-F3imv9w6.js`. Authority bytes match the local tested build; directory matches after imported platform-specific hashes are normalized and contains the 250 ms setting. [Static candidate evidence](evidence/demo-static-candidate-2026-10-02.json).

Initial linked JS/CSS is 362,103 bytes (78.4% smaller than baseline); CSS is 158,463 bytes (84.2% smaller). Compressed/identity body equality, Vary, immutable caching, redirects/deep links/assets/404s, intended localhost API origin and real session login/me/logout pass. Actual reads have no preflights; only login/logout POST preflights remain, with CSRF headers. No new business records or unexpected HTTP/JS/external/toolbox failures.

The first final-candidate run passes search (466.2/1,769.6 ms), but warm me maximum is 1,532.1 ms against 1,500. A single follow-up explicitly awaits post-locale fonts/images before warm samples; they were already loaded, so that startup explanation is ruled out for the follow-up. Warm me maximum is 1,551.3 ms; keep this backend/runtime tail open rather than repeating until a favorable sample. [First run](evidence/demo-performance-debounce-check-2026-10-02.json), [follow-up samples](evidence/demo-performance-candidate-2026-10-02.json).

| Follow-up measurement | Samples | Median ms | Maximum ms | Fixed budget |
| --- | ---: | ---: | ---: | --- |
| Browser-cache-cold directory | 3 | 2,347.9 | 2,636.3 | Pass |
| Warm me API | 10 | 81.1 | 1,551.3 | **Target missed by 51.3 ms; user accepted local-demo exception** |
| Warm users API | 10 | 83.6 | 1,469.1 | Pass |
| Search including debounce | 10 | 461.3 | 1,718.0 | Pass |
| Role filter | 10 | 109.3 | 1,464.2 | Pass |
| Pagination | 10 | 109.8 | 1,453.5 | Pass |
| Full editor open/cancel | 10 | 107.4 | 1,492.1 | Pass |
| Me after 15 seconds idle | 3 | 1,593.4 | 1,628.0 | Pass |

Cold login-to-fixture-home remains slow: 12,406.9 ms in the follow-up. The budgets above cover the selected directory presentation with services running, not cold backend/login startup. Warm up login and users before presenting. This limitation remains visible; the fixture home is not product reporting, and no public production performance guarantee is made.

At closeout the user explicitly chose: "Accept the documented local-demo exception and warm-up requirement; close item 8's demo scope." The 1,500 ms target remains unchanged and the measured overrun stays visible; this is an accepted exception, not a claim that the strict target passed. The exception applies to this local presentation candidate and requires warming up login/users before presenting. It does not approve disabling source freshness or waive future business-flow, production or visual acceptance.

A read-only private PHP-FPM probe as www-data confirms OPcache enabled, timestamp validation enabled with a two-second interval, about 28.3 MiB used of 128 MiB, 99.67% hit rate, no cache-full state and no restart/memory pressure. Its temporary script was outside the public document root and removed; no PHP setting, backend source, cache reset or topology changed. This rules out an exhausted opcode cache as a reason to increase memory, while filesystem/revalidation timing remains a hypothesis rather than a proven cause.

Status: **item 1 local gate complete; item 8 demo scope complete with the explicit local-runtime exception and warm-up requirement**. All implemented fixes are deployed/source verified. No rebuild or additional source work is pending for these items. Full CI/portability/F27I and wider business/visual release acceptance remain open.

Earlier functional/security acceptance: [runtime](demo-runtime-acceptance-2026-10-01.md) and [user mutations](demo-user-mutations-acceptance-2026-10-01.md). Release scope/order: [demo release plan](demo-release-plan-2026-10-02.md).
