# Bounded repeated capacity and parser restart preflight

October 9, 2026, Asia/Tehran. Operator removed only the disposable MySQL acceptance project. Read-only checks confirm its container and project network are absent; the twelve required live services remain. Earlier MySQL race and OOM evidence stays point-in-time, with cleanup completion recorded here. No live data or production configuration changed.

## Accepted repeated workload

The optional `-Sustained` mode uses the existing capacity runner's isolated PHP client and exact synthetic 1 MiB PDF. It offers two scan/remote-parse tasks and two verified reads per batch, with at least 0.5 seconds between batch starts, a 30-second target, at most 64 batches and a 75-second outer deadline. Every operation must pass. The original single-burst mode remains the default and also re-passes after this source change.

The run completes **60 batches / 240 accepted operations / zero blocked in 30.010 seconds**:

| Operation | Samples | p50 | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Real scan + remote qpdf parse | 120 | 0.075 s | 0.109 s | 0.112 s |
| Verified complete read | 120 | 0.007 s | 0.007 s | 0.009 s |

Percentiles use nearest rank across recorded, rounded operation seconds. Baseline scan/parse is 0.106s, post-tamper recovery 0.066s; parent PHP peak is 32 MiB, not aggregate daemon/child memory. ClamAV 1.5.4/definitions 28148/qpdf 12.4.2 identities pass. Previously verified snapshots stay immutable; new tampered-source reads reject; final real clean/EICAR/freshness checks pass.

Client boundary remains UID33/read-only source/root/socket mounts/no capabilities/no-new-privileges/network none/512 MiB no extra swap/one CPU/16 PIDs/96 MiB tmpfs with live private storage masked. Parent/children skip project .env/cache, use unsaved metadata and initialize no database/schema/queue. PHP syntax/Pint and PowerShell parsing pass; default and repeated modes refuse ordinary live-app context before bootstrap/writes. Default regression accepts all 3/4/8 operations, zero rejects, wall 0.081/0.122/0.203s. Live readonly attachment/history/integrity/quarantine checks pass before and afterward; open/quarantined file/request, zero jobs/reports, scanning false/private local and protected accounts persist. No standing worker.

Optional repeat, only for a relevant change:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-scanner-capacity.ps1 -Sustained
```

This is a short paced PDF sample, not engine saturation, long-duration soak, HTTP/upload/MySQL load, larger video/ZIP acceptance or a production SLO. Admission settings and scanner/parser limits are unchanged. Peak upload/large-file capacity, durable orphan/crash cleanup and definition-update-outage/deployed daemon recovery remain open.

## Parser-only restart — completed, historical preflight

Operator restart is now verified: same container/pin, changed start time, correct socket/lock UID/mode, and fresh clients pass real validation after rebinding. The three earlier guarded engine integration cases also pass 3 tests/17 assertions. [Actual recovery report](medical-parser-recovery-2026-10-09.md) supersedes the pending preflight below; retained baseline/measurements remain historical. Do not repeat this restart to reproduce the result.

Prepare one operator restart of the existing pinned parser, retaining its socket volume. Current real synthetic remote-validation baseline passes, UID33 socket/lock modes are 0600, and the live app has the read-only socket connection. Preflight records parser container `6fc0a95c`, image `c4809fae`, start `2026-10-09T14:42:03.812685841Z`, zero restarts; socket inode 62438/mtime 1791556924 and lock inode 297741. Source supervisor fences a stale owned socket with its exclusive lock; restart recovery itself is not yet accepted. Do not alter the socket manually.

Operator, from the project directory:

```powershell
docker compose --project-name checkupino_content --file docker-compose.content.yml restart --no-deps --timeout 10 content-parser
if ($LASTEXITCODE -ne 0) { throw 'Parser restart failed; stop here.' }
```

The installed Compose help confirms `--no-deps` prevents dependent-service restarts. This restarts only content-parser, with no init/app/scanner/worker/build/pull/definition request. It introduces a brief parser interruption while live scanning remains disabled. After operator output, inspect same container/image and changed start time, isolation/ownership/permissions, then run the default bounded probe and live readonly verifier once. Actual new clients must validate successfully after socket rebinding. Inode change alone is not an acceptance gate; reuse is possible. Do not claim in-flight interruption, crash/SIGKILL, scanner restart or update-outage acceptance from this planned normal restart.

Rollback: stop using the optional repeated probe; no production source/configuration changed. If parser restart fails, inspect sanitized runtime evidence and preserve fail-closed quarantine; do not restart unrelated services or manually remove/replace sockets.

Evidence: [repeated capacity and cleanup](evidence/medical-sustained-capacity-2026-10-09.json). Earlier [capacity/MySQL report](medical-capacity-2026-10-09.md) retains original measurements and history.
