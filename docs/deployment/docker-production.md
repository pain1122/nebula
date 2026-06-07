# Production Docker Skeleton

Status: skeleton only
Created: 2026-06-03

This deployment path is meant to keep production packaging visible early, so Docker does not become an end-of-project trap.

## Goal

A target machine should eventually need only Docker plus a runtime env file:

```bash
cp .env.production.example .env.production
# edit secrets and URLs

docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

This is not the final production release process yet. It is a buildable deployment contract that should mature alongside the app.

## Current Shape

`docker-compose.prod.yml` defines:
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

The app image stage uses Alpine-based PHP to keep the runtime small and reduce OS package mirror lockups during local builds.

The parked `frontend/` CRA template is excluded from this production build context for now. It is not part of the current production runtime.

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

- Nginx checks `GET /healthz`.
- App checks `php-fpm -t`.
- MySQL checks `mysqladmin ping`.
- Redis checks `redis-cli ping`.

`/healthz` is intentionally database-free. It confirms Laravel boot and routing, while database and Redis health are checked by their own containers.

## Worker Profile

Queue and scheduler services are not started by default. Start them when needed:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile workers up -d
```

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
- parked frontend template unless it becomes the canonical built frontend

## Not Final Yet

Before real staging/production, finish or revisit:
- Phase 3 Sanctum cookie/session SPA settings.
- `APP_URL`, `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS`, and CORS strategy.
- Phase 5 booking/payment lifecycle correctness.
- backup/restore process for DB and uploads.
- TLS termination strategy.
- CI image build and smoke test.
- whether migrations run automatically or as a release step.
