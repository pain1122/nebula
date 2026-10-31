# Bounded medical demo worker

October 11, Asia/Tehran. This is the next approved golden-flow slice, not a general worker deployment. No new dependency, image build, migration, definition download or main `.env` edit.

## Current accepted checkpoint

Operator idle-worker startup and app-only producer activation are completed. Read-only runtime verification, one fresh ordinary patient PDF, exact encrypted job inspection and one real dedicated delivery pass. The new file is clean with normal upload/scan audits10/11; jobs are empty and the worker remains idle. Ordinary doctor review/draft/edit/publication/amendment and patient EN/FA outcome/history are accepted separately in [the medical flow report](demo-medical-flow-2026-10-11.md). Main .env has no scanning override and retains the default false rollback; the producer overlay enables actual dispatch. Historical pre-upload commands below deliberately refuse current state and must not be replayed.

## Historical preparation and verification

`docker-compose.scan-demo.yml` overrides only the existing profile-gated `scan-worker`: restart=no, 256 MiB memory with no extra swap, 0.5 CPU, 32 PIDs, UID33, read-only source/root/private reads and scanner/parser sockets, dropped capabilities, no-new-privileges, backend network only and no published port. Its startup command is **sleep infinity**, not queue consumption. Existing scanner/check services are not recreated or retried.

`docker-compose.scan-producer.yml` is the separately activated app overlay: exact accepted app image, dispatch=true and read-only scanner socket. It must be combined with the accepted content-client overlay. Removing it restores default dispatch=false; retain the content socket and all files/policies/audits/jobs. No automatically running worker accompanies producer activation.

`node scripts/media/verify-demo-worker-preflight.mjs` passes both composed definitions, installed pins, existing scanner/parser/check isolation, UID33 MySQL read-only checks, dedicated encrypted transactional queue contract, real clean/EICAR/digest/freshness and remote PDF validation. Current counts remain 2 requests/1 original quarantined file/0 reports/0 jobs, private local, app dispatch=false. ClamAV1.5.4/daily28148/date2026-10-09T06:25:40Z is fresh at this acceptance; this is not a new definition update. Initial Compose JSON memory assertions expected numbers, while this CLI returns strings; exact numeric bounds now normalize that representation. [Preflight evidence](evidence/demo-worker-preflight-2026-10-11.json).

## Operator step 1: idle worker only

The user's standing boundary reserves backend/scanner/worker Compose operations for the user; the earlier static-admin delegation does not cover this startup.

```powershell
Set-Location 'C:\Users\Pain\Desktop\work\checkupino'
node scripts/media/verify-demo-worker-preflight.mjs
if ($LASTEXITCODE -ne 0) { throw 'Medical worker preflight failed; stop here.' }
docker compose --project-name checkupino_scan --file docker-compose.scan.yml --file docker-compose.scan-demo.yml --profile worker config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Worker Compose configuration failed.' }
docker compose --project-name checkupino_scan --file docker-compose.scan.yml --file docker-compose.scan-demo.yml --profile worker up -d --no-deps --no-build --pull never scan-worker
if ($LASTEXITCODE -ne 0) { throw 'Idle medical worker startup failed.' }
Write-Host 'PASS: idle medical worker started; no jobs requested.'
```

After the operator confirms startup, run `node scripts/media/verify-demo-worker-preflight.mjs --worker-connected`. It additionally requires deployed worker pin, idle command, resource/swap/PID limits, socket ownership through actual scanner/parser acceptance, empty queue and disabled producer. No test job is enqueued or consumed.

The exact operator startup is also available as `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/start-demo-worker.ps1`. It resolves only this repository, refuses arguments and preserves the existing location. Source parsing and unsafe-argument refusal are checked without executing Compose startup.

## Connected worker accepted; operator step 2

Operator completes idle-only startup; `verify-demo-worker-preflight.mjs --worker-connected` passes the deployed pin, UID33/read-only/source/socket/network/capability controls, 256 MiB memory/no extra swap/0.5 CPU/32 PIDs/restart=no/idle command, fresh real clean/EICAR checks, remote PDF validation and MySQL read-only empty queue. Thirteen scoped services now run; no worker job was consumed, app dispatch remains false. [Connected runtime](evidence/demo-worker-connected-2026-10-11.json). This accepts the connected idle runtime, not a successful queued delivery.

App-only activation is prepared in `scripts/media/activate-demo-producer.ps1`: repeat connected-worker preflight; validate all three Compose files; recreate only app with no deps/build/pull and the exact current image; restart existing Nginx. Script syntax and unsafe-argument refusal pass without activation. Main `.env` is unchanged. The operator runs:

```powershell
Set-Location 'C:\Users\Pain\Desktop\work\checkupino'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/media/activate-demo-producer.ps1
if ($LASTEXITCODE -ne 0) { throw 'Producer activation failed; stop here.' }
```

Then the assistant runs `node scripts/media/verify-demo-producer.mjs`: same app pin, both read-only sockets, retained idle-worker limits, effective dispatch=true/private local, real fresh synthetic scan/remote parser, MySQL read-only exact pre-upload counts and all accepted medical/settings/booking/payment/outbox/protected/old-audit fingerprints, HTTP200/guest401. No upload/job/report acceptance is implied. Source syntax and override refusal pass; deployed producer acceptance is pending operator activation.

## Remaining delivery and rollback

Only after connected-worker acceptance, prepare the operator's app-only producer recreation with all three backend/content-client/producer files and an Nginx restart. Verify effective dispatch/local storage/fresh scanner/parser before an ordinary patient upload. A fresh synthetic PDF must target the browser-issued 512 KiB request; preserve the original quarantine. Inspect the encrypted queued job's exact new file/reservation binding before a separately guarded **one-job** `medical-scan` delivery. Never consume default/payment/notification queues, invoke the original 100-job profile command, requeue an old file, or set a verdict manually.

Successful live queue delivery and ordinary clinical actions are now accepted in the linked report and independent evidence. Source and real-engine preflight alone never establish that acceptance. The preflight deliberately refuses post-upload state; retain historical checkpoint scripts rather than weakening their guards.

Rollback: stop only the staged worker using the same project/files/profile and explicit `scan-worker` service. App producer rollback recreates only app without the producer overlay, preserving content-client and the existing image, then restarts Nginx and verifies dispatch=false. Do not use down/volumes/prune or delete queued/file/policy/audit history; quarantined work remains unavailable until ordinary accepted recovery.
