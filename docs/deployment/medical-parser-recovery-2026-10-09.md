# Normal parser restart and remaining integration acceptance

October 9, 2026, Asia/Tehran. Operator restarts only content-parser with `--no-deps --timeout 10`. Post-restart actual validation and the three earlier engine integration cases pass. Live scanner, clinical history, quarantine and disabled-scanning/local-storage settings remain intact.

## Parser socket recovery

The same container `6fc0a95c` and pinned `c4809fae` image now start at `2026-10-09T19:34:50.764804027Z`, previously `14:42:03.812685841Z`. It runs UID33/read-only/no capabilities/no-new-privileges/network none/no ports, 512 MiB/no extra swap/one CPU/16 PIDs, with only the dedicated socket volume. No OOM/zero automatic restarts; no image/app/scanner/worker recreation. Scanner start remains `15:26:18.742684692Z`, healthy/zero restarts.

The socket inode changes 62438 -> 32563; the lock inode stays 297741. Both retain UID33/mode0600 and expected file types. No manual socket deletion/permission repair occurs. Inode changes support the observation but are not sufficient acceptance by themselves: new restricted clients actually scan and remotely parse the exact synthetic 1 MiB PDF after rebinding. The default capacity runner accepts all 3/4/8 operations with zero blocked, wall 0.091/0.142/0.203s. Snapshot immutability/new tampered-read rejection, clean/EICAR/freshness and recovery pass (baseline 0.100s/recovery 0.067s). Its unsaved models/files live only in tmpfs, with no database/schema/queue initialization.

This accepts a normal parser restart and fresh-client recovery. In-flight connection interruption, SIGKILL/crash, scanner restart and definition-update-outage recovery are separate open gates. No downtime/SLO claim is made.

## Three earlier actual integration cases

`MedicalScannerIntegrationTest.php` now bypasses project .env/cached configuration and validates effective synthetic SQLite/key before `RefreshDatabase`. Explicit rehearsal/testing/SQLite memory/empty DB_URL/key/storage/UID guards precede schema initialization. Content parsing is explicitly remote. The existing clean-case audit now also requires qpdf identity, and the unrelated default sentinel's complete row must be unchanged.

The new optional `verify-scanner-integration.ps1` refuses unready pinned scanner/parser before client creation. Its temporary PHP container has no network, read-only source/root/sockets, masked live private bytes, UID33/no capabilities/NNP/512 MiB no extra swap/one CPU/16 PIDs/96 MiB tmpfs. A 90-second deadline and mandatory runner-owned private JUnit completion artifact prevent exit-zero/missing/skipped tests from being counted as success. The artifact reader has no application bootstrap, rejects ordinary app context, non-regular/unowned/oversized files and XML DTDs, and parses with network access disabled.

Actual execution passes **3 tests / 17 assertions / zero skips or failures** in **7.433s** (JUnit suite 7.347292s), PHP peak 48.50 MiB:

- Clean real scan records checksum/version/remote-content audit, permits authorized synthetic download, preserves the complete default sentinel, and rejects later tampered bytes.
- Harmless EICAR test marker records infected and blocks download.
- Unavailable scanner socket retains quarantine, emits no scan-recorded audit, and returns the bounded redacted failure.

These use direct queue delivery in the test process and are distinct from the previously accepted two OS-worker cases. Only synthetic disposable SQLite/schema/roles/files/audits/queues are initialized; no live worker/job/schema is used. PHP syntax/Pint two files, PowerShell parsing and negative live-app bootstrap/artifact-reader guards pass. Optional repeat for a relevant change:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/verify-scanner-integration.ps1
```

## Preserved state and next scope

After both checks, readonly existing attachment/history/integrity/quarantine and upload admission pass. Twelve required services remain; disposable MySQL stays removed. Live request stays open, file quarantined/unscanned, zero jobs/reports, scanning false/private local, protected accounts unchanged, no standing worker. Source changes are test/runner-only, with no dependencies, production logic/configuration, live migrations/resets/credentials or signature changes. Rollback is to stop using the optional runner; retain production safeguards and all accepted historical evidence.

Next: plan isolated scanner-daemon restart/socket and definition-update-outage acceptance using fresh official definitions read-only and a separate synthetic socket, without disrupting the live updater or requesting extra definitions. Running-daemon aging, larger/peak/HTTP upload capacity, lease-expiry/crash/orphan reconciliation, standing-worker/live activation, multipart/File Manager/forms, questionnaire and full rehearsal remain open. Do not start the standing worker or relax freshness based on this parser gate. No independent human expert review is claimed.

Evidence: [parser recovery and integration](evidence/medical-parser-recovery-2026-10-09.json). [Pre-restart baseline](evidence/medical-sustained-capacity-2026-10-09.json) remains unchanged.
