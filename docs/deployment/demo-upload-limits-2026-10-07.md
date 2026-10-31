# Demo Upload Transport Limits

October 7, 2026, Asia/Tehran. The user resumes approved medical work while official scanner definition access remains blocked. This slice aligns the development backend's transport with the established medical file bound; it does not enable live scanning/storage or accept the engine/worker/UI workflow.

## Contract And Source

| Layer | Bound | Scope |
| --- | --- | --- |
| Nginx request body / PHP post body | 12 MiB | Whole request including multipart overhead |
| PHP uploaded file | 10 MiB | Matches existing medical file validation |
| Medical request/service / verified snapshot | 10 MiB | Existing ownership, quarantine and integrity unchanged |
| Scanner INSTREAM/file | 10 MiB | Existing source; actual engine acceptance remains open |
| PHP memory | 128 MiB | Preserved; no memory/concurrency tuning |

`docker/php/uploads.ini` supplies only file/body directives, mounted read-only into the existing app image by `docker-compose.yml`. `docker/nginx/default.conf` reduces the old 50M body cap to 12M. The additional 2 MiB permits multipart/form-field overhead without expanding the allowed file. Existing public-media validation remains 5 MiB. PHP parsing does not establish valid PDF/image content or an antivirus verdict. Quotas, upload throttling and concurrent reads/scans remain separate open work.

Only the development backend is targeted. The inactive production backend Dockerfile/Nginx configuration needs separate parity verification before deployment; it is not changed or accepted here. Static admin, scanner/check/media, image pins, .env and credentials are unchanged. App image remains `sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746`.

PHP requires post_max_size above the file cap; Nginx rejects an oversized body with HTTP 413. [PHP directives](https://www.php.net/manual/en/ini.core.php), [Nginx body limit](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size).

## Source Verification

- Focused file API/service/integrity suite: **21 tests / 121 assertions**, 25.838 seconds, 60.51 MiB peak PHPUnit memory. Runs as www-data with testing/SQLite :memory:, array cache/session, scanning disabled and isolated writable temporary storage; no live migration/upload.
- New real-byte fixtures verify exactly 10 MiB is quarantined with correct size/digest and one byte over is rejected with no storage/audit/queue writes. This exercises existing MIME/size validation, not structural PDF acceptance.
- Pint passes the touched PHP test; PHP syntax, parsed Compose/ini checks, Nginx configuration syntax, verifier JavaScript syntax and diff whitespace pass.

## User-Run Activation And Runtime Acceptance: Passed

The user completed the following app-only recreation and Nginx restart. Both services run with zero restarts; the app image is unchanged and the uploads.ini mount is read-only. These commands are completed history, not another pending activation:

```powershell
docker compose --project-name checkupino --file docker-compose.yml config --quiet
if ($LASTEXITCODE -eq 0) {
    docker compose --project-name checkupino --file docker-compose.yml up -d --no-deps --no-build --pull never app
    if ($LASTEXITCODE -eq 0) {
        docker compose --project-name checkupino --file docker-compose.yml restart nginx
    }
}
```

This activates only app/nginx and reuses the existing image. Compose remains user-run. Official scanner cooldown remains through October 8 at 20:37:34 Tehran; no scanner retry or worker start is part of activation.

`node scripts/media/verify-upload-limits.mjs` passes against the deployed development backend. It creates an ephemeral www-data PHP-FPM probe outside the public document root, sends synthetic multipart bytes through internal FastCGI and removes the probe in finally. The actual FPM worker runs UID 33, parses exactly 10,485,760 bytes successfully, returns UPLOAD_ERR_INI_SIZE for one byte over, and leaves files unparsed for a post one byte above 12 MiB. HTTP returns 401 for a guest multipart upload at the allowed file size and 413 for a body above 12 MiB. No authenticated upload, medical record write or scanner request occurs. [Runtime evidence](evidence/demo-upload-limits-runtime-2026-10-07.json).

The first private over-post probe emitted PHP's expected startup warning ahead of its JSON. The verifier now uses display_errors=0/log_errors=1 only for its synthetic FastCGI requests; global application configuration is unchanged. The full corrected verifier passes. Temporary probe removal is confirmed by a read-only /tmp inventory.

Both HTTP health endpoints return 200. Read-only Laravel verification as www-data confirms MySQL/Redis connectivity, scanning disabled/private local, zero medical files/requests/reports and zero medical/other database queue jobs. Scanner stays exited 17 with restart=no/zero restarts; checker remains running, with no worker started. Runtime acceptance is limited to the demo transport. Engine/worker, content validation, quotas/throttling/concurrency, production parity, bilingual Velzon File Manager and full pipeline remain open.
