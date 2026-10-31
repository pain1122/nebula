# Checkupino build and deployment manual

Maintained: November 1, 2026. Repository: `https://github.com/pain1122/nebula.git`, branch `main`.

This is the installation entry point. It covers a new populated demo, source builds, image transfer, an existing-data move, server packaging, checks and recovery. Commands are for the operator; reading this manual does not run them.

## 1. Choose the installation

| Installation | Follow | Database/key rule |
| --- | --- | --- |
| New development or demo machine | Sections 2–10 | New empty database and a new key; populated synthetic examples |
| Move an existing installation with its history | Section 12 | Preserve the original key, database and matching private files together |
| Public staging/production server | Section 13 and [production operations](PRODUCTION_OPERATIONS.md) | Independent secrets, HTTPS, no known demo accounts; production release gates apply |

The current laptop is an existing installation. **Do not run fresh-install migration/seed/key-generation commands against it.** The selected new-PC plan does not require its old database or private files.

The full fresh seed graph was verified on isolated SQLite and MySQL, including real ClamAV/remote-parser processing, two exact owned encrypted deliveries and repeat preservation. This is recorded in [seed acceptance](fresh-demo-seed-readiness-2026-10-31.md). The complete source-build/new-host procedure below has been source/configuration reviewed; it has not been executed on every operating system. A new build is a new candidate, not the old image's acceptance.

## 2. Supported host model and requirements

All services run as **Linux containers**. Native Windows/IIS or host-installed PHP/MySQL are not the documented deployment path.

| Host | Setup |
| --- | --- |
| Windows 10/11 x64 | Docker Desktop, Linux containers, working WSL2. Verify the exact Windows build/servicing and Docker requirements against the [official installer](https://docs.docker.com/desktop/setup/install/windows-install/). See also [this project's Windows audit](windows10-transfer-readiness-2026-10-31.md). |
| Linux x86-64 workstation/server | [Docker Engine](https://docs.docker.com/engine/install/) plus the [Compose v2 plugin](https://docs.docker.com/compose/install/linux/), or Docker Desktop on a supported workstation. |
| Intel Mac | [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/), with repository-directory sharing enabled. |
| Apple Silicon / other ARM64 host | Current accepted scanner/storage/runtime images are AMD64. Use `linux/amd64` emulation consistently. Native ARM release acceptance is not established; confirm emulation works and allow extra build time. See [Docker's architecture guidance](https://docs.docker.com/build/building/multi-platform/). |

Project planning allowance: 16 GB host RAM is preferable for the complete stack; the scanner alone has a 4 GB container limit. Allow at least 30 GB free disk for images, compiler layers, dependencies and data, with additional room for backups/media. These are project estimates, not a universal hardware certification.

Install Git and Docker/Compose. Host PHP/Composer are unnecessary for the Docker paths. Host Node is optional unless developing frontend code or using Node-based operator helpers: `frontend/package.json` currently requires **Node 24.19.0/npm 11.17.0**. The frontend Dockerfile installs its own toolchain. PowerShell 5.1 examples below work on Windows; Bash examples are for Linux/macOS/WSL. Do not mix Windows paths with a WSL checkout in one session.

Run these individually; stop after any nonzero exit:

```text
git --version
docker version
docker compose version
docker info --format '{{.OSType}}/{{.Architecture}}'
docker context show
docker system df
```

Expected engine OS: `linux`. Check the selected Docker context is the intended host. Reserve local ports 3000 (panel), 8080 (backend), 3307 (development MySQL) and 6380 (development Redis). The development file publishes these ports; keep the demo on a trusted machine/network. Do not change only the panel port without updating CORS/Sanctum origins and rebuilding its compiled URL settings.

## 3. Get a clean checkout and identify the target

```text
git clone --branch main https://github.com/pain1122/nebula.git checkupino
cd checkupino
git rev-parse HEAD
git status --short
docker ps -a --format '{{.Names}}'
docker volume ls --format '{{.Name}}'
```

For the fresh path, there must be no prior `checkupino_*`/`checkupino-*` containers or project volumes on the selected host. If present, inspect them and use the recovery/existing-data path; do not delete them to pass this check. Existing unrelated projects stay untouched. Repository paths may differ by OS; prefer a short path such as `C:\work\checkupino` or `~/work/checkupino`.

Create a sibling `checkupino-install` directory for private installation notes and local Compose overrides. Keep it outside the Git checkout. Record the Git SHA, image IDs, configuration choice and accepted checks there. Restrict its access; never commit secrets or an image/data archive.

PowerShell:

```powershell
$taskRepo = (Get-Location).Path
if ((Test-Path -LiteralPath .env) -or (Test-Path -LiteralPath .env.production)) { throw 'Existing environment: stop and inspect.' }
New-Item -ItemType Directory -Path ../checkupino-install -ErrorAction Stop
Copy-Item -LiteralPath .env.example -Destination .env -ErrorAction Stop
Copy-Item -LiteralPath .env.production.example -Destination .env.production -ErrorAction Stop
```

Bash:

```bash
set -euo pipefail
taskRepo="$(pwd)"
mkdir ../checkupino-install
test ! -e .env && cp .env.example .env
test ! -e .env.production && cp .env.production.example .env.production
chmod 600 .env .env.production
```

On Linux the app's UID/GID33 also needs read access to `.env`: for the new file, `sudo chgrp 33 .env` followed by `chmod 640 .env` grants group-read while preserving the operator as owner. On Docker Desktop verify the shared-directory/NTFS permission mapping. Do not make secrets world-readable. The writable directory setup in section 5 does not modify `.env` permissions.

## 4. Obtain images: transfer OR build

### A. Transfer the already accepted images

On the source machine, save only project images. These tags must first resolve to the expected images in the table; do not overwrite a tag to conceal a mismatch.

```text
docker image inspect checkupino-app:latest checkupino-admin:local checkupino-content-isolation:2026-10-08 checkupino-content-validation:2026-10-08 --format '{{.Id}} {{json .RepoTags}}'
docker image save --output ../checkupino-images.tar checkupino-app:latest checkupino-admin:local checkupino-content-isolation:2026-10-08 checkupino-content-validation:2026-10-08 clamav/clamav:1.5.4 chrislusf/seaweedfs:4.48 mysql:8.0 redis:7-alpine nginx:alpine
```

Checksum the archive (`Get-FileHash -Algorithm SHA256` on PowerShell, `sha256sum` on Linux, `shasum -a 256` on macOS), transfer it privately, compare the checksum on the target, then:

```text
docker image load --input ../checkupino-images.tar
```

Current accepted local identities:

| Image | ID prefix; verify the full ID in the installation record |
| --- | --- |
| Development app | `18eb9257e28f` |
| Static panel | `66828d4db702` |
| Isolated parser | `c4809fae4ab0` |
| Parser build base | `a48b0c0b60fc` |
| ClamAV 1.5.4 | `7659dcb0db47` |
| SeaweedFS 4.48 | `aba492e2a4e4` |
| MySQL 8 | `7dcddc01f13b` |
| Redis 7 | `e7723ff73d96` |
| Development Nginx | `4a73073bd557` |

Verify loaded identities against the source's full-ID manifest and the SHA references in the tracked Compose files. Image-store differences may affect imported identities; do not rewrite acceptance guards if they differ. Investigate the archive/store or use the source-build candidate path. A registry mirror cannot supply unpublished local images. Tag-only MySQL/Redis/Nginx entries must also be checked against the recorded source identities before claiming an exact transfer.

For this choice, use the original tracked runtime image references in section 6, with no source-image overrides. The host checkout still needs `vendor/` and root `public/build/`: transfer their matching trees privately or install/build them in section 5. Do not copy `.env`, old framework caches, `public/hot`, `node_modules`, private uploads or old database volumes for a fresh instance.

### B. Build from source on a fresh host

Build and long dependency operations are operator-run. Internet access is needed for base images, OS packages, Composer/npm and qpdf source. Registry mirrors help image pulls; they do not proxy GitHub/package registries or ClamAV's CDN. Configure Docker's own VPN/TUN/proxy route when needed, not just the browser's route. Keep HTTPS/checksum validation enabled.

```text
docker build --platform linux/amd64 --file docker/php/Dockerfile --tag checkupino-app:manual .
docker tag checkupino-app:manual checkupino-content-validation:2026-10-08
```

The second command is only for this **new, empty host**, after verifying that no accepted base tag exists there. The parser Dockerfile currently names that base tag. A source-built image will usually have a different ID from the historical accepted image. Never retag/replace the accepted base on the current laptop. Build the isolated parser at the end of section 5, after installing `vendor/`.

The parser build copies a narrow source/vendor context and installs nothing. Its base includes GD, Redis/PDO and the checksum-verified qpdf12.4.2 binary. The app Dockerfile is not a production application image: it supplies PHP tooling/runtime and expects a source bind mount.

For source builds create these four UTF-8 YAML files in `../checkupino-install`. They are **installation overrides**, not edits to historical pins or test guards:

`app-images.yml`:

```yaml
services:
  app:
    image: checkupino-app:manual
    platform: linux/amd64
    pull_policy: never
  db:
    platform: linux/amd64
  redis:
    platform: linux/amd64
  nginx:
    platform: linux/amd64
```

`content-images.yml`:

```yaml
services:
  content-init:
    image: checkupino-content-isolation:manual
    platform: linux/amd64
  content-parser:
    image: checkupino-content-isolation:manual
    platform: linux/amd64
```

`scan-images.yml`:

```yaml
services:
  scan-check:
    image: checkupino-app:manual
    platform: linux/amd64
  scan-worker:
    image: checkupino-app:manual
    platform: linux/amd64
```

`panel-images.yml`:

```yaml
services:
  admin:
    platform: linux/amd64
```

The ClamAV image stays at its tracked official digest. The override does not start the checker/worker. Record all resulting full image IDs; after target acceptance, freeze those IDs in the installation's overrides/release record. Existing acceptance wrappers pinned to `18eb...`/`c480...` intentionally reject different builds; do not weaken them. Use target-specific evidence and the normal services below to accept the new candidate.

On ARM hosts, accepted-image transfers also need `platform: linux/amd64` overrides for the app/parser and other AMD64 services; use the same file shapes with the **verified accepted IDs**, rather than the `:manual` image names. This path has not received native-ARM acceptance.

## 5. PHP dependencies and Laravel assets

Choose the runtime image in these commands: `checkupino-app:latest` for a verified transfer, or `checkupino-app:manual` for a source build. Below, `checkupino-app:manual` illustrates the source-build choice; substitute consistently.

Prepare only new writable directories; no deletion/reset occurs:

```text
docker run --rm --pull never --user 0:0 --mount "type=bind,source=REPO_ABSOLUTE_PATH,target=/var/www" --workdir /var/www checkupino-app:manual sh -c "mkdir -p vendor storage/app/private storage/app/article-media storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache && chown -R 33:33 vendor storage bootstrap/cache"
```

Replace `REPO_ABSOLUTE_PATH` with the current host checkout path; do not paste the token literally. Docker Desktop must be allowed to share this directory. UID33 needs to read the checkout and private `.env` and write the named runtime directories. On Windows use NTFS permissions; do not blindly apply Linux ownership commands to unrelated host paths.

Install **locked** development dependencies for a local demo, including test/factory support:

```text
docker run --rm --pull never --user 33:33 --env COMPOSER_HOME=/tmp/composer --mount "type=bind,source=REPO_ABSOLUTE_PATH,target=/var/www" --workdir /var/www checkupino-app:manual composer install --no-interaction --prefer-dist --no-scripts
```

No `composer update`, `--ignore-platform-reqs` or `composer run setup`: the latter generates keys/migrates and is not the guarded procedure. Package discovery runs below after configuration. For transferred dependencies, use `composer check-platform-reqs` in the same runtime before proceeding.

Build root Blade/Vite assets even when using the separate React panel:

```text
docker run --rm --platform linux/amd64 --mount "type=bind,source=REPO_ABSOLUTE_PATH,target=/var/www" --workdir /var/www node:24.19.0-alpine sh -c "npm ci && npm run build"
```

This creates host `public/build/manifest.json`; the development PHP image contains no application assets. Do not copy a Vite development `public/hot` file. Host-side frontend editing additionally uses `cd frontend`, `npm ci`, `npm run typecheck`, `npm run build` with the manifest's exact Node/npm versions; Windows may require `npm.cmd`. The deployable React artifact is normally built by `frontend/Dockerfile`, section 8.

For **source-build choice B only**, vendor is now present, so build the isolated parser:

```text
docker build --platform linux/amd64 --pull=false --network none --file docker/medical-content/Dockerfile --tag checkupino-content-isolation:manual .
```

## 6. Configure the independent local demo

Generate a new key **only for this fresh instance**, then privately enter it as `APP_KEY` in `.env`:

```text
docker run --rm --pull never --entrypoint php checkupino-app:manual -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
```

Keep that key with future backups. Never generate a replacement for an existing encrypted database.

In `.env`, preserve the example's complete settings and set/add:

```dotenv
APP_NAME=Checkupino
APP_ENV=local
APP_DEBUG=false
APP_URL=http://localhost:8080
DB_CONNECTION=mysql
DB_HOST=db
DB_PORT=3306
DB_DATABASE=checkupino
DB_USERNAME=checkupino
DB_PASSWORD=checkupino_pass
REDIS_HOST=redis
REDIS_PORT=6379
SEED_DEMO_DATA=true
DEMO_SANDBOX_PAYMENTS=true
DEMO_SEED_PASSWORD=Password123!
DEMO_SEED_VERIFIED_MEDIA=false
PATIENT_HEALTH_ENABLED=true
ARTICLE_ADMIN_ENABLED=true
ARTICLE_MEDIA_ENABLED=true
ARTICLE_PRESENTATION_ENABLED=true
ARTICLE_SCHEDULING_ENABLED=false
ARTICLE_PUBLISHER_ENABLED=false
MEDICAL_STORAGE_DRIVER=local
ARTICLE_MEDIA_STORAGE_DRIVER=local
MEDICAL_SCAN_ENABLED=false
MEDICAL_SCAN_SOCKET=/run/medical-scan/clamd.sock
QUEUE_CONNECTION=database
```

The shown DB/demo passwords are existing public **local-only** fixture defaults, matching `docker-compose.yml`; choose a separate hardened server profile for public deployment. `DEMO_SEED_PASSWORD` may be changed before the first seed; all six fresh fixture accounts use that value, and later seeds preserve existing credentials. Retain the example's localhost CORS/Sanctum/session settings. Use `http://localhost` consistently in the browser. Mail defaults to logs; actual mail delivery needs configured SMTP and its own check.

For the demo, `.env.production` is used **only to build/serve static admin**, not to launch a production database. Set `APP_URL=http://localhost:8080`, `ADMIN_HTTP_PORT=3000`, `ADMIN_DEFAULT_LOCALE=fa`, `ADMIN_FALLBACK_LOCALE=en`. Leave `ADMIN_API_BASE_URL` empty to derive `/api`. Never start its production app/db alongside the development backend.

Use these project/file sets throughout. Append the indicated installation override **last** for source-build/ARM choices; omit it for an exact x64 transfer:

| Label | Docker Compose arguments | Optional last file |
| --- | --- | --- |
| Core | `--project-name checkupino --file docker-compose.yml` | `--file ../checkupino-install/app-images.yml` |
| Parser | `--project-name checkupino_content --file docker-compose.content.yml` | `--file ../checkupino-install/content-images.yml` |
| Scanner | `--project-name checkupino_scan --file docker-compose.scan.yml` | `--file ../checkupino-install/scan-images.yml` |
| Backend | `--project-name checkupino --file docker-compose.yml --file docker-compose.content-client.yml --file docker-compose.scan-producer.yml` | `--file ../checkupino-install/app-images.yml` |
| Panel | `--project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml` | `--file ../checkupino-install/panel-images.yml` |

Create these session-local shortcuts so the following commands are directly runnable. They add source/ARM override files only when those files exist. Define them in each new terminal; run from the repository root. They are not application commands and change no services by themselves.

PowerShell:

```powershell
$taskAppExtra = @()
$taskContentExtra = @()
$taskScanExtra = @()
$taskPanelExtra = @()
if (Test-Path ../checkupino-install/app-images.yml) { $taskAppExtra = @('--file','../checkupino-install/app-images.yml') }
if (Test-Path ../checkupino-install/content-images.yml) { $taskContentExtra = @('--file','../checkupino-install/content-images.yml') }
if (Test-Path ../checkupino-install/scan-images.yml) { $taskScanExtra = @('--file','../checkupino-install/scan-images.yml') }
if (Test-Path ../checkupino-install/panel-images.yml) { $taskPanelExtra = @('--file','../checkupino-install/panel-images.yml') }
function Core {
    & docker compose --project-name checkupino --file docker-compose.yml @taskAppExtra @args
    if ($LASTEXITCODE -ne 0) { throw 'Core command failed; stop.' }
}
function Parser {
    & docker compose --project-name checkupino_content --file docker-compose.content.yml @taskContentExtra @args
    if ($LASTEXITCODE -ne 0) { throw 'Parser command failed; stop.' }
}
function Scanner {
    & docker compose --project-name checkupino_scan --file docker-compose.scan.yml @taskScanExtra @args
    if ($LASTEXITCODE -ne 0) { throw 'Scanner command failed; stop.' }
}
function Backend {
    & docker compose --project-name checkupino --file docker-compose.yml --file docker-compose.content-client.yml --file docker-compose.scan-producer.yml @taskAppExtra @args
    if ($LASTEXITCODE -ne 0) { throw 'Backend command failed; stop.' }
}
function Panel {
    & docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml @taskPanelExtra @args
    if ($LASTEXITCODE -ne 0) { throw 'Panel command failed; stop.' }
}
```

Bash:

```bash
set -euo pipefail
taskCoreArgs=(--project-name checkupino --file docker-compose.yml)
taskContentArgs=(--project-name checkupino_content --file docker-compose.content.yml)
taskScanArgs=(--project-name checkupino_scan --file docker-compose.scan.yml)
taskBackendArgs=(--project-name checkupino --file docker-compose.yml --file docker-compose.content-client.yml --file docker-compose.scan-producer.yml)
taskPanelArgs=(--project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml)
if [[ -f ../checkupino-install/app-images.yml ]]; then taskCoreArgs+=(--file ../checkupino-install/app-images.yml); taskBackendArgs+=(--file ../checkupino-install/app-images.yml); fi
if [[ -f ../checkupino-install/content-images.yml ]]; then taskContentArgs+=(--file ../checkupino-install/content-images.yml); fi
if [[ -f ../checkupino-install/scan-images.yml ]]; then taskScanArgs+=(--file ../checkupino-install/scan-images.yml); fi
if [[ -f ../checkupino-install/panel-images.yml ]]; then taskPanelArgs+=(--file ../checkupino-install/panel-images.yml); fi
Core() { docker compose "${taskCoreArgs[@]}" "$@"; }
Parser() { docker compose "${taskContentArgs[@]}" "$@"; }
Scanner() { docker compose "${taskScanArgs[@]}" "$@"; }
Backend() { docker compose "${taskBackendArgs[@]}" "$@"; }
Panel() { docker compose "${taskPanelArgs[@]}" "$@"; }
```

Alternatively, expand the table directly. For example, source-built Backend configuration is:

```text
docker compose --project-name checkupino --file docker-compose.yml --file docker-compose.content-client.yml --file docker-compose.scan-producer.yml --file ../checkupino-install/app-images.yml config --quiet
```

Run `config --quiet` for each file set before its first use; empty successful output is normal. Do not print resolved Compose configuration containing secrets into shared logs.

## 7. Start dependencies and attach the isolated runtimes

Execute in this order, expanding the labels above. Run one line at a time and stop on failure:

```text
Core up -d --no-build db redis
Parser up -d --no-build --pull never content-init content-parser
Scanner up -d --no-build scan-init scanner
Scanner ps --all
Scanner logs --tail 60 scanner
```

Do not start `scan-check`, a `worker` profile, `queue` or `scheduler`. Parser initialization creates its UID33 socket directory; scanner initialization creates its separate socket/definition volumes. The backend network must exist before the scanner project; content socket volume must exist before the scan project. Do not copy Unix socket files from another machine.

Wait for scanner health rather than repeatedly restarting it: its health start period is ten minutes. Startup runs official FreshClam first even if the image/volume includes definitions. A connected VPN does not prove Docker's route changed. On 403/429, stop retries, inspect the updater's latest cooldown and follow [official FreshClam diagnosis](https://docs.clamav.net/faq/faq-freshclam.html); do not use alternate downloads or alter evidence. Healthy/current scanning must be established before the verified-media seed. If official access remains blocked, the metadata-only demo can proceed with media unaccepted; do not claim a complete media installation.

Once MySQL is ready and parser/scanner are running:

```text
Backend up -d --no-deps --no-build --pull never app
Backend exec --user 33:33 app php artisan package:discover --ansi
Backend exec --user 33:33 app php artisan about --only=environment
Backend exec --user 33:33 app php artisan tinker --execute="dump(DB::connection()->getDriverName(), DB::selectOne('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()')->n);"
```

Require MySQL and **zero tables** for this first installation. A nonempty schema means stop and inspect, not `migrate:fresh`. Confirm the private key is set without printing it and that this is the new target. Then:

```text
Backend exec --user 33:33 app php artisan migrate --force
Backend exec --user 33:33 app php artisan migrate:status
Backend exec --user 33:33 app php artisan db:seed --force
```

The first seed is metadata only because `DEMO_SEED_VERIFIED_MEDIA=false`. It creates accounts, realistic doctor schedules/breaks/slots, appointment/payment fixtures, encrypted self-reported health/history, scored questionnaire submissions, bilingual content/taxonomies and open medical requests. Payment/completion snapshots are synthetic examples, not real provider settlement or clinical assessment. No normal worker is enabled.

For actual synthetic image/PDF/report examples, after confirming scanner health and both socket mounts, opt in **for this invocation only**:

```text
Backend exec --user 33:33 --env DEMO_SEED_VERIFIED_MEDIA=true app php artisan db:seed '--class=Database\Seeders\VerifiedDemoMediaSeeder' --force
```

Preserve the single quotes around `--class` in either shell so namespace backslashes remain intact. The stage itself checks the enabled local fixture profile, owner set, flags and actual scanner/parser before release; it refuses unrelated files/jobs or edited target report/article content. It processes only its exact encrypted deliveries through normal handlers. Leave `.env`'s opt-in false afterward. Failure keeps files unavailable; inspect before retrying, with no verdict/status/database shortcut.

After a successful full seed, expected counts include 6 users,9 reservations,4 health snapshots,6 observations,4 submissions,6 articles/9 versions/5 terms,3 released images/8 references,4 medical requests,2 clean PDFs,4 reports,57 audits,0 jobs. See [fixture detail and repeat rules](fresh-demo-seed-readiness-2026-10-31.md). Materialized future slot counts depend on the date. Do not replay old current-laptop evidence scripts against this new dataset.

## 8. Build and start the web surfaces

```text
Backend up -d --no-deps --no-build nginx
Panel build admin
Panel up -d --no-deps --no-build --pull never admin
```

Skip `Panel build admin` only when transferring the accepted static image with **the same compiled backend origin**. Changing `.env.production` does not rewrite JavaScript in an existing image: a different API hostname/port requires a rebuild. Builds consume package/registry access; no frontend dependency installation runs on the server at browser request time.

Open `http://localhost:3000/panel/login`; the backend is `http://localhost:8080`. A successful static health check alone does not prove backend login, media or database access.

| Fixture role | Login |
| --- | --- |
| Root admin | `rootadmin@checkupino.test` |
| Admin | `admin@checkupino.test` |
| Doctors | `doctor@checkupino.test`, `doctor2@checkupino.test` |
| Patients | `patient@checkupino.test`, `patient2@checkupino.test` |

Password: the chosen initial `DEMO_SEED_PASSWORD` (example default `Password123!`). Do not deploy these identities publicly. Use separate browser sessions for role checks; log out between roles.

## 9. Installation acceptance

Run read-only checks first:

```text
Backend ps
Parser ps --all
Scanner ps --all
Panel ps admin
Backend exec --user 33:33 app php artisan migrate:status
Backend exec --user 33:33 app php artisan tinker --execute="dump(DB::selectOne('SELECT 1 AS ok')->ok, Illuminate\Support\Facades\Redis::ping(), DB::table('jobs')->count());"
```

On PowerShell use `curl.exe`; on Bash use `curl`:

```text
curl --fail --show-error http://localhost:8080/up
curl --fail --show-error http://localhost:3000/healthz
curl --head http://localhost:3000/panel/login
curl --head http://localhost:3000/panel/assets/not-a-real-asset.js
```

Require successful health/login HTML and a404 for the missing asset. Verify guest private APIs reject access; then complete this target-specific walkthrough in English and Farsi, desktop and narrow viewport:

- Patient: login, own dashboard/booking wizard, own appointments/medical files/published report history, encrypted health summary/history, available questionnaires and own submissions, profile modal, logout.
- Doctor: own confirmed-only calendar, own professional/location/working-hours controls, assigned appointments/requests, actual clean-file access and synthetic draft/amendment examples. Other doctors' records must remain inaccessible.
- Admin: directories/onboarding, hospitals, reservations, catalog, schedules/pricing, questionnaires/submissions, medical administration, payments, content/taxonomies and dashboard/activity links. Support profiles expose only their approved summaries.
- Root: admin capabilities plus staff directory and root settings/override eligibility. Do not save a destructive control merely to check that its form exists.
- Refresh deep links, switch language, cancel unsaved edits, test session expiry/logout re-entry, and confirm credentials/private clinical details do not appear in support views.

Continuous patient medical-job processing and automatic article publication are **not enabled by this installation**. The seed stage verifies only its own bounded jobs; new patient uploads may remain quarantined until separately authorized delivery. Editorial image preparation uses its existing guarded validation flow. Larger formats, multipart, folder ACL, patient article-library/recommendation delivery and real payment-provider execution retain their current task status; a seed cannot complete an undelivered feature.

Record the target OS/Docker/architecture, Git SHA, exact images, definition version/date, schema/fixture counts and walkthrough results privately. New source-built or ARM-emulated runtimes need their own evidence. Historical fixed-image/closed one-time acceptance scripts are not generic setup tools.

## 10. Optional SeaweedFS / S3-compatible storage

Local private storage above is supported and avoids requiring old object volumes. SeaweedFS remains an independent compatible foundation; enabling it does not convert existing objects automatically.

For a **new local synthetic evaluation only**, with host Node available and the backend network already present:

```text
node scripts/media/prepare-evaluation.mjs
node scripts/media/validate-evaluation.mjs
docker compose --project-name checkupino_media --file docker-compose.media.yml config --quiet
docker compose --project-name checkupino_media --file docker-compose.media.yml up -d
node scripts/media/check-evaluation.mjs --bootstrap
node scripts/media/check-evaluation.mjs --security
node scripts/media/check-evaluation.mjs --probe
```

Read each helper's result and stop on failure. They generate/preserve ignored synthetic credentials, create/check only the named evaluation bucket and perform synthetic storage checks. They do not enable the application's storage setting. Preserve `.local/media-evaluation/settings.json`, `s3.json` and the three object-store volumes together for an existing evaluation. Do not run credential generation as a replacement/repair for missing existing secrets.

For application use, provision separate private medical/editorial buckets and least-privilege credentials; set the corresponding `MEDICAL_S3_*`/`ARTICLE_MEDIA_S3_*` values and drivers. Medical driver is `medical-s3`; editorial driver is `s3`. Keep path-style endpoints for SeaweedFS. AWS can use its normal region/bucket/endpoint policy. Production requires TLS; insecure HTTP flags are for the documented local evaluation only. Before switching an existing dataset, plan object migration and verify ownership/checksums/release evidence; changing the driver alone strands files. Do not map private buckets into Nginx `/storage` or make them public.

## 11. Routine restart, updates and troubleshooting

For **existing containers**, use the same project/file sets from section 6; `start` preserves their existing configuration. Start Core db/redis, Parser content-parser, Scanner scanner once only after route/cooldown checks, then Backend app/nginx and Panel admin. Preserve all overlays on any **recreation**; omitting them removes app socket access. A scanner restart may contact FreshClam again. `content-init`/`scan-init` are one-time initialization services, not daemons. Keep checker/workers stopped.

For an update: record the old Git/image/config/schema state, take a coherent backup, review pending migrations, build candidates, apply only authorized compatible migrations, recreate only changed services with their complete overlays, and repeat the appropriate checks. Rebuild the admin after frontend or compiled URL changes. Never run `git reset --hard`, volume pruning, `down --volumes`, a reseed or a key replacement as an update step.

| Symptom | Check/action |
| --- | --- |
| SHA image unavailable / `pull never` failure | Load the exact image or use explicit source-build candidate overrides; registry mirrors do not contain local SHA-only builds. |
| Missing `vendor/autoload.php` | Install/copy locked vendor for the bind-mounted checkout. The development runtime alone does not supply it. |
| Vite manifest missing / browser tries port5173 | Build root assets; inspect for an old untracked `public/hot` from a copied working directory. |
|500 or unwritable sessions/cache | Check UID33 access to storage/bootstrap/cache and readable private environment; do not globally `chmod777` the repo. Inspect scoped logs privately. |
|419/CORS/login loop | Use one browser host identity; verify APP_URL, compiled frontend API URL, allowed origins, stateful domains and cookie settings. |
| App recovered but Nginx returns502 | Confirm app is ready, then restart only Nginx; its old upstream address may outlive app recreation. |
| Parser socket missing/denied | Confirm content-init exit0, parser running, socket owned33/mode0600 and read-only client mount. Do not broaden socket permissions or execute parsers in the app. |
| Scanner unhealthy /403/429 / stale evidence | Inspect current updater logs/cooldown and Docker's actual route; one controlled recovery through supported official procedures. No repeated restarts or alternate verdict/definition source. |
| File checking never finishes | Distinguish editorial preparation from medical queued delivery. Check readiness and exact owned job binding; do not start a general worker or mark the file clean. |
| `db:seed` refuses a populated host | It refuses unrelated accounts and unsafe fixtures intentionally. Use an independent new database or normal application actions, not guard edits. |
| Source-build image rejected by an old runner | Expected historical pin protection. Collect new target acceptance; do not rewrite old receipts/guards. |
| Browser helper cannot find Chrome | Several historical harnesses hardcode the Windows Chrome path. Use an installed compatible browser and a separately reviewed harness adaptation; this is not an application dependency. |

## 12. Existing-data backup, move and rollback

A populated installation is a coordinated set: database, original `APP_KEY`, private medical/editorial objects, any public uploads, environment/storage credentials, exact source/images, and relevant object-store volumes/configuration. Redis persistence also matters if configured. The original database's encrypted health rows/jobs cannot be restored using a new key.

Stop new writes or enter a controlled maintenance window, drain **only explicitly authorized** in-flight work, and take a consistent database/object snapshot. Store dumps and keys privately with independent checksums. Do not stream a binary database/image archive through PowerShell's text redirection; use tool-native output files or a reviewed binary-safe backup process. Never publish backups to Git.

Restore into a separately verified target; preserve the key and file identities, recreate socket directories rather than copying sockets, then validate decryption, checksums, ownership, counts and role access before serving traffic. Do not seed an imported database. A backup is accepted only after an isolated restore check; this documentation is not a claim that a backup has been taken.

Rollback normally restores the previous compatible image/configuration and disables the affected feature while retaining additive tables/history. Do not roll down populated health/content/media tables or replay an older database over newer writes. Destructive schema/data rollback requires its own reviewed restore plan. For a source-only rollback use a separate checkout/image rather than discarding a dirty worktree.

## 13. Public server deployment

Use the immutable production path in [PRODUCTION_OPERATIONS.md](PRODUCTION_OPERATIONS.md). Do not expose the bind-mounted demo/default credentials as production. That guide covers build commands, HTTPS/origins, initial root provisioning, migrations, health, backup/release handling and the concrete remaining media/worker integration gates. `docker-compose.prod.yml` is still a production **skeleton**; it does not include the accepted local scanner/parser/socket topology by itself.

Official platform references above were checked November1. Project-specific sources of truth are the tracked Dockerfiles/Compose files, configuration, lockfiles and current acceptance records. If those change, update this manual and revalidate the affected installation path.
