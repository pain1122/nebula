# Local User Create/Edit Acceptance

Source delivery: 2026-10-01. Deployed browser acceptance: 2026-10-02 (Asia/Tehran). Extends the separately verified directory/runtime in `demo-runtime-acceptance-2026-10-01.md`.

## Delivered Source

- Add user and row edit controls on `/panel/users`, through the existing Velzon card/table and shared Dialog/forms.
- Fetch the full safe user resource before editing; preserve optional profile fields and submit an explicit allowlist. Numeric API route binding remains unchanged.
- Client identity/date/password validation, digit normalization, secure local multi-word password suggestions with override, server field/global/unmapped errors and tracking IDs.
- Normal admins select patient/doctor only. Root may select admin; create/promotion/demotion of an admin account requires an audit reason. Backend remains authoritative.
- Existing 423 coordinator opens one password-confirmation overlay and retries the same operation once after confirmation. Cancellation restores the draft; wrong current-password errors remain separate from new credentials. No automatic retry for other write failures.
- Duplicate submission and dismissal are blocked during a write. Unmount aborts the operation. Credentials stay in ephemeral form/request memory and outside Redux/cache/browser storage; update never sends password fields.
- Confirmed success clears credentials, closes the editor and invalidates directory/detail caches. Existing identity-owned query clearing remains intact.
- Complete paired English/Farsi labels; original flag owns language/direction. No stylesheet/RTL redesign or dependencies added.

## Source Verification: Passed

- Full installed quality: 47 files/234 tests, typecheck, governed lint, lint fixtures, ratchets and formatting pass. Separate page lint passes; final focused editor/directory regressions: 24 tests pass.
- Production build: 7.90 seconds with Docker-equivalent localhost API origin/locale arguments. Form/schema code is in the lazy user-directory chunk.
- Existing backend security contracts: 19 tests/106 assertions across authority, credentials, audit rollback and step-up. Run with explicit testing/in-memory SQLite environment; live database was not migrated or reset.
- Existing browser-data, Sass/toolbox and jsdom warnings remain; dependency state is preserved.

## Static Serving And Artifact Freshness: Passed

- User-built/recreated admin image: `sha256:a2cc2e6a9b4d8ab853ff0fdd24b3660dda88d48f0c45460a1e2c930e2d8cc130`; running/healthy, zero restarts.
- Served entry: `index-DK8K0eNp.js`, SHA-256 `e73a8705eee04d9976fc673cfcf1c10b6dc971dd0e10a52fd87452e14ba237cf`. Served `UserDirectory-BSZm_JEG.js` includes the editor and matches the local build after normalizing imported chunk hashes. The shared `authority-jJDfWyBz.js` compiles the intended localhost:8080 backend origin.
- `/` and `/panel` return 308 with relative `/panel/` Location; `/panel/users` refresh returns 200; missing assets and outside paths return 404.
- Earlier pre-rebuild inspection found the previous directory-only image; it is superseded by this observed artifact, not counted as mutation acceptance.

## Backend Runtime: Passed After Ownership Repair

- `/healthz` returns 200; actual session-cookie requests hit localhost:8080. No backend image rebuild, migration, reseed, cache clearing or volume operation was performed.
- The first live root-admin creation failed with HTTP 500. Root-owned `storage/framework/cache/data` (755) and `storage/logs/laravel.log` (644) prevented PHP-FPM from writing Spatie's permission cache and reporting the exception; the browser saw a network error because the exception response lacked CORS headers. The failing cache filename matches SHA-1 of `spatie.permission.cache`.
- Corrected ownership of only the runtime cache-data subtree and existing log file to `www-data:www-data` through Docker exec. PHP-FPM-user writeability and root-admin create/edit then pass. Future backend checks must use `docker exec --user www-data` so test-generated runtime files remain writable; database tests still require explicit SQLite `:memory:` environment.
- This was a runtime permissions repair, with no frontend or backend policy changes and no additional admin rebuild.

## Functional Browser And Audit Acceptance: Passed

Real headless Chrome against the immutable served artifact verified the patient flow and, after the ownership repair, the root-admin flow:

- Required-field validation before a write; privileged role options absent for normal admin.
- 423 opens one confirmation overlay; cancellation restores the draft; wrong current-password 422 stays separate from the new-account password; correct confirmation retries and completes creation.
- Normal admin creates a patient and edits the full profile. Optional birth date/country/postal code persist; the changed biography survives a new detail fetch. Edit presents no password-change fields.
- Real duplicate-email 422 keeps the editor open, renders the error and focuses the invalid email field.
- Existing language flag updates editor labels and Farsi/RTL direction; no raw translation keys appear.
- Root-admin creation requires an audit reason, completes after confirmation, and demotion of that new admin to patient also requires a reason. Safe resources expose no password/confirmation fields.
- Saved data survives deep-link refresh and server role filtering. Controlled logout is server-acknowledged; guest directory navigation returns to login. No uncaught browser exceptions occur.
- Read-only database inspection finds the four expected create/update audit rows: actor 2 for patient 7, actor 1 for identity 8; both privileged changes have reasons and the role transition is admin to patient. No credential keys appear in any before/after snapshot.

Two new demo records remain preserved as patients (IDs 7 and 8, `demo-flow-patient-1790887896147@example.test` and `demo-flow-authority-1790888331940@example.test`). Failed attempts created no extra records. No existing credentials or accounts were changed, and no cleanup deletion was performed.

## Scope Limits

Account suspension/closure/session revocation controls, password reset, deletion/archive, doctor-profile/catalog/booking/payment/medical/questionnaire screens, workers/scheduler for future asynchronous flows, broad RTL stabilization and full golden-flow acceptance remain open. No backend policy, schema, topology or external provider changed.
