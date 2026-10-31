# Container recovery and Git checkpoint — October 31, 2026

The user authorized restarting existing Checkupino containers, checking their health and pushing the project to GitHub. They explicitly confirmed `pain1122/nebula` (the existing origin), branch `main`, despite the older README naming a different repository. The clone example now uses that confirmed destination while retaining the local `checkupino` directory name.

## Recovered runtime

| Services | Result |
| --- | --- |
| Existing MySQL, Redis, app and Nginx | Started without recreation, image change, migration, reset or credential change. UID33 Laravel `SELECT 1` and Redis ping pass. Backend `/up` returns200 and anonymous `/api/auth/me` returns401. Nginx/PHP-FPM configuration checks pass. |
| Static admin | Existing container restarted; healthy, accepted image66828d4d unchanged. `/healthz` and `/panel/login` return200. |
| Four SeaweedFS services | Existing containers restarted in master/volume/filer/S3 order. Master/volume endpoints respond; anonymous filer/S3 requests are denied403 as expected. No object, bucket or storage-credential change. |
| Isolated parser | Existing container started. Ordinary-app synthetic PDF validation and the current synthetic PNG decode/corruption/recovery probe pass through the existing socket. |
| ClamAV scanner | Operator started the exact existing container once after Docker egress changed from Iran to Germany. Healthy with official daily definitions28170, updated2026-10-31 06:24:42UTC. Actual clean-PNG/EICAR, checksum and freshness checks pass as UID33. |
| Checker, worker and one-shot initializers | Remain stopped/completed. No worker or checker was started and no queued job was consumed. |

Eleven service containers run. Services without Docker healthchecks are covered by the functional checks above; their `running` state alone is not presented as health proof. The first cold backend HTTP request exceeded its10-second budget; subsequent bounded HTTP checks pass. This recovery does not claim a new performance benchmark or repeat the full product rehearsal.

Automatic approval review rejected the assistant's scanner startup with “blocked by policy” and no further reason. The operator executed `docker start checkupino_scan-scanner-1`; the assistant then verified its resulting runtime and real engine behavior. No equivalent startup was attempted through another execution path.

The historical October11 parser verifier refused the current counts after its synthetic socket checks; its old two-file/zero-job assumptions are obsolete. Its receipt and guard were retained. A separate current read-only probe verified the deployed parser/scanner without weakening that guard or replaying any accepted writer. An initial full-state capture also exceeded its fixed30-second limit; a subsequent unchanged read-only capture passed.

The recovered baseline matches the October25 checkpoint across30 business/protected hashes, including both queued jobs. The engine/parser probes use only memory-based synthetic bytes, with no uploaded file, saved verdict, article change or business audit write. Existing ordinary-authoring and immutable-history acceptance remains intact; no live health/profile save or new publication was performed.

## Publication scope

The checkpoint contains the accumulated application/frontend source, dependency lockfiles, tests, Docker definitions, runbooks and expanded task history. `.env` files, private uploads, databases, Composer/REPL state, generated runtime receipts and browser screenshots remain local. `docs/deployment/evidence/README.md` explains why operational reports link to local artifacts and why a missing receipt never permits bypassing its guard.

The complete staged text was checked for private-key and GitHub/AWS token patterns. Actual local secret values were checked against candidate text without printing them. Only previously published local-demo defaults and explicit environment-template placeholders matched; no live encryption key, token or generated storage credential is included. Environment templates remain versioned; dependencies, build output and local histories are excluded. All five active project-scoped Compose configurations and frontend TypeScript verification pass. Full historical feature suites and completed MySQL writers were not replayed for this operational checkpoint.

Local receipts: `docs/deployment/evidence/container-recovery-before-2026-10-31.json` and `container-recovery-probe-2026-10-31.json`. These are intentionally not published. Automatic approval review rejected an additional combined closeout-receipt capture with “blocked by policy”; it was not performed or retried through another execution path. A limited final container-status check confirmed the eleven running services, healthy scanner/admin and stopped worker/checker. The Git push is an ordinary fast-forward to `origin/main`; no force push, remote replacement or history rewrite is authorized or required.

The next implementation task remains CURRENT_TASK section4: patient published-article discovery at `/panel/my/articles` and `/panel/my/articles/:articleId`, followed by reviewed recommendations. Broader media, continuous medical delivery and automatic scheduling remain separately bounded work.
