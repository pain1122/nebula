# Checkupino production packaging and operations

Maintained: November 1, 2026. Start at [the build/deployment manual](BUILD_AND_DEPLOY.md) for platform requirements, fresh-demo setup and existing-data moves.

## Status and boundary

`docker-compose.prod.yml` builds immutable Laravel, API Nginx and React-panel images with persistent database/storage volumes. It is a **server packaging skeleton**, not acceptance of a full public clinical release. Current verified clinical/media operation uses the separate development-backend/parser/scanner topology. The production file has no parser/scanner socket mounts, no dedicated medical runtime and no S3 service. Do not enable production media/scanning by toggling flags alone or attach the local evaluation configuration without a reviewed server deployment package.

This guide gives executable core build/start/migration/provisioning steps and identifies the gates required before public traffic or clinical media activation. It does not turn the demo into a production release by running one Compose command.

## 1. Prepare the host and release

Use a supported Linux Docker host for server operation, with Compose v2 and sufficient disk/RAM. Record the Git SHA and build/image IDs. Build from a clean checkout with no old runtime data in its context; the production Dockerfile installs locked vendor and root Vite assets itself, so host PHP/Node/vendor are unnecessary. The separate admin Dockerfile supplies its own Node toolchain.

Use a new server or inspect the existing installation before changes. Do not run the development backend on the production host under the same ports. Choose the intended project explicitly: `checkupino_prod`. Do not expose MySQL/Redis to the public network; the production file gives them no host port mappings.

Copy `.env.production.example` to a new private `.env.production` without overwriting an existing file. Replace **all** placeholder domains, application/database/mail/storage/tenant secrets that apply. Do not copy the local fixture signing seed or known account credentials into production.

Required settings:

| Setting | Required handling |
| --- | --- |
| `APP_ENV`, `APP_DEBUG` | `production`, `false` |
| `APP_KEY` | New cryptographically random key for an empty installation; original key for a restore. Persist outside the image. |
| `APP_URL` | Real externally reachable HTTPS API origin, for example `https://api.your-domain.tld` |
| `ADMIN_API_BASE_URL` | Empty to derive APP_URL/api, or the exact reachable API base. Rebuild admin after a change. |
| `SEED_DEMO_DATA`, `DEMO_SANDBOX_PAYMENTS`, `DEMO_SEED_VERIFIED_MEDIA` | All `false` |
| DB / MySQL values | `DB_DATABASE=MYSQL_DATABASE`, `DB_USERNAME=MYSQL_USER`, `DB_PASSWORD=MYSQL_PASSWORD`; separate strong `MYSQL_ROOT_PASSWORD` |
| Session/CORS | Real admin hostname in `SANCTUM_STATEFUL_DOMAINS` (no scheme); exact HTTPS admin origin in `CORS_ALLOWED_ORIGINS`; appropriate shared cookie domain, `SESSION_SECURE_COOKIE=true`, HTTP-only cookies |
| `RUN_MIGRATIONS`, `CACHE_LARAVEL` | Start `false`; migrations are an explicit release step |
| Health/article flags | Default false until schema, authorization, retention and target-specific acceptance are complete. Enabling a flag does not provide missing production integration. |
| Media/publisher flags | Keep scanning, media/presentation, scheduling/publisher disabled until their production runtime gates are met. |
| Mail/provider credentials | Configure actual supported integrations and validate them; log mail and sandbox payments are not live delivery/settlement. |

Production `.env.production` should be owner-readable with tightly scoped access; Compose injects values into the container. Do not print the resolved environment or bake secrets into images. A new key can be generated with an already available PHP runtime using the key-generation command in the main manual, or with the newly built production image below; never change a restore's key.

The supplied service ports are API8080 and panel3000 by default. Put a reviewed TLS reverse proxy/firewall in front of them and restrict direct external access to the internal HTTP ports. Configure trusted proxy headers in Laravel for the actual proxy chain; the repository does not supply a universal TLS/DNS/proxy implementation. The chosen API/admin origins must reach the correct services, preserving `/panel/*`, assets, API and Sanctum cookies. Validate same-site/cross-origin behavior against the real domains. Do not treat a localhost cookie check as HTTPS release proof.

## 2. Validate and build

These single-line commands work with either shell. Check each exit status before continuing. Builds and dependency downloads are operator-run.

```text
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml config --quiet
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml build app nginx admin
```

Stages: `docker/prod/Dockerfile` builds production vendor/root assets, PHP8.3 with Redis/PDO/GD/qpdf and the Nginx public artifact; `frontend/Dockerfile` builds the React panel with its compiled API origin. Do not run `composer update`/`npm install` to bypass lockfile failures. Source builds need registry, OS package, GitHub/qpdf and Composer/npm access; Docker registry mirrors cover only the image registry portion.

For an AMD64 release on an ARM build machine, explicitly target `linux/amd64` using a reviewed local platform override or build the three Docker targets individually with `docker build --platform linux/amd64`. A native ARM production release has not been accepted. Retain immutable image IDs/registry digests and promote the same verified artifacts rather than rebuilding under an old release tag.

For a new independent installation with no existing key, the built default app image can generate one without starting Laravel or connecting to a database:

```text
docker run --rm --entrypoint php checkupino-app:local -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
```

If `CHECKUPINO_APP_IMAGE` overrides the default tag, use that built image instead. Privately set the output as `APP_KEY` in `.env.production` **before** starting app/dependencies. Do not use the example's replacement token or generate a key on an imported/existing installation.

## 3. Start core dependencies, then migrate explicitly

First-install commands only after inspecting an empty target:

```text
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-build db redis
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml ps
```

Wait for both dependency health checks. Then start only the app; its entrypoint prepares/chowns the persistent storage directories before launching PHP-FPM:

```text
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps --no-build app
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml exec --user 33:33 app php artisan tinker --execute="dump(app()->environment(), DB::connection()->getDriverName(), DB::selectOne('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()')->n);"
```

For the fresh path require `production`, `mysql`, zero tables. For an existing deployment stop here and follow the reviewed release/backup plan; do not reset it. Once the migration change is authorized:

```text
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml exec --user 33:33 app php artisan migrate --force
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml exec --user 33:33 app php artisan migrate:status
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml exec --user 33:33 app php artisan db:seed '--class=Database\Seeders\RolesSeeder' --force
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml exec --user 33:33 app php artisan db:seed '--class=Database\Seeders\PlatformPrimitiveSeeder' --force
```

Those two named seeders establish role/settings primitives, not demo users/health/articles/paid snapshots. Never enable the local populated demo seed in production. Create the real catalog through ordinary authorized administration rather than presenting synthetic medical services as production data.

## 4. Provision the first root account on an empty installation

There is no dedicated first-root operator command yet. Until that is delivered, use this **attended interactive bootstrap only on the empty new instance**, before exposing it. This creates an initial account; it must never update an existing credential or promote an existing user. No password appears in shell arguments/history. This procedure requires separate first-install operator verification; it has not been exercised on the existing laptop.

Start interactive Tinker:

```text
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml exec --user 33:33 app php artisan tinker
```

In Tinker, paste this entire closure. Local variables remain inside it and the only expression result is void: assigning a password in separate top-level Tinker expressions would echo its value and is deliberately avoided. Stop if any guard fails:

```php
(function (): void {
    if (! app()->environment('production') || App\Models\User::exists()) {
        throw new RuntimeException('Empty production user table required; do not replace or promote an existing account.');
    }
    $initialName = Laravel\Prompts\text('Initial root display name', required: true);
    $initialEmail = Laravel\Prompts\text('Initial root email', required: true);
    $initialPassword = Laravel\Prompts\password('Initial root password', required: true);
    validator(['name' => $initialName, 'email' => $initialEmail, 'password' => $initialPassword], [
        'name' => 'required|string|max:255', 'email' => 'required|email|max:255|unique:users,email',
        'password' => ['required', Illuminate\Validation\Rules\Password::min(12)->mixedCase()->numbers()->symbols()],
    ])->validate();
    DB::transaction(function () use ($initialName, $initialEmail, $initialPassword): void {
        if (App\Models\User::exists()) { throw new RuntimeException('Bootstrap already completed; stop.'); }
        $initialRoot = App\Models\User::create(['name' => $initialName, 'email' => $initialEmail,
            'password' => Illuminate\Support\Facades\Hash::make($initialPassword)]);
        $initialRoot->assignRole('root-admin');
    });
})();
```

Then type `exit`. The root is active under the model's existing default. No account is pre-marked email-verified; if verification is required by the deployed policy, complete the ordinary verification flow with working mail. Do not capture/share this interactive session or enter a literal password into an expression. Record the attended bootstrap actor/time privately. A dedicated audited/guarded bootstrap command, first-install rehearsal and operational account recovery remain server-release hardening, not a reason to run `LocalUsersSeeder` in production.

## 5. Start web surfaces and accept the deployed origins

```text
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps --no-build nginx admin
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml ps
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml exec --user 33:33 app php artisan tinker --execute="dump(DB::selectOne('SELECT 1 AS ok')->ok, Illuminate\Support\Facades\Redis::ping());"
```

Check API `/up` and `/healthz`, panel `/healthz` and `/panel/login`, protected-route refresh, missing-asset404, private-API guest refusal and actual credentialed HTTPS login/logout. PHP-FPM's syntax health check is not application/database/authorization proof. Inspect server logs privately and test actual UI/API behavior at both English/Farsi directions.

Do not start `--profile workers`. The production generic queue and scheduler can consume unrelated work; neither is the accepted dedicated medical runtime. Continuous medical delivery, bounded dedicated queue ownership/freshness/visibility/retry supervision and publication runner acceptance are separate release gates. Do not enable an automatic publisher because a scheduler container exists.

Configuration/view caching can be evaluated after the deployed environment is final. Do not run route caching while closure routes remain. Long-lived processes require an explicit restart plan after compatible config/code changes. Any deployment with a bind-mounted development checkout is the local-demo path, not the immutable production path above.

## 6. Finish before public clinical release

| Gate | What remains necessary |
| --- | --- |
| HTTPS/auth | DNS/TLS proxy and trusted-forwarding configuration; domain cookie/CORS/Sanctum and role/privacy acceptance |
| Private media | Production-isolated parser/scanner, socket UID/modes, application mounts, restricted storage, real current clean/infected/error/stale probes and content/integrity evidence; align proxy/Nginx/PHP transport bounds with server-owned file policy (the production PHP image does not currently copy the demo upload INI) |
| Workers | Dedicated exact queue topology, supervision, safe retries/duplicates/ambiguous delivery, retention and unrelated-job isolation; no general drain |
| Object storage | Accepted private TLS endpoints, separate medical/editorial credentials/buckets, migration policy and restore proof; local SeaweedFS evaluation is not production provisioning |
| First root/recovery | Attended first-install rehearsal, dedicated audited bootstrap/recovery tooling and secure credential handling |
| Providers | Actual email/payment/provider/refund integrations, secrets, callback verification and operational acceptance; sandbox snapshots are not settlement |
| Recovery | Coherent DB/original-key/private-file backups with checksums and an isolated restore test; durable storage capacity/retention monitoring |
| Release process | Reproducible promoted images, authorized migration review, rollback compatibility, secret handling, log redaction, target browser/accessibility checks |

These gates are explicit limits of current source, not tasks that this manual silently activates. [CURRENT_TASK.md](../../CURRENT_TASK.md) remains the product execution order.

## 7. Update, backup and rollback

Use explicit service names and the same release image/environment set. Record previous image digests, environment references and schema state; take/verify coherent DB/key/files backups before changes. Apply only reviewed migrations as an attended release step, recreate only changed services and verify role/runtime behavior before traffic resumes. For app recreation, restart Nginx if its upstream address is stale. Build the static panel again whenever its API origin or frontend source changes.

Named production volumes hold MySQL, Laravel storage and Redis data. Back them up with the matching environment/key and any external S3 objects. Do not copy live MySQL files as a substitute for a database-consistent backup. A binary-safe dump/restore and volume snapshot procedure must match the selected host/storage tooling; never pipe binary archives through PowerShell text redirection. Test restoration on a separate target with the original key and no workers.

Rollback normally selects the previous compatible immutable images/configuration and disables a feature while retaining additive data/history. Do not rotate the key, reseed, remove volumes or run down migrations on populated health/content/media tables. A data rollback requires a reviewed coherent restore and reconciliation of later writes.

The existing [production skeleton notes](docker-production.md) describe the underlying files; this guide and [the main installation manual](BUILD_AND_DEPLOY.md) own the current operator sequence. Laravel's [official deployment guidance](https://laravel.com/docs/12.x/deployment) supplies framework prerequisites; project-specific clinical release gates above remain additional requirements.
