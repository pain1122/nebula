# Authorized activity read foundation and remaining settings

October 14, 2026, Asia/Tehran. The user requests administration in checklist order and asks which settings remain. This slice prepares the first activity read contract under the existing approved activity scope; the panel page is still open.

## Before and after

Before: only bounded owner/support profile activity previews exist, without an admin activity reader. After: `GET /api/admin/activity` returns a bounded, private/no-store operational audit DTO with exact audit/subject-public-ID search, actor/role/category/action/risk filters, explicit paired Tehran dates, stable ascending/descending pagination and generated time. Defaults cover30 inclusive days; selected periods cap at90 days, pages1000 and page size100/default20. Activity reflects recorded business audits, not online presence, all clicks or comprehensive security telemetry.

Only known action/subject-type pairs, risks and outcomes are exposed. Unknown or mismatched records are excluded. Both doctor and administrative medical audit actions remain recognized. Credentials, private identity fields, clinical bodies, raw reasons/before-after payloads, route/IP/user-agent/correlation/session facts and saved actor-name snapshots are not resources. SQL selects only safe columns plus a boolean indicating that a reason is recorded; raw reason and payload columns are not fetched.

Admin authority/account state is read fresh before querying and current roles/state are checked again before returning data. Ordinary admins cannot discover other privileged User subjects; root subjects remain private to other roots. Privileged actor identities are masked when outside the viewer's authority, while safe business event metadata can remain visible. Deleted actors do not fall back to saved private snapshots. Existing patient/doctor ownership routes are unchanged.

## Verification and boundary

Final isolated UID33/network-none/read-only/masked-private SQLite tests: **31 tests /336 assertions**, including eight new activity tests and retained directory/profile contracts. Tests cover privacy, privileged subjects/actors, deleted actors, malformed filters, guest/non-admin denial, date midnights/bounds, stable pages, unknown/mismatched subject types, administrative medical events and authority revocation during a read. Scoped Pint and whitespace checks pass. Use `scripts/media/verify-admin-activity.ps1`; it accepts no overrides and preserves the guarded temporary storage/environment/cache/SQLite setup.

The initial read-only MySQL controller query returns27 visible current audit rows/20 selected rows with private fields absent. That checkpoint precedes the final subject-pair hardening and is preserved as historical evidence; the final source binding records a fresh read against the hardened controller separately. Direct MySQL controller checks do not establish live authenticated HTTP/admin-panel acceptance. Existing static admin747564b5/50 assets is unchanged, twelve services/idle worker/jobs0 and all original/protected fingerprints remain; no Compose/build, dependency/schema, setting save, business write, scanner operation or unrelated job consumption occurs.

Source/read-only evidence: [final binding](evidence/admin-activity-foundation-2026-10-14.json), [earlier MySQL checkpoint](evidence/admin-activity-mysql-2026-10-14.json). Next: wire the already approved `/panel/activity` page and EN/Farsi filters/native access/role refusal on a new accepted static artifact. The checklist's full activity connection remains open until that is accepted.

Rollback removes only this controller/test/runner and its single additive route through scoped source review; no data/schema rollback is needed. Existing audit writers and prior static rollback images remain unchanged. The route addition supersedes historical route-file source hashes, without changing existing route authorization or mutations.

## Settings inventory

The marketplace registry has five keys. Two are already wired into the root-only Upload limits page: `uploads.medical` and `uploads.public_media`; successful live audited save/reset remains a separate acceptance gate.

| Remaining registered key | Registry default and purpose | Current gap |
| --- | --- | --- |
| `booking.pending_hold_minutes` | 60 minutes; allowed5–180; pending unpaid slot hold | Booking currently reads `payments.hold_minutes`/`PAYMENT_HOLD_MINUTES`. General safe read/control and runtime binding remain. |
| `booking.default_timezone` | Asia/Tehran; validated timezone; fallback with supported scope hierarchy | Current booking uses the hospital timezone. General read/control and actual fallback consumption remain. |
| `payments.default_currency` | IRR; three uppercase letters; marketplace default | Bookings preserve the selected slot's currency. General read/control and appropriate future default consumption remain; existing priced/booked snapshots must not change. |

These keys have registry/resolver/storage and root/password/reason/audit write foundations. The current general settings GET exposes only the two upload keys. The three remaining settings need fresh authority/revision guards, safe current-value/default/scope reads, panel controls and effective runtime integration before they can be described as working settings.

Upload account/request count-byte quotas, throttling/concurrent admission, scanner/parser/storage/transport capacities and payment admission limits remain operator configuration. Exposing additional keys in the panel is a further bounded scope decision; this assessment neither implements it nor changes .env. Cross-device theme persistence was discussed after a misunderstanding and was not requested. Tenant report entitlement/settings and provider credentials are separate from this demo administration slice.

Sources: [registry](../../config/settings.php), [settings writes](../../app/Services/MarketplaceSettingService.php), [current settings GET](../../app/Http/Controllers/Api/Admin/PlatformPrimitiveController.php), [booking consumers](../../app/Services/BookingService.php), [operator payment limits](../../config/payments.php), [upload admission limits](../../config/medical_uploads.php).
