# Fresh demo seed readiness — October 31, 2026

The user clarified that the new PC does not need the current database, provided seeders make all implemented features usable. The preferred setup is now an independent fresh database with synthetic demo data. This removes the need to transfer old database rows, their original encryption key, existing private uploads or old SeaweedFS objects. It does not authorize resetting the current laptop, replacing its credentials, deleting volumes or consuming its two pending jobs.

The user selected **populated synthetic demo examples**. The expanded package passes fresh SQLite and disposable MySQL installation, four focused tests/93 assertions, actual isolated scanner/parser processing, and exact repeat preservation. Operator cleanup and exact test-container/network absence are verified. The new-PC setup and walkthrough remain open; this is not certification of the target installation.

## Implemented package — November 1, Tehran

The standard metadata stage creates six accounts (root/admin/two doctors/two patients), three hospitals/clinics, three doctor-location associations, eight realistic service windows with eight rests, and dated slots from the ordinary scheduling service. Nine reservations cover pending, failed-payment, confirmed, completed, cancelled and expired examples, including upcoming and eligible-to-complete appointments for both doctors. Prices/currency/duration come from real materialized slots. Payment snapshots are explicitly synthetic fixtures, not provider settlement evidence.

Patient examples include four encrypted self-reported health snapshots, six biometric observations and four normally scored questionnaire submissions. Content includes six bilingual articles, five shared bilingual categories/tags and seven initial immutable versions, covering draft, review, reviewed, published-with-new-draft and archived states. Ordinary services create four doctor-owned medical requests and metadata-only audits. General readers and reviewed personal recommendations remain separate product work; seeding does not add missing features.

An explicit second stage, `DEMO_SEED_VERIFIED_MEDIA=true`, requires the independent six-account/nine-reservation/six-article fixture database, current real scanner and remote parser, UID33, and accepted media flags. It uploads actual synthetic PNG/PDF bytes through existing private admission services, processes only the exact newly owned encrypted medical jobs, and uses the normal doctor review/report and article-version writers. It starts no worker, uses no alternative definitions, overrides no verdict, and refuses unrelated files/jobs or edited report/article contents. Failure leaves unreleased files unavailable. This stage defaults **false** and must not be enabled on the existing laptop.

The real network-isolated SQLite run passed with official ClamAV database28170 and the remote qpdf/GD parser:

| Populated result | Count |
| --- | --- |
| Users / reservations |6 /9 |
| Health snapshots / biometric observations / submissions |4 /6 /4 |
| Articles / immutable versions / shared terms |6 /9 /5 |
| Released editorial images / immutable media references |3 /8 |
| Medical requests / clean synthetic PDFs / report versions |4 /2 /4 |
| Metadata audits / remaining jobs |57 /0 |

Two exact encrypted fixture jobs were processed through Laravel's ordinary handler and acknowledgment. No current database or existing queued job was accessed. A second full seed preserves all checked rows exactly, including user hashes, immutable histories, reports and audits. Separate tests preserve an edited password/name/closed state, clinic name, slot price and platform setting. Accounts outside the six fixture emails are refused before foundation writes. Server-owned definition metadata remains maintained; this is not a merge/import tool for arbitrary existing databases.

Validation commands (existing accepted images/vendor required):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/demo/test-source.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/demo/verify-populated-seeds.ps1
node scripts/demo/verify-fresh-seeds-mysql.mjs --preflight
```

The SQLite runtime command stores a new immutable local receipt under `docs/deployment/evidence/fresh-populated-seeds-sqlite-*.json`. Receipts are intentionally excluded from Git. PHP style covers22 affected files; PowerShell5.1 parser and Node syntax/preflight pass. Early isolated attempts exposed multipart-request formatting and assertion field/enum mismatches; those were corrected without any live database operation. No production domain service or dependency changed.

## Remaining operational gates

Completed MySQL acceptance: operator startup -> exact pinned/internal/tmpfs/healthy/sole-member admission -> empty-schema check -> all source migrations -> full metadata and real-media seed -> exact second-run preservation. Counts match the SQLite table above, including57 audits/zero jobs. Unrelated container identities/states and accepted source bindings are unchanged. No recreation or retry was needed. The operator removed the disposable project; exact container/network absence and unchanged accepted source hashes were verified afterward.

Local immutable receipts: `docs/deployment/evidence/fresh-populated-seeds-mysql-2026-11-01.json` and `fresh-populated-seeds-closeout-2026-11-01.json`. The runner now refuses replay because accepted evidence exists; never delete receipts or weaken the empty-schema guard to repeat a closed acceptance.

1. Prepare and verify the independent target profile/images/vendor/storage/socket setup; only then migrate/seed the new empty instance. Enable already delivered health/articles/media and real scan dispatch there. Keep article scheduling/publisher and ordinary workers disabled. Run the media stage only after scanner/parser acceptance; current definitions/network access remain genuine prerequisites. Project transfer/configuration commands still need their concrete target package; the existing-state restore instructions are not the selected fresh-install recipe.
2. Accept all four role journeys and EN/Farsi on the actual VivoBook. Historical completed-demo fingerprint scripts belong to the old dataset and must not be weakened or rewritten to accept this new dataset.

No current `.env`, key, database, stored object, service state or queued job was changed. Fresh target setup remains conditional on these gates. The old database/key/private uploads are optional; source-laptop data remain intact.

## Original audit — historical, before the fixes above

`scripts/demo/audit-seed-coverage.ps1` uses the existing pinned PHP image, UID33, no network, a read-only source mount, capped resources and temporary private-storage masks. PHP refuses anything except a new SQLite `:memory:` database and testing environment. It redirects environment loading to an empty file in tmpfs, never reads the project's environment/key, and verifies the effective driver/database before migrating or seeding. Both date classes use an explicit November1 noon Tehran fixture clock inside that isolated process.

All marketplace source migrations passed. `DatabaseSeeder` ran twice with stable counts. PHP syntax/Pint and PowerShell5.1 parser checks cover the new diagnostic. No current database, protected account, stored file, real key or job was changed. A MySQL fresh-install rehearsal was not performed in this slice.

| Area | Observed after existing seed graph |
| --- | --- |
| Roles/accounts |6 accounts: root, admin,2 doctors,2 patients |
| Clinical directory |3 hospitals/clinics,2 doctor profiles,3 doctor-location associations |
| Scheduling |8 working windows,0 break rows,110 materialized slots at the frozen fixture date |
| Reservations/payments |6 reservations,6 summaries,3 attempts |
| Questionnaire |1 definition/9 choices,0 submissions |
| Patient health |0 snapshots/biometric observations |
| Article administration |0 articles/taxonomy terms/media assets |
| Medical workflow |0 requests/files/reports |
| Activity/jobs |0 audits/jobs; an empty queue is expected and must not be filled for appearance |

The payment/completion rows are existing synthetic seed snapshots, not proof of actual payment settlement or ordinary clinical completion. No scanner/parser/provider operation is claimed by this seeder audit.

## Concrete gaps

1. **Invalid reservation/rule relationship:** all6 fixture reservations fall on a different weekday from their linked working window at the November1 fixture clock. `ReservationPaymentDemoSeeder` picks relative dates independently of the declared weekday and directly creates slots. Fixtures need valid current-rule dates and coherent slot/snapshot data.
2. **Appointment-sized workdays:** all8 seeded windows use one appointment's duration as their entire working span; no rests are seeded. Replace those examples with realistic shifts/service sessions and break intervals across the doctors' separate hospitals/clinics. Preserve doctor-owned pricing and per-slot override examples.
3. **Destructive rerun behavior:** all6 password hashes are rewritten on the second seed. `LocalUsersSeeder` also reapplies roles/active state; platform values and catalog/profile fixtures use updates that can overwrite later edits. Count idempotency alone is inadequate. Define and test safe fresh-install/repeat behavior before recommending reseeding.
4. **Missing delivered-domain examples:** articles with shared EN/Farsi categories/tags and editorial versions, patient-reported health/biometric examples, questionnaire submissions, and medical request/report scenarios are absent. Provide useful synthetic examples through the appropriate owned services and retain privacy/version/audit rules.
5. **Runtime profile is separate from data:** example environment flags leave health/article/media features disabled. The target setup needs an explicit local profile for already delivered features and the corresponding verified parser/scanner services. Scheduling/publisher and other deferred features stay disabled.

General reading/personal recommendations and future roles are not silently added to this scope. An empty table belonging to a deferred feature is not a bootstrap failure.

## Original execution plan — superseded by the package and remaining gates above

- Resolved: the user chose populated synthetic examples.
- Correct rule/slot/date fixtures and realistic shifts/rests, and ensure repeat seeding does not reset edited identities, credentials or settings.
- Expand supported-domain fixtures using existing application services where they own immutability, publication, scoring or auditing. Do not mark files clean, bypass clinical review, fabricate scanner evidence or represent fixture payment snapshots as real provider acceptance. Media/scanner demonstrations need actual synthetic bytes and normal guarded processing; general workers must remain stopped.
- Prove fresh migrations plus the complete seed graph in isolated SQLite and disposable MySQL, then test the actual active-role API/feature prerequisites and a fresh-target EN/Farsi walkthrough. Preserve synthetic fixture provenance and useful empty states.
- Only after those gates, prepare the image/dependency/configuration package and verified empty-target setup commands. A new application key belongs only to the new empty instance; the original laptop and its rollback state remain intact.

Run the audit from the project root after the accepted PHP image and vendor tree are available:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/demo/audit-seed-coverage.ps1
```

This command is diagnostic only. It now reports the expanded metadata graph and its invariants; the counts in the original audit above are historical. It does not activate features, access a live database or substitute for real-media/MySQL/target acceptance.
