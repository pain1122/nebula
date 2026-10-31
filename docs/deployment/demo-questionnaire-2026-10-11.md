# Fixed questionnaire acceptance

Current combined admin release is8db6aa7e; it retains this accepted submission/page and includes the truthful checking-versus-sending label correction plus the approved separate appointment control. Its54/414 source gate and31 served assets/early-refusal rehearsal are recorded in [appointment controls](demo-appointment-completion-2026-10-11.md). The be9f5740 evidence below is the preserved original successful questionnaire acceptance, not the current container pin; do not replay its submission writer.

The operator explicitly approved `demo-questionnaire-proposal-2026-10-11.md`. Patient-only `/panel/my/questionnaire`, one sidebar entry below reservations and the retained Velzon vertical form are deployed and accepted. No builder, new dependency, schema, booking prerequisite or public SEO page.

The page reads the existing three-question published `demo-heart-health-screen` fixture. The definition now exposes its actual server version as additive read-only metadata; scores and recommendation rules remain hidden. A fresh definition fingerprint is checked before every submission. Changed questions/version require deliberate new answers. Payload contains only required name/phone and exact question/choice IDs; identity, version, score and recommendation remain server-owned.

Controls/results are English/Farsi. Only exact matching version1 fixture wording receives source-owned Farsi aliases; changed text/version falls back to canonical server wording. Rich text is converted in an inert detached template, active elements removed and the result rendered as escaped React text. No arbitrary HTML enters the rendered page.

Duplicates are blocked during preflight and delivery. An opaque pending marker in tab session storage is set before POST; ambiguous/malformed/aborted delivery remains blocked across page remount. A definitive validation rejection or acknowledged valid result clears it. No automatic replay, credential/answer storage or manual result shortcut. Storage failure stops before POST. The current submission API has no idempotency key; the page does not invent one.

## Verified scope

- Frontend full quality: **53 files/401 tests**. TypeScript, governed and supplemental page lint, fixtures, formatting and ratchets pass; final ratchets2515/10/40/0. Twelve focused questionnaire cases include EN/FA, missing/foreign choices, changed definitions, duplicate preflight, unmount abort, durable uncertain delivery, storage refusal, malformed receipt, plaintext/alias fallback and input whitelist. Five route cases enforce patient-only deep-link access.
- PHP: **6 tests/42 assertions**, Pint2 files. Existing public scoring/exact-answer/tamper/version contracts plus additive public-version and authenticated ownership/no-guest-lead checks run as UID33, network-none/read-only, isolated SQLite/private tmpfs, project env/config bypass before schema. No live migration/reseed.
- Same delegated static-admin config/build/recreate succeeds with cached dependencies, Vite5.73s. Image `be9f5740a32e9989eb0a80683ed1377e147802b558e7ba1476b2179bf1224bc6`, healthy. **26 served assets** match immutable container bytes, gzip/cache/redirect/deep-link/404 and medical/questionnaire linkage.
- **Nine actual browser groups** pass guest/doctor/admin/root denial, patient navigation/required-field refusal, exact EN/FA fixture/form/results and one ordinary submission with fresh definition read. Submitted answers are chosen from the real fixture; server returns score**2**, “Continue routine prevention.”
- Submission `01m4m2cayd4znh47995per26km` is persisted for patient4, questionnaire1/version1, exact answer/score/recommendation snapshot, null guest fields. Exactly one submission and no guest lead. Medical files/reports/requests, queue/audits, protected accounts7/8, settings, booking/payment/outbox and original history retain fingerprints.

The first browser harness mistook the preflight loading output for a submission receipt, before any questionnaire POST. Its failed evidence is retained. Read-only inspection confirmed zero submissions and unchanged fingerprints; the corrected final harness waited for the localized acknowledged result and delivered one POST only. It was not a retry of a committed submission.

## Evidence and rollback

`evidence/demo-questionnaire-static-2026-10-11.json` and `demo-questionnaire-final-browser-2026-10-11.json` contain actual artifact/browser/database fingerprints. `scripts/media/verify-demo-questionnaire.ps1` is the guarded isolated PHP runner. Browser writers refuse reuse; never replay them after acceptance.

Retain `checkupino-admin:demo-questionnaire-accepted-2026-10-11` for this artifact. Prior medical image `checkupino-admin:demo-medical-accepted-2026-10-11` is retained as static rollback. Recreating only admin with a retained prior image restores prior UI and preserves every submission/report/file/audit; do not reverse clinical or questionnaire state. The additive definition version can remain for compatibility. Backend producer/socket configuration and idle worker are unchanged.

Final rehearsal remains separate. Reservation8's appointment still requires ordinary time-correct completion, not medical-request completion.
