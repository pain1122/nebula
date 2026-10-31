# Reservation detail controls — October 13

The user explicitly selects the existing CURRENT_TASK reservation reschedule/root-override control item. Its routes/composition and the same static-admin deployment sequence are already approved. No repeated design/deployment permission is required.

| Before | Accepted deployed result |
| --- | --- |
| Reservation detail shows boxes and read-only information. | Retained detail adds reschedule and root-only status controls with normal dialogs. |
| Backend action revision and real-slot reader are accepted but unused by the page. | Date-bounded paginated real-slot selection and only server-permitted root states are connected. |
| No UI delivery path for these administrative actions. | Exact reason/revision payloads, explicit confirmation, fresh preflight reads, recent password, cancellation/session abort and uncertain-result refresh guards. |

## Source acceptance

Full frontend **61 files / 511 tests**, dedicated controls19 plus existing reservation15, TypeScript/governed and supplemental page lint/fixtures/format/unchanged quality ratchets pass. The existing Quill timing failure occurred once in the first full run; its unchanged isolated case and the final full gate pass, without timeout changes. Fourteen readiness safeguards pass. All13 accepted backend foundation sources remain byte-identical; no schema/dependency/backend/environment change.

The shared transport/query/session boundaries remain. Existing reservation detail accepts nullable action metadata for rollback; missing metadata disables controls. Root override is omitted for ordinary admins and uses only current server-provided states. Slot output is validated for subject/revision/booked money/timezone/page/unique public IDs and duration/times. Selected slot/status and reason are explicit; native controls contain no client-owned time/price/payment override payload.

Fresh detail and slot availability are rechecked before PUT and again after ordinary password confirmation. Known423 permits only the existing coordinator's one confirmation retry. Stale detail/selection409 and ambiguous delivered results lock controls until explicit fresh read. Cancellation before delivery aborts reads and ignores late results. Cancellation after delivery reports uncertainty rather than success. Identity/role changes and unmount abort requests; keyed subject/session state prevents draft reuse. Successful mocked saves invalidate reservation queries and retain visible acknowledgment. Real positive saves stay separate; never replay the completed demo.

## Deployment and rollback

Only the previously delegated static admin sequence is used:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Admin configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml build admin
if ($LASTEXITCODE -ne 0) { throw 'Admin build failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Admin recreation failed.' }
```

The prior accepted profile image remains `checkupino-admin:user-profile-accepted-2026-10-13` / `f6a0de92`. The new `docker-compose.reservation-controls-admin-rollback.yml` overrides only static admin to that retained tag; quiet configuration validation passes. Rollback has not been executed, and does not revert backend safeguards or any data.

## Served acceptance

- Static admin built from cached dependencies, Vite5.68s, recreated alone and healthy on **66ffd5a7**, retained as `checkupino-admin:reservation-controls-accepted-2026-10-13`. All50 served/container assets match; lazy CSS, refresh/origin/compression/cache/404 pass.
- Retained11-group admin/root/patient/doctor clinical/questionnaire read/refusal rehearsal passes on this exact candidate.
- Fifteen actual mouse groups/64 API requests pass: admin2/root1 EN/Farsi completed8 disabled, existing synthetic patient4 reservation3 real-slot/booked-money/native selection/unsaved reason/cancel/refresh, only server-permitted root states/explicit confirmation/cancel, validated Back filters, two desktop/390px mirror measurements and six captures. Two actual same-offering replacement slots are available; live UID33 read-only MySQL query also confirms them. Neither reservation is saved or completed.
- Real mouse input reaches the controls with the normal customizer/activity-drawer dismissal; English/Farsi390px modal and desktop captures were inspected. No runtime exceptions, external requests, blocked business request attempts, password confirmation or downloads occur. Original completed/protected hashes match before/after; twelve services/both sockets/idle worker/jobs0 remain. Scanner/current-probe gate remains separately open.

The initial pointer attempt passed retained profile interactions, then stopped before the new controls on the fixture home activity drawer. Its failed proof is preserved with unchanged hashes and zero business requests; normal drawer dismissal was corrected and the next attempt focused on the new reservation scope. A borrowed old profile description remained in that successful raw proof's scope field; [the scoped immutable projection](evidence/reservation-controls-pointer-scoped-2026-10-13.json) corrects description only and hashes the original unchanged proof. Actual checks/results/captures are preserved; no broader profile pointer coverage is inferred from that projection. The verifier's description is corrected for future reference.

Final [source/runtime binding](evidence/reservation-controls-acceptance-2026-10-13.json) binds25 sources including all13 unchanged backend foundation files and every referenced accepted asset/browser/capture proof. No positive live save, new concurrent MySQL write acceptance, protected-account mutation or completed-demo replay is included. The selected UI/read-only task item is accepted; successful live administration remains a separate checklist gate.
