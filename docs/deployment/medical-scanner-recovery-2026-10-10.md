# Disposable offline scanner crash and socket recovery

October 10, 2026, Asia/Tehran. A new optional guarded sandbox accepts scanner crash/stale-socket/restart recovery from existing fresh official definitions, with no network or live scanner/updater interruption. The overdue demo remains the minimum business golden-flow priority; tests do not constitute full flow or release acceptance.

## Actual accepted sequence

`node scripts/media/verify-scanner-recovery.mjs` first checks the exact healthy live scanner/image and installed PHP image. It creates one uniquely named, nonce-label-owned local-driver **1 MiB tmpfs socket volume** plus two restricted disposable containers. The client holds the volume mounted while the daemon crashes, preserving a real stale socket for recovery rather than simulating a missing path. Neither container mounts the live scanner socket.

The daemon uses the pinned ClamAV 1.5.4 image and unchanged read-only clamd configuration, mounts the existing official definition volume **read-only**, runs UID100 with no capabilities/NNP/read-only root/network none/4 GiB no extra swap/one CPU/16 PIDs and a 200-second lifetime. It starts `clamd` directly under `timeout`; no FreshClam/update process exists in the sandbox. The PHP client uses UID33/read-only source-root-socket/no capabilities/NNP/network none/256 MiB no extra swap/half CPU/8 PIDs/64 MiB tmpfs/240-second lifetime, masking live private storage. Synthetic key/testing/SQLite memory/environment-path guards precede bootstrap. No database/schema/queue or medical files are initialized.

1. Offline cold start becomes healthy in **10.780s**. Actual clean/EICAR/checksum/freshness verdicts pass (0.039s), ClamAV1.5.4/definitions28148/date `2026-10-09T06:25:40Z`.
2. Only the owned disposable daemon receives **SIGKILL**, exits137/no OOM. The client confirms the same stale socket inode2 and actual adapter rejection/redacted failure (0.014s).
3. Restarting that same sandbox daemon, still offline and without an updater, recovers the stale socket and becomes healthy in **10.779s**. The socket inode becomes3; actual clean/EICAR/digest/freshness checks pass (0.046s).
4. The probe shifts only its own `App\\Services\\time()` lookup by172801 seconds. The real daemon VERSION is rejected as stale with a redacted failure (0.016s). No host/daemon clock or definition timestamp changes. Restoring the test-process offset permits final actual clean/EICAR acceptance (0.039s).
5. Exact live scanner ID/start/health/zero restarts remain unchanged. Identity/image/nonce-label guards fence cleanup of only the two disposable containers and socket volume; post-cleanup absence assertions pass. No prune, existing-volume deletion or Compose/build operation occurs.

The harness has a220-second outer command budget and two75-second readiness deadlines; cleanup remains permitted after the budget expires. PHP syntax/Pint/Node syntax and all three unsafe ordinary-app phase guards pass. Source hashes and sanitized runtime evidence are retained. Readonly live attachment/history/integrity/quarantine checks pass before/after; twelve required services, no standing worker, one open request/quarantined-unscanned file, zero jobs/reports, scanningfalse/private local/protected accounts remain intact.

## Meaning and remaining demo work

This accepts offline fresh-cache operation, actual sandbox daemon SIGKILL/stale-socket/restart recovery and caller fail-closed freshness enforcement while no updater is available. It does **not** interrupt/restart the deployed updater, reproduce a network transfer failure, age a running daemon for48 hours, or accept sustained/peak/large-file/HTTP uploads, lease expiry or durable upload-crash/orphan reconciliation. Keep those separately visible. A successful clone restart does not authorize standing-worker/live scanning activation.

Continue the existing PDF/JPEG/PNG medical golden flow within its accepted limits: dedicated worker acceptance/controlled activation, request/upload/eligible review/published outcome in the retained bilingual panel/File Manager, fixed questionnaire and final ordinary rehearsal. Larger video/ZIP/multipart foundations remain approved open work; no public SEO scope is added. No independent human expert review is claimed.

Optional repeat only for a relevant change:

```powershell
node scripts/media/verify-scanner-recovery.mjs
```

Rollback is to stop using this optional test-only runner. Production entrypoint/config/images/signature data, clinical files/state and existing volumes are unchanged. If a future failure prevents cleanup, inspect only the uniquely label-owned disposable resources; do not prune or touch the live scanner/other stacks.

Evidence: [offline recovery](evidence/medical-scanner-recovery-2026-10-10.json). Earlier [parser recovery](medical-parser-recovery-2026-10-09.md), [bounded failure](medical-scanner-failures-2026-10-09.md) and [worker](medical-scanner-acceptance-2026-10-09.md) gates remain separately preserved.
