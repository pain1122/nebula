# Production Docker Skeleton

Status: local demo runtime and user-directory acceptance passed; production environment/release gates remain open
Created: 2026-06-03
Last reconciled: 2026-11-01 (operator-guide links and worker boundary)

Current operator entry points are [BUILD_AND_DEPLOY.md](BUILD_AND_DEPLOY.md) and [PRODUCTION_OPERATIONS.md](PRODUCTION_OPERATIONS.md). They separate the full local demo from this immutable server skeleton and list the remaining production media/TLS/worker gates. Older core examples below describe packaging, not a complete clinical release or permission to start workers.

This deployment path is meant to keep production packaging visible early, so Docker does not become an end-of-project trap.

## Goal

A target machine should eventually need Docker plus its verified release/environment package. For current exact configuration, build, first migration, root provisioning and explicit-service startup commands, follow [production operations](PRODUCTION_OPERATIONS.md). Do not start the whole stack as a substitute for those gates.

This is not the final production release process yet. It is a buildable deployment contract that should mature alongside the app.

## Current Shape

`docker-compose.prod.yml` defines:
- `admin`: independent Nginx image that builds `frontend/` and serves the static React admin under `/panel/` on its own origin.
- `app`: immutable Laravel PHP-FPM image built from `docker/prod/Dockerfile` target `app`.
- `nginx`: Nginx image built from the same Dockerfile target `nginx`.
- `db`: MySQL 8 with a named volume.
- `redis`: Redis 7 with a named volume.
- `queue`: optional worker profile using the app image.
- `scheduler`: optional worker profile using the app image.

Named volumes:
- `checkupino_storage`: Laravel storage, uploads, logs, sessions/cache files if configured that way.
- `checkupino_db_data`: MySQL data.
- `checkupino_redis_data`: Redis append-only data.

## Build Strategy

`docker/prod/Dockerfile` is multi-stage:
- `assets`: installs root Node dependencies and builds Laravel Vite assets into `public/build`.
- `vendor`: installs Composer production dependencies without dev packages.
- `app`: PHP-FPM runtime with app code, vendor dependencies, built assets, and runtime entrypoint.
- `nginx`: serves copied `public/` files and proxies PHP requests to `app:9000`.

`frontend/Dockerfile` is a separate two-stage image:
- `build`: uses the exact Node 24.19.0/npm contract, runs `npm ci`, requires `VITE_BACKEND_URL`, rejects the reserved `https://api.example.com` placeholder, and creates the Vite artifact.
- `admin`: copies only `frontend/dist` into Nginx under `/panel` and serves no PHP or API proxy.

`frontend/nginx/default.conf` owns the deployed admin behavior:
- `/` and `/panel` redirect permanently to `/panel/`;
- relative Location headers preserve the browser-facing host port; October 1 runtime smoke exposed port 3000 being dropped by Nginx absolute redirects, so the server now uses `absolute_redirect off`;
- existing `/panel/assets/*` files receive immutable one-year caching and missing assets return 404;
- other static files return 404 when missing;
- extensionless `/panel/*` requests fall back to `/panel/index.html` so canonical SPA deep links refresh correctly;
- paths outside `/panel/*` return 404, apart from the container health endpoint.

The app image stage uses Alpine-based PHP to keep the runtime small and reduce OS package mirror lockups during local builds.

The admin image remains a separate origin from Laravel. The browser calls the Laravel origin directly through the existing credentialed API/Sanctum client. `APP_URL` supplies the default frontend build-time backend origin; `ADMIN_API_BASE_URL` is optional and otherwise derives as `${APP_URL}/api`. Changing either deployed API URL requires rebuilding the static admin artifact. A copied example must have its reserved API origin replaced before the image will build.

## Runtime Entrypoint

`docker/prod/app/entrypoint.sh` prepares writable Laravel directories and supports two explicit switches:

```env
RUN_MIGRATIONS=false
CACHE_LARAVEL=false
```

If `RUN_MIGRATIONS=true`, the app container runs:

```bash
php artisan migrate --force
```

If `CACHE_LARAVEL=true`, the app container runs:

```bash
php artisan config:cache
php artisan view:cache
```

Route caching is intentionally skipped while route files still contain closures.

Keep both runtime switches disabled until the env strategy is stable.

## Health Checks

- Admin Nginx checks `GET /healthz` on its own container.
- Nginx checks `GET /healthz`.
- App checks `php-fpm -t`.
- MySQL checks `mysqladmin ping`.
- Redis checks `redis-cli ping`.

`/healthz` is intentionally database-free. It confirms Laravel boot and routing, while database and Redis health are checked by their own containers.

## Worker Profile

Queue and scheduler services are not started by default. Keep the generic `workers` profile disabled until its exact purpose, queue ownership, supervision and release checks are accepted. It is not the dedicated medical worker or an accepted publication runner. The current manual deliberately starts only explicit core services.

## Production Rules

Do not bind-mount the project source in production.

Do mount/persist:
- database volume
- Redis volume if Redis persistence matters
- Laravel `storage/` volume
- external backups for DB and uploaded files

Do not bake into the image:
- `.env`
- real secrets
- local database files
- `node_modules`
- `vendor` from the host
- dev Composer packages
- frontend `.env` files or deployment credentials

## Admin Image Verification

After filling the ignored `.env.production`, the user-owned Docker verification is:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build admin
docker compose --project-name checkupino_prod --env-file .env.production -f docker-compose.prod.yml up -d --no-deps admin
```

For the default local port mapping, verify:

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/panel
curl -I http://127.0.0.1:3000/panel/
curl -I http://127.0.0.1:3000/panel/login
curl -I http://127.0.0.1:3000/panel/assets/does-not-exist.js
curl -I http://127.0.0.1:3000/outside-panel
```

Expected results are redirects from `/` and `/panel` to `/panel/`, HTML success for `/panel/` and `/panel/login`, and 404 for the missing asset and outside-panel path. A deployed-origin smoke must additionally verify credentialed login, refresh on a protected route, a root-only toolbox deep link, controlled logout, and the configured HTTPS/CORS/Sanctum cookie settings.

## Local Demo Recovery (Existing Split Projects)

The local demo uses the existing development backend project and only the production project's static admin. Use one browser identity: `http://localhost:3000/panel/` calling `http://localhost:8080`. Docker/Compose builds remain user-run.

```powershell
docker compose --project-name checkupino --file docker-compose.yml start db redis app nginx
```

If Laravel Redis connectivity fails with `Class "Redis" not found`, rebuild only the existing development app. The development Dockerfile now installs/enables the same required PHP extension as the production Dockerfile:

```powershell
docker compose --project-name checkupino --file docker-compose.yml build app
docker compose --project-name checkupino --file docker-compose.yml up -d --no-deps app
docker compose --project-name checkupino --file docker-compose.yml restart nginx
```

Rebuild only the admin after changing source or compiled URL configuration:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml build admin
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps admin
```

Run each next command only after the preceding command succeeds. Do not start the production app/nginx/db/Redis alongside the development backend. Preserve all volumes and the separate hazelnut2.0 stack/port 18080. Avoid running Vite on Docker's port 3000. The user-directory flow is synchronous and needs no worker/scheduler; booking hold expiry and asynchronous demo flows need their own explicit verification.

## Remaining Production Gates

Before real staging/production, finish or revisit:
- deployment-specific admin image/Compose and `/panel/*` refresh/auth smoke. The October 1 local split-project demo passes; production/TLS acceptance remains separate.
- deferred F27I retained-demo allowlisting and external demo-helper disposition before F29 closes.
- environment-specific validation of `APP_URL`, `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS`, secure cookies, CORS, and TLS origins.
- payment-provider adapter/webhook/credential/refund execution decisions; the verified backend currently exposes provider-neutral contracts and adjustment requests only.
- backup/restore process for DB and uploads.
- TLS termination strategy.
- CI image build and smoke test.
- whether migrations run automatically or as a release step.
