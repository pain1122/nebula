# Bounded scanner failure and recovery checks

Later October 9 capacity slice hardens the PowerShell wrapper to require completed JSON evidence; an exit-zero Laravel exception is insufficient. All failure/stale-daemon probes pass again. Earlier evidence retains its accepted source hashes; current wrapper hash is recorded in [capacity evidence](evidence/medical-capacity-2026-10-09.json).

October 9, 2026, Asia/Tehran. Operator keeps the corrected VPN connected. This slice adds two optional rehearsal files, with no production service/configuration or dependency change. The accepted scanner remains healthy with daily 28148, zero restarts and no OOM. Twelve required containers remain running and no standing worker exists.

## Accepted behavior

`scripts/media/verify-scanner-failures.ps1` runs the accepted PHP image in a disposable UID-33, read-only, network-none container with caps dropped, no-new-privileges, 256 MiB memory/no extra swap, 0.5 CPU, eight PIDs and bounded tmpfs. Only the scanner socket is mounted read-only; live private bytes are masked. `probe-scanner-failures.php` requires explicit synthetic testing/SQLite-memory configuration and skips project environment/cache before bootstrap. It initializes no database/schema and consumes no queue. The main process has a 40-second deadline; forked gateways have eight seconds, bounded frames and deterministic cleanup.

The [official ClamD streaming protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html) supports size-bounded INSTREAM requests. A private disposable gateway permits only VERSION and the exact small synthetic fixture. It relays the real daemon's VERSION and sends a declared frame length one byte above the configured 10 MiB ceiling, with no large payload. The actual daemon returns a size-limit ERROR; the production adapter rejects it in 0.002 seconds with its generic redacted failure.

A second gateway obtains a real clean engine response and delays its delivery. With a test-only one-second client limit, the adapter rejects in **1.001 seconds**, within the asserted three-second outer tolerance. This verifies transport/deadline failure, not daemon CPU saturation.

A test-process-only namespaced clock injects positive/negative offsets around a real daemon VERSION response. The production freshness guard rejects stale and future ages without modifying the daemon/system clock, database files or timestamps. An absent disposable socket also rejects. Every rejected case returns no approved verdict and exposes no provider/path details. The initial and final real clean/EICAR probes pass; clean recovery also verifies the exact synthetic digest.

Separately, the same pinned scanner image runs a disposable daemon with its genuinely old bundled definitions, the existing read-only clamd config, no network and **no live definition/socket volume mounts**. It exits **1** with `Virus database is older than 2 days!`. A 15-second command deadline bounds the process; timeout/another error would not count as acceptance. This proves the daemon's stale-startup guard, distinct from the application clock injection. No bundled definition is downloaded, changed or copied into the live volume.

## Verification

The finalized runner passes all probes and explicit stale-daemon refusal. PHP syntax/Pint (one file), PowerShell parsing and a negative ordinary-app execution guard pass; that guard rejects before bootstrap, directory creation or scanner access. Readonly `node scripts/media/verify-attachment-api.mjs --verify-existing --scanner-ready` confirms unchanged protected/settings/booking/payment/outbox/audit history and private integrity. The existing request remains open and file quarantined/unscanned, jobs/reports zero, live scanning false/private driver local. Temporary gateways and containers are removed. [Evidence](evidence/medical-scanner-failures-2026-10-09.json).

Repeat only when a change requires it:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-scanner-failures.ps1
```

No build, pull, Compose, live migration, credential replacement, scanner restart or definition download is performed by this runner. The two earlier actual-worker cases and eight scripted worker cases retain their separate evidence; this probe tests adapter/runtime boundaries, not a live worker.

## Remaining scope and rollback

Next: bounded concurrent scan/read capacity, parallel MySQL upload/load, deployment-level socket/restart/update-outage recovery, and standing dedicated-worker acceptance before separately enabling live scanning. Genuine daemon compute saturation, aging while already running, and recovery after a real definition-update outage are not established by these probes. The three older guarded integration cases remain unexecuted. No human expert audit is claimed.

Rollback is to stop using the optional rehearsal runner; no production code/configuration/schema is modified. Existing pins, volumes, originals, history and stronger release/freshness safeguards remain intact. Do not introduce definition tampering, retry loops or manual clean states to finish remaining checks.
