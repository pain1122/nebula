# Project Map - Checkupino (Nebula)

Snapshot date: 2026-10-24

## Fast Context For Agents

Current checkpoint: editorial media source/UI accepted on e03d9719/44 assets; real library migration/flags still disabled pending the existing activation gate. See CURRENT_TASK.md and docs/deployment/article-file-manager-2026-10-24.md. Older figures below are historical.

Always remember:
- Laravel 12 + Docker.
- Blade is still active runtime.
- React admin is target but not canonical yet.
- `frontend/` is an active Velzon Vite workspace with Sanctum session auth and an API-backed marketplace user directory under `/panel/users`; the home retains ecommerce fixtures and is not product reporting.
- Spatie roles are the only authority source.
- `users.role` does not exist anymore.
- Current runtime roles: `root-admin`, `admin`, `doctor`, and `patient`.
- Booking uses recurring doctor rules with durations/breaks, persistent dated public-ID slots, server-owned price snapshots, slot/day/week doctor controls, locked conflict rechecks, throttled active-hold caps, scheduled/synchronous hold expiry, and history-preserving same-offering rescheduling.
- Phase 1A-1E and their documentation gates are complete and validated. Phase 2 F00-F17, F19-F24A, F24B1, F25-F26, F27A-F27H, and F28 are complete; F18 is implemented, explicitly deferred, and non-blocking. F22 preserves the original Velzon design with paired English/Farsi labels and language-owned direction; class-level RTL debt belongs to final demo stabilization. F23/F24B1 isolate toolbox pages, route/menu inventories, and demo reducers behind root-only lazy boundaries. F25 completes exact Router 7.18.3 and canonical `/panel` behavior with user-confirmed role/logout checks. F27G moves retained demo styles behind the lazy toolbox entry; F27H reduces emitted fonts to 11 WOFF2 files/1,135,684 bytes and keeps only `en`/`fa` in the locale graph. The user-confirmed browser matrix passes on 2026-09-11. F28 drives product navigation from the manifest, keeps an inert root-only System slot, and leaves the lazy Developer Toolbox last; the user accepted the focused sidebar behavior. The latest build passes in 10.44 seconds and the unchanged dependency lock retains its prior zero-finding production audit. F27I remains gated.
- Do not load `frontend/public/assets`, `vendor`, or `node_modules`.

## 1) Project Reality

Checkupino is currently a Laravel 12 medical platform with a stable backend foundation and a frontend transition in progress.

Current primary runtime:
- Blade + Laravel Vite for server-rendered web pages.
- Sanctum API routes for auth, booking, profiles, admin, doctor, and questionnaires.
- Docker local environment with Nginx, PHP-FPM, MySQL, and Redis.

Target UI direction:
- Authenticated admin, doctor and patient versions: existing Velzon React + Bootstrap under `/panel/*`, with role-specific access, per the October 4 user decision.
- Public SEO/subscription web app: later React + Tailwind work, excluded from the demo.
- New admin screen/shell elements with user-facing words use shared translation keys and ship with complete Persian and English values. Reusable primitives may own typed paired catalogs behind an explicit locale contract. Language owns direction (`fa` -> RTL, `en` -> LTR), with no separate direction setting. Persian uses standard RTL conversion, not bespoke RTL behavior; both RTL and LTR must be visually verified with the selected product shell. Documentation and logs remain English.
- Current `frontend/` folder is a Vite-powered Velzon React-TS admin shell with working Sanctum session auth and root-admin developer routes isolated under `/panel/dev/*`; it is not yet the canonical production admin.

Core implemented domains:
- Auth + roles: Breeze + Sanctum + Spatie Permission.
- First-party browser SPA auth: Sanctum session/cookie flow is wired in `frontend/`.
- Role authority: Spatie only. `users.role` has been removed from the active schema.
- Patient/lead model: unknown public submitters become `leads`; registered patients are users with the `patient` Spatie role.
- Booking/payment: marketplace hospitals, doctor workplaces, recurring service rules/breaks, persistent visit slots, slot/day/week controls, slot-ID booking/rescheduling, reservation snapshots/history, one payment summary with repeated attempts, verified callback decisions, adjustments, canonical-success locking, reconciliation, and expiring holds.
- Platform foundation: typed scoped settings, signed entitlements, audited marketplace tenant controls, signed sanitized heartbeats, provider-neutral integrations, recoverable outbox dispatch, monitoring-only tenant instances, and a separate minimal tenant schema/profile/authority/entitlement foundation.
- Storage/API foundation: separated public media and private quarantined reservation files, explicit API resources/form requests, version/correlation metadata, capped pagination, and PII-safe representative contracts.
- Admin CRUD: specialties, checkup categories, checkups, users, reservations, questionnaires.
- Doctor profile/services.
- Medical user profile via `user_profiles`.
- Questionnaire API + server-owned validation/scoring, sanitized definitions/recommendations, throttled public submission, and lead capture.
- Medical workflow: doctor requests/review, patient private quarantined uploads, internal scan state, immutable published reports/amendments, and authorized patient outcome/file reads.
- High-authority controls: root-admin identity/account authority, recent-password step-up, reasoned transactional audit, doctor verification, catalog/questionnaire/tenant/reservation/payment-adjustment boundaries, and a fixed privileged-route regression inventory.

## 2) High-Signal Paths (Load First)

- `AI_BOOT.md`
- `CODEX_RULES.md`
- `CURRENT_TASK.md`
- `docs/ai-context/modules/*.md` for the active domain only
- `docs/TODO.md`
- `README.md`
- `docs/PROJECT_MAP.md`
- `docs/adr/ADR-0001-ui-auth-role-architecture.md`
- `docs/architecture/boundaries.md`
- `docs/architecture/phase-1d-future-feature-extension-contract.md` when later content, commerce, mobile, tenant-site, report/file, or notification boundaries are relevant
- `docs/deployment/docker-production.md`
- `routes/web.php`
- `routes/api.php`
- `routes/admin.php`
- `routes/doctor.php`
- `app/Enums/UserRole.php`
- `app/Http/Controllers/`
- `app/Models/`
- `app/Policies/`
- `app/Services/SchedulingService.php`
- `database/migrations/`
- `database/seeders/`
- `tests/TestCase.php`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `docker/prod/Dockerfile`

## 3) Low-Signal / Heavy Paths (Skip by Default)

These are the main context-window sinks:
- `frontend/public/assets/` and other vendored template assets.
- `frontend/src/pages/` when not working on the frontend rebuild.
- `vendor/`.
- `node_modules/`.
- Generated caches/builds such as `public/build` and `storage/framework/*`.

Unless debugging static assets or template migration issues, avoid loading these first.

## 4) Route Surface

Web routes using session auth:
- Public root: `/`.
- User dashboard/profile: `/dashboard`, `/profile`.
- Booking pages: `/book*`, `/my/reservations`.
- Admin Blade panel: `/admin/*` with `auth`, `verified`, and enum-backed admin role middleware.
- Doctor Blade panel: `/doctor/*` with `auth`, `verified`, and enum-backed doctor role middleware.
- Local debug: `/debug/res-last`, registered only in local env.

API routes using Sanctum:
- `/api/auth/*` for register, doctor register, login, refresh, logout, profile, and me.
- `/api/tenant-heartbeats/{tenantInstance}` for signed, throttled, sanitized monitoring input.
- `/api/checkups*`, `/api/reservations*`, `/api/my/reservations`, including patient medical-request discovery/upload/published-outcome/clean-download routes.
- `/api/doctor/*` for doctor profile, reservation, medical-request review/download, and report draft/publication/amendment workflows.
- `/api/admin/*` for users, doctor verification, reservations, questionnaires/submissions, tenant registry/feature controls, and scoped marketplace settings.
- Public questionnaire endpoints: `/api/questionnaires*`.

Role middleware strategy:
- Role names come from `App\Enums\UserRole`.
- API role checks specify the `sanctum` guard.
- Spatie roles are seeded as `root-admin`, `admin`, `doctor`, and `patient`.

## 5) Data Model Clusters

Identity and auth:
- `users`
- `user_profiles`
- `leads`
- Spatie permission tables
- `personal_access_tokens`

User classification:
- `leads`: anonymous/free-form public captures and unconverted prospects.
- `users` + `patient` role: authenticated patient accounts.
- `users.patient_status`: nullable patient lifecycle/capability flag.
- No active `users.role` column.

Medical booking:
- `marketplace_hospitals`
- `hospital_listing_requests`
- `specialties`
- `doctor_profiles`
- `doctor_specialty`
- `doctor_workplaces`
- `doctor_workplace_checkup`
- `doctor_working_windows`
- `doctor_working_window_breaks`
- `doctor_visit_slots`
- `checkup_categories`
- `checkups`
- `reservations`
- `reservation_schedule_changes`
- `reservation_notes`
- `reservation_files`
- `reservation_medical_requests`
- `reservation_reports`
- `reservation_payment_summaries`
- `payment_attempts`
- `payment_provider_events`
- `payment_adjustments`

Shared platform primitives:
- `audit_events`
- `setting_definitions`
- `setting_values`
- `features`
- `outbox_events`
- `tenant_instances`
- `tenant_feature_overrides`
- `tenant_health_snapshots`

Isolated tenant foundation:
- Six migrations under `database/migrations/tenant/` create one local hospital profile, local identities/roles/sessions, settings/entitlements, audit, and outbox without marketplace operational tables.

Questionnaires:
- `questionnaires`
- `questionnaire_questions`
- `questionnaire_choices`
- `questionnaire_recommendations`
- `questionnaire_submissions`
- `leads` linked to questionnaire submissions when submitters are not registered users

## 6) Local Runtime Topology

Defined in `docker-compose.yml`:
- `app`: PHP-FPM, code mounted at `/var/www`.
- `nginx`: host `8080` -> container `80`.
- `db`: MySQL host `3307` -> container `3306`.
- `redis`: host `6380` -> container `6379`.

Important env defaults for Docker-run Laravel:
- `APP_URL=http://localhost:8080`
- `DB_HOST=db`
- `DB_PORT=3306`
- `REDIS_HOST=redis`

Important host-side caveat:
- `db` is a Docker network hostname.
- If running PHP directly on Windows, use `127.0.0.1:3307` for MySQL instead.

## 7) Frontend State

Root frontend:
- Active for Blade pages.
- Uses Laravel Vite from root `package.json`.
- Root build output is Laravel's normal `public/build`.

`frontend/` workspace:
- Current source is Velzon React-TS migrated from Create React App to Vite.
- Scripts are Vite-backed: `npm start`/`npm run dev` for dev, `npm run build` for production build.
- Dev server runs at `http://localhost:3000`.
- It is Bootstrap/template-heavy.
- Active browser auth uses Sanctum session cookies through one typed transport/gateway and observable admin-auth authority; `frontend/src/helpers/session_api.ts` is a compatibility re-export only.
- Login calls `/sanctum/csrf-cookie`, JSON `POST /login`, then `/api/auth/me`.
- Logout calls JSON `POST /logout`.
- Header/profile display uses the current session user from `/api/auth/me`.
- The existing Redux store hosts one RTK Query service with endpoint-specific list adapters, consumed by the deployed user directory and role-specific booking/reservations. Identity/role/logout changes clear session-owned query data.
- October 4 delivers patient `/panel/book` and `/panel/my/reservations`, doctor `/panel/doctor/reservations`, supported-role login/landing and manifest-owned menus/guards. Admin/toolbox capabilities remain restricted. Historical source quality 48 files/254 tests, reference build 5.26 seconds, backend 16/70 and 17 browser checks pass. Subsequent image 8c8bb2e4 includes the local sandbox Dialog/adapter; October 5 UI failure/new-attempt success, terminal replay safety, paid/confirmed scoped visibility and read-only MySQL canonical/event checks pass for reservation 8/patient account 4. No rebuild pending. Medical/actual scan readiness is next; workers/scheduler and full golden flow remain open. Evidence: `docs/deployment/demo-role-booking-2026-10-04.md`, `demo-sandbox-payment-2026-10-04.md` (including exact same-key replay limits).
- Presentation capability predicates preserve the admin/root matrix, and a dormant UI-agnostic coordinator provides one-confirm/one-retry handling for recent-password 423 responses without owning the server expiry.
- Browser admin auth no longer stores bearer tokens in browser storage.
- Firebase auth helpers, fake JWT auth backend, and JWT token-access helpers have been removed.
- `frontend/src/helpers/api_helper.ts` no longer attaches global bearer headers.
- `frontend/src/helpers/fakebackend_helper.ts` and its Themesbrand-configured Axios client remain retained for root-toolbox demo pages but are excluded from the statically verified normal entry/auth/dashboard graph. Active dashboard cards use unchanged local fixtures/hard-coded demo values, and no Laravel dashboard-metrics API is claimed.
- Local Laravel backend is `http://localhost:8080`; API routes live under `http://localhost:8080/api`.
- Active frontend env declarations use Vite keys `VITE_BACKEND_URL` and `VITE_API_BASE_URL`; no active fake-auth environment switch remains.
- Active frontend env reads use `import.meta.env`; the old CRA `process.env.REACT_APP_*` compatibility bridge has been removed.
- Remaining old CRA env mentions are commented Firebase template notes only.
- The completed Phase 2 audit and approved blueprint are recorded in `CURRENT_TASK.md`; continue from its current checkpoint without reopening the audit.

## 8) Production Docker Skeleton

Production packaging now includes separate Laravel and React-admin image paths, but it is not a final deployment guarantee.

Key files:
- `docker-compose.prod.yml`
- `docker/prod/Dockerfile`
- `docker/prod/app/entrypoint.sh`
- `docker/prod/nginx/default.conf`
- `frontend/Dockerfile`
- `frontend/nginx/default.conf`
- `frontend/.env.production.example`
- `.env.production.example`
- `docs/deployment/docker-production.md`

Target shape:
- immutable app image with Laravel code, Composer dependencies, and built root Vite assets
- separate Nginx image serving copied `public/` assets
- independent React-admin Nginx image serving `frontend/dist` only under canonical `/panel/*`
- named storage, MySQL, and Redis volumes
- no whole-project bind mount
- optional queue/scheduler services under the `workers` profile

The React admin image builds with Node 24.19.0, receives the separate Laravel origin through `VITE_BACKEND_URL`, rejects the reserved example origin, and uses no API proxy. Its Nginx contract redirects `/` and `/panel` to `/panel/`, falls extensionless panel routes back to `index.html`, returns 404 for missing assets/outside paths, and caches hashed assets immutably. Static contract tests, local production build and user-rebuilt deployed-origin checks pass; eligible static gzip bodies match their originals. The current candidate is source verified; broader production and complete business-walkthrough acceptance remain separate.

## 9) Current Verification Snapshot

October24 editorial image source/UI slice is verified on healthy e03d9719/44 assets, retained checkupino-admin:article-media-ui-accepted-2026-10-24; a85a88d4 remains the rollback. The user deferred automatic scheduling and prioritized the shared File Manager, native CKEditor image action and thumbnail grid above tags. Private staff-only JPEG/PNG admission/quarantine/validation/retirement, exact immutable version references, fresh eligibility/integrity and ordinary publication/edit/recovery safeguards pass source251 tests/1946 assertions; frontend73, quality/format/PHP style18 pass. Final decoded synthetic PNG native admin/root ENFA1440/390 eight cohorts/24 checks and actual doctor/patient/guest three refusal groups pass; browser fixtures are explicitly not persisted media or real scanner acceptance. An invalid earlier PNG fixture was replaced with a deterministic valid64x40 image, independently decoded offline; failed/superseded receipts remain. User-requested normal-container recovery passes HTTP and UID33 MySQL/Redis checks; nine normal services run, six helpers stay stopped. All30 business/protected/audit hashes, zero health rows, original six article tables and both medical jobs remain intact. Exact extension migration/presentation/media flags are still unapplied; source approval was source-only and live authorization remains unresolved after the plan clarification. Next is the existing guarded media activation gate, then controlled current scanner/parser proof and separately authorized ordinary synthetic upload/selection/version acceptance. No general worker, queue consumption, new dependency/URL or live content/health save. Read docs/deployment/article-file-manager-2026-10-24.md and the concrete activation proposal; source/design approval must not be requested again.

Historical Phase1 baseline as of 2026-08-16:
- The final Phase 1C checkout passes SQLite 186 tests/950 assertions with one expected MySQL-only skip and disposable MySQL 187 tests/961 assertions, including production outbox integration and concurrent payment success.
- Marketplace and isolated tenant paths pass fresh migration, repeat seed, rollback, reapply, and reseed. Verified disposable schemas contain 50 marketplace tables and 22 isolated tenant tables.
- Entitlement, monitoring, settings, file, audit/step-up, API-resource, outbox, payment, hold-expiration, and MySQL-locking regressions pass.
- Tenant isolation retains one local installation/profile/user/role/entitlement and excludes inspected marketplace, booking, payment, questionnaire, and medical-file tables.
- The Phase 1C checkpoint had 104 non-vendor routes; current post-Phase-1E discovery loads 121 non-vendor routes, including 68 API routes.
- Detailed evidence: `docs/audits/phase-1c-verification-gate-2026-08-03.md`.
- Phase 1D's six future-domain baselines are reconciled in `docs/architecture/phase-1d-future-feature-extension-contract.md`; it intentionally adds no speculative runtime code or schema.
- The code-level Phase 1C learning reference is `docs/reports/phase-1c-code-learning-report-2026-08-03.md`.
- Phase 1E gap evidence is `docs/audits/phase-1e-gap-audit-2026-08-03.md`; corrected items 16-20 are implemented. Item 20 closes admin credentials/authority and catalog creation/pricing/archive reasons, fixes a 21-route privileged mutation contract, and passes 124 named tests/780 assertions. The full SQLite baseline passes 304 tests/1,796 assertions with three intentional MySQL-only concurrency skips; the user-confirmed disposable-MySQL suite passes 307 tests/1,816 assertions; 68 API/121 total non-vendor routes load.
- High-authority closeout evidence is `docs/audits/phase-1e-high-authority-closeout-2026-08-16.md`.
- Final Phase 1 evidence is `docs/audits/phase-1-verification-gate-2026-08-16.md`; live documentation reconciliation, route discovery, zero-advisory Composer audit, temporary-password absence, and `git diff --check` were revalidated on 2026-08-16.

## 10) Immediate Next Work

1. Follow active stage3b in [CURRENT_TASK](../CURRENT_TASK.md): current one-page composer is deployed; Schedule is still disabled at runtime. Next prepare/accept its exact guarded migration/flags/dedicated publisher package with separately missing live authorization, then the already approved verified editorial asset/File Manager/editor source work. No repeated source/UX approval, prior writer replay, general queue or scheduler. Patient library and reviewed rules follow.
2. Continue with the patient published-article library after its exact routes/composition are approved, then reviewed/versioned explainable recommendations and the integrated four-role demo rehearsal. Library reading must work without a health profile; recommendations remain inactive without actual reviewed rules.
3. Preserve the retained Velzon React18/Bootstrap design, existing EN/Farsi mirror and language-owned direction, metadata-only support privacy, immutable history and SeaweedFS/AWS compatibility. No new dependency/role, protected-account change, queued-job consumption or unapproved UI/RTL change. Medical scanning/fresh uploads remain an independent gate; broad media, CI, portability, quarantine/deletion and optional dashboards stay deferred.

## 11) Current Open Risks

1. Frontend evidence: F28 typecheck, registry/menu tests, lint, fixtures, ratchets, formatting, and a 10.44-second build pass. One full run hit the known unrelated Quill five-second timeout after 42/43 files; its focused rerun passed. The unchanged lock retains its prior zero-finding production audit. Initial CSS is 1,002,953 bytes/158,135 gzip; the separate 112,887-byte/20,886-gzip toolbox stylesheet is absent from initial HTML. Eleven WOFF2 files totaling 1,135,684 bytes replace the former 34-file/8,375,625-byte font artifact. The prior combined browser matrix and F28 focused sidebar acceptance pass. F27I asset quarantine is deferred until 2026-09-21; CI, Linux, deployed fallback, portability, and final RTL evidence remain open.
   The matrix-found Chat regression is repaired: its built route closure excludes the external demo client/thunk barrel and uses room-scoped local fixtures. Complete quality passed 43 files/197 tests for the repair; after the final direct-import isolation, focused Chat/Quill plus all non-suite gates and build pass, while one repeat full run hit only the known intermittent Quill timeout. The user confirms the live Chat repair on 2026-09-10.
2. Credential hardening: Phase 1 uses a small local common/context password blocklist. Production breached-password screening and MFA require an explicit later design/provider decision.
3. Frontend boundary: the manifest activates `/panel/login`, authenticated `/panel` and `/panel/users`, and root-only `/panel/dev/*` plus role-aware unknown redirects. The legacy placeholder/dashboard/profile/logout route registrations are absent. The standalone admin image owns static fallback; October 1 fixes its port-dropping canonical redirects with relative Location headers. Local runtime smoke does not establish production TLS or complete F29's separately deferred requirements.
4. Retained-template payload: the canonical `/panel` home no longer reaches fake Axios/demo reducers, eager toolbox definitions, or isolated retained demo stylesheet families. Active fonts ship WOFF2 only and unused reference locale catalogs emit no payload. F24B2 now retains only the separately approved F27I page/image allowlist gate; the existing zero-finding audit does not establish that remaining asset boundary.
5. RTL effort risk: retained Velzon RTL styles contain multiple observed geometry/placement defects; repair scope, layout coverage, and time are unbounded until a dedicated defect inventory is approved.
6. Local performance limitation: development Compose bind-mounts the Windows repository, including `vendor`, into `/var/www`. Final deployed warm `/me` measurements are 81.1 ms median/1,551.3 maximum against the unchanged 1,500 ms maximum target; the user explicitly accepts this local-demo exception. Post-idle maximum is 1,628 ms and cold login about 12.4 seconds; warm up login/users before presenting. OPcache capacity is ample, with timestamp validation still enabled at two seconds. Filesystem/revalidation timing remains a hypothesis, not a proven cause. Broader backend tuning is deferred under the accepted exception; no production performance guarantee is implied. Evidence: `docs/deployment/demo-readiness-2026-10-02.md`.

## 12) Recommended Scan Order (Future Sessions)

### Normal task sessions

1. Read `AI_BOOT.md`.
2. Read `CODEX_RULES.md`.
3. Read `CURRENT_TASK.md`.
4. Read only the relevant `docs/ai-context/modules/*.md` file if the task maps to a domain.
5. Read only the files directly named by the current task or module.
6. Read routes/controllers/models/policies/services only when the task requires them.
7. Read tests relevant to the behavior being changed.
8. Do not read full `README.md`, `docs/TODO.md`, `docs/PROJECT_MAP.md`, ADRs, or architecture docs unless the session is explicitly planning/architecture review.

### Planning or architecture review sessions

1. Read `AI_BOOT.md`.
2. Read `CODEX_RULES.md`.
3. Read `docs/PROJECT_MAP.md`.
4. Read `docs/TODO.md`.
5. Read relevant ADR/boundary docs.
6. Then create/update `CURRENT_TASK.md`; keep the ordered roadmap in `docs/TODO.md`.

### Avoid by default

- `frontend/public/assets/`
- `vendor/`
- `node_modules/`
- generated caches/builds
- broad `frontend/src/pages/` scans unless working on frontend route/toolbox isolation
