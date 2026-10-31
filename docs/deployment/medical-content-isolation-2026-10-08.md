# Medical Content Isolation and Recovery

October 8, 2026, Asia/Tehran. The user authorizes applying the nine admission defaults to the main `.env` and continuing parser isolation/recovery. Docker build/Compose operations remain user-run. This slice adds no dependency, migration, clinical write, scan enablement or general worker.

**Current acceptance:** the user-built isolation image `sha256:c4809fae4ab094ce353a28995fac698355ada6eab92f10e18ad874da2d2bbf4c` passes temporary boundary/native-parser checks and is pinned in Compose. The user starts the parser/init and attaches the private read-only socket to the existing app. Actual deployed controls and ordinary app remote-validation/tamper checks pass. Parser/init are running/exited-0 respectively; ten required services run. HTTP/MySQL/Redis, admission config and readonly protected/history/quarantine checks pass. App/check/worker/admin image pins are preserved, scanning false/private local, one request/quarantined file and zero jobs/reports. Scanner/CDN access and actual engine/worker acceptance remain open.

## Main environment

The main `.env` now explicitly contains the nine values documented in [upload admission](medical-upload-admission-2026-10-08.md): account 100 files/100 MiB, request 10 files/25 MiB, user/IP 10/30 requests per minute, four shared upload slots, 120-second leases and the existing shared database cache store. Each key was previously absent. Byte comparison after removing only the appended admission block confirms every unrelated original byte is unchanged. No secret contents or backup copy were emitted. Laravel's readonly admission verification passes with one request/quarantined file and zero reports/jobs.

Per-file settings, issued attachment rules, 10/12 MiB deployed transport, storage driver and scanning flag remain separate. These values do not activate large videos/ZIP or increase the transport ceiling. Removing just the new keys restores the same existing source defaults; preserve all other environment values and the admission/content guards.

## Boundary and protocol

Application and worker content validation now uses a private Unix socket. There is no inline native-parser fallback outside explicitly isolated `APP_ENV=testing` source tests. A missing/disconnected/stale/mismatched parser keeps access blocked. The existing app/check/worker image pins can remain unchanged because native qpdf/GD execution occurs in the separate parser image.

The parser image derives from the already accepted qpdf/GD image `a48b0c0b`; it installs nothing. A dedicated Dockerfile build allowlist copies vendor code and only the validator, policy/protocol, fixed policy and two parser scripts. It excludes the main `.env`, Laravel bootstrap, models, routes, application storage and patient records. The standalone supervisor does not boot Laravel or load deployment credentials.

The `checkupino_content` project contains a bounded socket-directory initializer and one parser. The parser runs as UID/GID 33 with no network, published ports, application mount, Docker socket or storage/database credentials. Root is read-only; capabilities are dropped; no-new-privileges is enforced; cgroup limits are 512 MiB, zero container swap allowance, one CPU and 16 processes. Temporary files use a bounded 128 MiB noexec/nosuid/nodev tmpfs. The initializer has only CHOWN/FOWNER capabilities, no network and access only to the dedicated socket volume. The application/check/worker mount that socket volume read-only. These controls follow [Docker's none network driver](https://docs.docker.com/engine/network/drivers/none/) and [container execution controls](https://docs.docker.com/reference/cli/docker/container/run/).

The socket directory is 0700 and socket/lease are 0600, owned by UID 33. Only explicitly connected containers have access. A strict canonical JSON header contains version, random nonce, exact bytes, MIME, SHA-256 and policy revision. It contains no file path, filename, actor ID or document text. Unknown/duplicate/noncanonical fields, unsupported types, over-10-MiB bodies, wrong revision, extra/truncated bytes, invalid checksums and malformed responses reject. Both sides bind success to the same nonce/bytes/MIME/checksum/revision and the accepted native validator identity. Requests have monotonic bounded I/O deadlines; the existing qpdf/GD process CPU/address-space/output/deadline limits remain enforced. Policy mismatch requires a reviewed compatible image/configuration update, never an automatic downgrade.

The server handles one request at a time and returns only minimal success facts. Rejections close the connection without parser diagnostics. Spools close/unlink in handled paths. A UID-owned exclusive kernel file lock fences supervisor startup/recovery: an active parser's socket is never removed; after a crash, only a stale socket owned by the parser UID can be replaced. Regular files, symlinks and another UID's paths are refused. This cleanup affects only the new parser socket, never ClamAV definitions/cooldown, uploads, cache locks or queue rows.

## Source, image and runtime acceptance

The expanded isolated real-parser/regression gate passes **222 tests / 1,121 assertions**, no skips, **61.970 seconds / 64.50 MiB**. Seven touched PHP files pass Pint. New coverage includes actual Unix-socket PDF/PNG/JPEG parsing, forbidden/malformed content, missing parser with installed native tools, production refusal of inline settings, strict identity/header/reply checks, tamper/extra/truncated bytes, rejection recovery, exclusive supervisor ownership, crash/stale-socket recovery, sentinel/symlink protection and expired I/O.

Parsed Compose/Dockerfile checks pass without assistant Compose operations. Readonly attachment integrity/history/protected checks pass. Ten required services now run, including the new parser; scanner/check remain stopped and the new initializer exited 0. App/admin/worker image pins are preserved. Source/test manifest: `evidence/content-isolation-source-2026-10-08.json`.

The accepted new image passes copied-source/vendor identity checks, UID/capabilities/no-new-privileges/no-network/no-secret/read-only controls, 512 MiB/16-process/zero-swap bounds, native PDF/PNG/JPEG, checksum-tamper rejection, successful subsequent requests and handled spool cleanup. The first verifier attempt exposed a missing hash-algorithm argument; it was fixed. The initial blank-page fixture omitted Resources and was rejected; matching the previously accepted valid synthetic fixture resolved it without relaxing parser checks. Windows-safe encoded PHP arguments and privacy-safe failure line numbers keep verification reviewable. [Temporary image evidence](evidence/content-isolation-image-2026-10-08.json).

After the user starts only the new parser project, actual container inspection and synthetic socket tests pass with the pinned image, dedicated socket-only volume, enforced security/resource controls, UID-33/0600 socket, checksum rejection and following success. After user-run app-only socket attachment/Nginx restart, the ordinary app environment successfully invokes `MedicalContentValidator` remotely while retaining its original image and read-only socket mount. These probes do not persist clinical content verdicts or create uploads/audits/jobs. [Parser runtime evidence](evidence/content-isolation-parser-runtime-2026-10-08.json), [app connection evidence](evidence/content-isolation-app-runtime-2026-10-08.json).

## User-run build and ordered activation

The user completed the following ordered operations from `C:\Users\Pain\Desktop\work\checkupino`. These commands are retained for review/recovery, not an outstanding request to repeat them. First, build only the isolation image:

```powershell
node scripts/media/validate-content-isolation.mjs
if ($LASTEXITCODE -eq 0) {
    docker build --pull=false --network none --file docker/medical-content/Dockerfile --tag checkupino-content-isolation:2026-10-08 .
}
```

After the result, the assistant runs `node scripts/media/verify-content-isolation.mjs`. It resolves the exact new image ID, checks copied source/vendor inventory hashes, and runs only temporary no-network/no-mount synthetic containers. It verifies UID, capabilities, no-new-privileges, read-only root, absent app secrets, memory/process/swap bounds, PDF/PNG/JPEG, checksum rejection, subsequent success and spool cleanup. It writes `evidence/content-isolation-image-2026-10-08.json`. A failed image probe blocks activation. The accepted new deployment image is now pinned before startup.

After image acceptance, the user starts only the new parser project:

```powershell
docker compose --project-name checkupino_content --file docker-compose.content.yml config --quiet
if ($LASTEXITCODE -eq 0) {
    docker compose --project-name checkupino_content --file docker-compose.content.yml up -d --no-build --pull never content-init content-parser
}
```

`node scripts/media/verify-content-runtime.mjs` verifies the new parser's actual controls and synthetic socket behavior before connecting the application. The user then attaches only the private socket volume to the existing backend app:

```powershell
docker compose --project-name checkupino --file docker-compose.yml --file docker-compose.content-client.yml config --quiet
if ($LASTEXITCODE -eq 0) {
    docker compose --project-name checkupino --file docker-compose.yml --file docker-compose.content-client.yml up -d --no-deps --no-build --pull never app
    if ($LASTEXITCODE -eq 0) {
        docker compose --project-name checkupino --file docker-compose.yml restart nginx
    }
}
```

The overlay must accompany future app recreations. Omitting it leaves parsing unavailable and release blocked. No backend image rebuild is required. After operator results, `node scripts/media/verify-content-runtime.mjs --app-connected`, `node scripts/media/verify-upload-admission.mjs` and `node scripts/media/verify-attachment-api.mjs --verify-existing` pass the app-to-parser protocol, admission defaults, HTTP/www-data MySQL/Redis and existing attachment/protected/history fingerprints. Scanning stays false/private local; the existing file is not marked parsed/clean or enqueued and audits are unchanged.

Scanner check/worker source also gains the read-only content socket mount. Starting scan-check without scanner/worker is possible only after the new socket volume exists, with a separately provided `up --no-deps` checker command. Do not start a worker or automatically restart the scanner as part of parser activation.

## Scanner recovery status

Readonly October 8 diagnosis confirms the existing scanner is stopped with exit 17, restart=no and zero restarts; scan-check is stopped with exit 131 and OOMKilled=false. Its last scanner log remains October 7 17:07:34 UTC: official incremental/full daily updates returned HTTP 403, correlation `a46e7f8d3e72dcc2-FRA`, cooldown until October 8 17:07:34 UTC (20:37:34 Tehran). No new definition request or engine probe ran. The cooldown has elapsed; successful access is still unestablished. The checker exit's cause is not established by its empty log/OOM flag.

The current [official support matrix](https://docs.clamav.net/faq/faq-eol.html) still lists 1.5.4 as the latest supported 1.5 patch. [FreshClam guidance](https://docs.clamav.net/faq/faq-freshclam.html) identifies explicit blocking, unsupported versions and download-method issues as possible 403 causes; the current runtime already uses supported FreshClam. The user confirms the outbound route has not changed since the denial and is unsure of its type.

Local inspection finds zero active VPN-like adapters and disabled Windows system proxy/PAC; these indicators do not prove the complete routing path. One bounded metadata-only HTTPS request to the official Cloudflare trace, from a temporary unprivileged read-only/no-mount container on the existing `checkupino_scan_definition_updates` network, reports **egress country IR and Cloudflare colo FRA**. It uses direct HTTP transport matching the current proxy-free FreshClam configuration. Docker daemon proxy hosts are internal Desktop plumbing, not proof of an external VPN/proxy. The public IP was received only in memory and neither emitted nor persisted. No ClamAV CDN endpoint/definition was requested, updater started, route changed or medical data sent. [Sanitized diagnosis evidence](evidence/scanner-egress-diagnosis-2026-10-08.json); repeat only explicitly with `node scripts/media/diagnose-scanner-egress.mjs` because it makes one external metadata request.

The measured region and prior 403 are consistent with network/regional blocking, which is an inference rather than a confirmed ClamAV denial rule. The Cisco crisis-support page linked by the updater currently discusses Russia/Belarus and does not establish an Iran-specific rule. ASN/shared-IP traffic and the exact denial reason remain unknown. Do not attribute the cause solely to timezone or disable freshness. No external issue/message was sent and no mirror/proxy/bypass was configured. Supported upstream/network access resolution remains the next scanner prerequisite; unchanged egress supplies no evidence that repeating the previous download will succeed.

Resolve the operator/upstream diagnosis before a controlled retry. Retain [the scanner recovery commands and safeguards](medical-scanner-2026-10-05.md). No retry loops, unofficial signature downloads, definition/cooldown deletion, freshness relaxation or implicit scan/storage activation. Fresh engine/clean/EICAR/error/timeout/staleness and dedicated worker acceptance remain open. Targeted file/job reconciliation requires accepted parser/engine prerequisites and an explicit file-bound audited plan; do not consume unrelated jobs or reset quarantine manually.

## Limits and rollback

- This is a container boundary using the shared Docker kernel, not a VM or complete exploit-proof sandbox. The trusted supervisor shares the container with native child processes; per-document container replacement and deeper syscall/filesystem isolation remain future hardening.
- The server is serial. Peak queueing, concurrent app/check/worker requests, latency and real MySQL upload races still need acceptance. Native parse deadlines do not establish a hard deadline for every kernel/storage operation.
- Tmpfs and zero container swap allowance do not establish host/VM memory encryption. Real-patient spool/storage/backup encryption and release gates remain open.
- Persistent separate content-state/reprocessing history, sanitized metadata/previews, durable orphan/disposal recovery and multipart capacity remain open. A crash can leave a temporary file in tmpfs until container replacement; normal stale-socket recovery does not silently delete arbitrary spools.
- On rollback, preserve the remote mandatory release gate, admission safeguards, policy/audit history and existing quarantine. A missing parser must block release. Restore a compatible accepted parser image/socket connection or pause processing; never fall back to native parsing in the application or manually mark files clean.
