# Payment administration: read panel and adjustment boundary

The user approved both canonical payment URLs, navigation, retained card/table composition and the subsequent root-only request modal on October16. This slice delivers the read pages and hardens their existing server request boundary. The modal remains the next separately verified implementation slice under that approval; no repeat UX approval is needed.

| Before | After |
| --- | --- |
| Five accepted JSON readers; no payment panel entry. | Admin/root `/panel/payments` and public-ULID detail page, Product Admin entry, EN/Farsi and retained Velzon components. |
| Payment facts available only through API. | Server search, identity/currency/state/provider filters, quick presets, paired Tehran creation dates, stable paging and filter-preserving Back. |
| No composed payment detail. | Payment, reservation, people, review and canonical-attempt cards; separate attempt, request and event histories with independent filters/paging/reset/refresh. |
| Existing root request checked policy and reserved amounts. | Fresh active locked root authority, owner privacy, canonical consistency, exact integer bounds, actor-bound five-minute revision, explicit confirmation, duplicate/stale refusal and fail-closed atomic audit. |

Money remains exact strings in read DTOs/adapters and is displayed with its own currency. Reservation state, payment state, canonical consistency and pending requests remain separate facts. No combined-currency revenue is inferred. Callback bodies/references, idempotency keys, raw reasons, failure text, private identities and clinical contents remain excluded. Refresh errors clear stale detail/history; incomplete dates suspend dispatch.

The approved root modal is not wired in this image. Its server preview is `GET /api/admin/payments/{public_id}/adjustment-context`; normal admins cannot use it. The existing recent-password POST requires `expected_revision`, `expires_at`, `confirmed`, type, exact integer amount and reason. Unknown/client-owned financial fields are rejected. A void reserves the whole remaining amount. Pending/succeeded requests consume remaining capacity; failed requests release it; reconciliation or inconsistent history blocks another request. The payment-summary row serializes decisions before reservation/canonical-attempt/history checks. No request changes payment, attempt or reservation state, dispatches provider work or creates an outbox intent.

The read preview is advisory; the write repeats authority and state checks under locks. Existing internal service callers retain the original method signature through optional trailing revision arguments. The HTTP boundary deliberately fails closed for old callers missing the new guards. The response retains the original integer `amount` for compatibility and adds `amount_exact` plus `request_only`; the future modal must consume the exact string. Read histories add their parent `meta.payment_public_id` for client binding. No schema, dependency, environment, credential or provider changes.

Source verification passes 49 isolated PHP tests/859 assertions (read, adjustment, legacy-service and schedule contracts), scoped Pint8, full frontend66 files/647 tests, focused113, TypeScript/governed lint/fixtures/format, payment-page supplemental lint, unchanged quality ratchets and14 readiness safeguards. The initial full frontend run timed out in the retained Quill runtime test; its isolated rerun and unchanged full retry passed. No timeout was relaxed. Supplemental lint including the legacy route test exposed its existing conditional-expect rule outside the governed lint set; payment sources and the governed gate pass.

Runtime evidence is in `evidence/admin-payment-panel-static-2026-10-16.json` (57 served/container-byte assets), `admin-payment-panel-runtime-2026-10-16.json` (15 UID33 MySQL read-only checks, root preview, six actual guest401 refusals and Redis/HTTP), and the corresponding browser/pointer records. All pass: 11 retained browser groups/161 requests and19 payment pointer groups/150 requests, four desktop/390px mirror cases and eight viewport captures. These exercise admin/root ENFA filtering, independent histories, Back/reset/refresh, root-only preview and patient/doctor page/menu/API refusals. Both browser guards allow only GET/OPTIONS and login/logout; final clinical, financial, schedule/catalog and protected fingerprints match their baselines. Provider-event/adjustment hashes also match the earlier payment foundation. Historical evidence is retained rather than overwritten.

Accepted healthy image: `sha256:5d29af4872e7f75a0c8ba5e995515e42b8d10cc03a7dc0ad7f2ee182188bc232`, retained as `checkupino-admin:payment-read-accepted-2026-10-16`. Only static admin was built/recreated; dependency installation was cached. [Final source/runtime binding](evidence/admin-payment-panel-acceptance-2026-10-16.json) records the verified scope, retained prior artifacts and untouched financial lifecycle/policy sources. The immutable prior proof remains valid historical evidence; its intentionally extended controller/route/test/registry/context sources are superseded by this binding.

Current recovery is API-only: nine services run. Parser, scan-check, worker and scanner remain stopped; definitions are stale and current real engine proof is absent. Both app socket mounts and its image remain unchanged. Full12-service demo readiness is not established by this payment slice. No queue consumption, clinical download, live financial/admin save or completed-demo replay occurs. Positive live requests and genuinely concurrent MySQL adjustment acceptance remain open.

Rollback is static UI only: retain the accepted schedule image `checkupino-admin:schedule-controls-accepted-2026-10-15` and use `docker-compose.admin-payment-panel-rollback.yml`. Keep the new server guards; no data reversal or lifecycle shortcuts. From the project root:

```powershell
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-payment-panel-rollback.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Payment UI rollback configuration failed.' }
docker compose --project-name checkupino_prod --env-file .env.production --file docker-compose.prod.yml --file docker-compose.admin-payment-panel-rollback.yml up -d --no-deps --no-build --pull never admin
if ($LASTEXITCODE -ne 0) { throw 'Payment UI rollback failed.' }
```

Rollback is prepared, not executed. Source tests are repeatable through `scripts/media/verify-admin-payment-adjustment.ps1` and `npm.cmd run quality` in `frontend`. Live evidence helpers use exclusive writes and intentionally refuse to overwrite an accepted record; inspect the bound proof instead of replaying them.
