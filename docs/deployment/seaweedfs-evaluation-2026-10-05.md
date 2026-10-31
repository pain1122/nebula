# SeaweedFS Integration And Synthetic Evaluation

Started October 5, 2026 (Asia/Tehran) after the user resumed development toward [ADR-0002](../adr/ADR-0002-self-hosted-media-storage.md). This is the first storage integration slice; real antivirus, production encryption/availability and bilingual File Manager product wiring remain separate acceptance work.

## Implemented

- The existing `private` disk remains local by default. `MEDICAL_STORAGE_DRIVER=medical-s3` opts into a validated Laravel S3 adapter for SeaweedFS or AWS. Medical services keep their existing disk alias and canonical object keys; S3 does not inherit the local filesystem root as an object prefix.
- Medical credentials, bucket and endpoint have their own environment namespace. Configuration rejects public visibility/serving/URLs, missing credentials, example credentials, disabled certificate verification and endpoints containing userinfo, query strings or paths. HTTP requires explicit opt-in and local/testing environment; production/staging cannot enable it.
- SDK connect/read timeouts and retry count are bounded. No fallback to public or local storage occurs when the S3 adapter/configuration fails.
- `php artisan medical:storage-check` validates configuration without a network call. `--probe` explicitly writes one small synthetic object under `storage-checks/`, verifies bounded content and SHA-256, then deletes/verifies deletion. Failures do not print SDK exceptions, signed URLs or credentials; failed cleanup cannot produce a passing result.
- The Laravel Flysystem S3 dependency is installed and locked: adapter 3.35.3, AWS SDK 3.399.1, aws-crt-php 1.2.7, jmespath.php 2.9.2 and symfony/filesystem 7.4.18. The initial www-data install could not write root-owned vendor 0755; the user completed the locked install as its existing owner with scripts disabled. No permissions were changed. Application checks/tests run as www-data.

Source: `config/filesystems.php`, `app/Support/MedicalStorageConfiguration.php`, `app/Console/Commands/CheckMedicalStorage.php`, `app/Providers/AppServiceProvider.php`, environment examples, dependency files and focused tests.

## Deployed Synthetic Runtime

`docker-compose.media.yml` defines a separate `checkupino_media` project. Existing backend/admin definitions are unchanged. SeaweedFS 4.48 is pinned to the registry-verified linux/amd64 manifest digest `sha256:aba492e2a4e4c90bff795745e8e660affa1f09e7650f5981bd7bccd1a06cd931`.

| Service | Network | Persistent data | RAM limit |
| --- | --- | --- | --- |
| media-master | Internal medical_core | New media_master volume | 256 MiB |
| media-volume | Internal medical_core | New media_volume volume | 512 MiB |
| media-filer | Internal medical_core | New media_filer metadata volume | 512 MiB |
| media-s3 | Internal core plus existing backend network | Read-only generated identity config | 256 MiB |

No host ports are published. Only the S3 gateway is reachable from the existing backend network at `checkupino-media-s3:8333`; master/volume/filer services remain outside that network. IAM and unrelated catalogs are disabled, bucket auto-creation and recursive nonempty-bucket deletion are disabled, uploads/cache and container resources are bounded. The official entrypoint initializes its new data volume and drops to the seaweed user; root filesystems are read-only, extra capabilities are dropped and no-new-privileges is set. No healthcheck is claimed here: verify actual authenticated S3 operations after startup.

`scripts/media/prepare-evaluation.mjs` creates separate cryptographically generated bootstrap/application credentials in the ignored `.local/media-evaluation/` directory, without printing secrets or overwriting existing settings. The application identity has only the evaluation bucket's Read/Write/List/Tagging actions; the bootstrap identity is for operator bucket creation. There is no anonymous identity. Windows bind-mount permissions need separate production treatment; ignore rules and file modes are not a production secret-management acceptance.

`scripts/media/check-evaluation.mjs` passes credentials through PHP stdin, never process arguments or the live `.env`. `--config` validates evaluation configuration without a network call; `--probe` checks synthetic CRUD; `--bootstrap` creates the named empty evaluation bucket if absent, then runs the application-credential probe. `--security` uses the restricted synthetic helper to verify denied access, scoped credentials, captured streaming, tampering/missing objects and an unavailable loopback endpoint. Each run removes its generated object and disposable scope bucket; the named evaluation bucket remains empty. It rejects non-local runtime and any different bucket/endpoint. It does not save reservations or medical database rows, set scan verdicts, activate the live medical driver or run queue workers.

This initial evaluation uses internal HTTP and synthetic content only. No TLS, encrypted temp/data/backups, high availability or HIPAA readiness is accepted. Current medical files continue on the hardened private local disk until explicit deployment acceptance and activation. NebulaNV remains untouched.

## Verification

- Final expanded medical/storage suite: **60 tests / 435 assertions pass in 23.36 seconds**, as www-data with testing/SQLite :memory:/array cache/session and isolated test storage. This includes actual SeaweedFS/AWS adapter construction, effective request timeouts/certificate verification, bad configuration rejection, prior integrity tests and medical request/review/report/patient authorization coverage. AWS construction makes no cloud call and is not deployed AWS acceptance.
- A first actual-SDK assertion used getConfig('http'), which does not expose request defaults. It was corrected to inspect an unexecuted GetObject command's @http options; production configuration already passed through correctly.
- Final Pint check passes seven PHP files, including the runtime security helper. Node syntax, static YAML/credential checks and `git diff --check` pass.
- `scripts/media/validate-evaluation.mjs` parses YAML as www-data and verifies isolation, no published ports, image pin and generated credential scopes without printing secrets. Repeat secret preparation preserves existing files. Ignore checks cover both credential files.
- The user completed Compose validation/startup. Read-only runtime checks confirm all four services running with zero restarts, UID 1000, zero effective capabilities, no-new-privileges, read-only root filesystems, no published host ports and the exact intended networks. The core network is internal.
- Configuration, synthetic bucket bootstrap and private write/read/SHA-256/delete pass against deployed SeaweedFS using the real adapter and application credentials.
- Anonymous read/list/write/delete receive 403; authenticated bytes remain unchanged. Application bucket creation and read/list/write/deletion of a separate disposable bucket receive 403. Separate bootstrap credentials create/delete that disposable bucket only for the test.
- A 2 MiB synthetic object exercises real S3 streaming and temporary spooling. The captured original is delivered after the stored object is overwritten; newly opened changed or missing bytes fail verification. This is integrity acceptance, not structural PDF validation or antivirus acceptance.
- An intentionally unavailable loopback endpoint makes the probe fail with redacted output; no real service was stopped and no local fallback occurs. Generated test objects and the disposable scope bucket are removed.
- Backend/admin health endpoints both return 200; www-data Laravel connects to MySQL and Redis. Live private driver remains local and medical rows including archived remain zero. [Runtime evidence](evidence/seaweedfs-runtime-2026-10-05.json), [source/security evidence](evidence/seaweedfs-acceptance-2026-10-05.json).
- Composer validate passes. In-container Composer audit could not reach Packagist (timeout); it is not a passing full-project audit. A host-side official Packagist advisory query for the five additions succeeds: returned AWS SDK and JMESPath advisories do not affect the installed versions; the other three have no returned advisories. The install's unreachable-filter warning also remains recorded; this bounded check does not establish complete dependency security.
- PHP-FPM inspection confirms upload_max_filesize=2M, post_max_size=8M and memory_limit=128M. The application still permits 10 MiB; HTTP upload-limit alignment/measurement remains open. GD/Imagick are absent; image normalization is not implemented.

This accepts the bounded local synthetic S3 foundation. Actual scanner, encryption/backup/availability, medical activation and browser acceptance remain open.

## Completed User-Run Installation And Startup

The user completed the locked install as the existing vendor owner without changing permissions or running scripts:

```powershell
docker exec --user root --env COMPOSER_ALLOW_SUPERUSER=1 --env COMPOSER_HOME=/tmp/checkupino-media-composer-root checkupino_app composer install --no-interaction --no-scripts --no-progress
```

The user then validated and started the separate project using the already-prepared credentials:

```powershell
docker compose --project-name checkupino_media --file docker-compose.media.yml config --quiet
docker compose --project-name checkupino_media --file docker-compose.media.yml up -d
```

These commands create only the four new media services and their own volumes/network; the gateway joins the existing backend network. They do not recreate app/nginx/admin/db/Redis, bind host ports or touch hazelnut/NebulaNV. No volume deletion or migration is part of this handoff. Docker/long dependency operations remain user-run under the user's instructions.

Installation/startup do not need repeating. The reusable verification commands are:

```powershell
node scripts/media/check-evaluation.mjs --config
node scripts/media/check-evaluation.mjs --probe
node scripts/media/check-evaluation.mjs --security
node scripts/media/verify-runtime.mjs
```

Next is a concrete fail-closed scanner and dedicated scan queue, content treatment and aligned upload/concurrency limits. Medical activation remains gated on that work and the operational safeguards in the hardening report. There is no manual clean shortcut.
