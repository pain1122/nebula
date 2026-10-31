# Admin reservation read contract

The user requests complete feature administration and reporting, including doctor/patient-specific filters and clinical read/administrative actions. [Coverage, concrete routes/composition and execution plan](admin-feature-coverage-proposal-2026-10-11.md). This first slice prepares the existing admin reservation API; it adds no panel screen or new permission.

## Changes

- Validate optional appointment/payment states, positive doctor-profile/patient/checkup/workplace IDs, query shape/length, pagination and sort parameter shapes. Malformed arrays, impossible/reversed dates and unsupported states return structured422 rather than conversion/server errors.
- Add workplace filtering; preserve existing doctor/patient/checkup/payment filters, related-text search, approved sort whitelist and existing response/pagination envelopes.
- Numeric search identifies the exact reservation ID; a full ULID identifies the exact public ID in either letter case. Other text searches existing patient name/email, doctor name/specialty and checkup title. Explicit IDs do not also wildcard-match unrelated names.
- Inclusive `from/to` dates mean **Asia/Tehran calendar days**, converted to half-open UTC bounds on `starts_at`. This corrects the previous UTC-column date comparison at the local day boundary and retains an indexable time predicate.
- Stable reservation-ID tie sorting prevents repeated/skipped rows when times/names/statuses tie across pages. The existing100-per-page cap remains.
- Add separate historical `booked_amount/booked_currency`, workplace ID/hospital snapshot, timezone/hold/completed/created dates and doctor's user ID. Existing catalog/payment fields remain for backward compatibility; future UI must use the booked snapshot for appointment value.

No lifecycle, canonical payment, medical-policy/authoring, user-role or mutation code is changed. Admin reschedule/root override services retain their existing authority. Clinical access/actions requested by the user are planned separately; current patient/doctor-only medical policies remain until that verified slice.

## Verification

Guarded network-none pinned runtime as UID33, read-only root/project, SQLite `:memory:`, disposable test storage, masked private storage and project dotenv/config bypass: **6 tests /104 assertions pass**. Tests cover actual API admin/root acceptance, guest/patient/doctor denial, unchanged reservations/payment/clinical/audit/outbox/jobs/settings on reads, sensitive-resource omissions, composed filters, exact-ID/text lookup, local-midnight boundaries, malformed inputs, snapshot preservation after catalog price changes, stable tied pagination and page cap.

Pint `--test` passes both source/test files; PowerShell runner AST parsing and controller diff whitespace pass. Ordinary source/API tests are separate from new deployed admin browser acceptance. A fresh read-only existing-demo gate verifies12 services/31 served assets/unchanged clinical/payment/audit/questionnaire/protected fingerprints/idle worker; scanner remains stopped/cooldown-held and no pipeline probe is attempted.

Source paths:

- `app/Http/Controllers/Api/AdminReservationController.php`
- `tests/Feature/Api/AdminReservationPanelContractTest.php`
- `scripts/verify-admin-reservations.ps1`

Re-run only when a relevant source change warrants it:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-admin-reservations.ps1
if ($LASTEXITCODE -ne 0) { throw 'Isolated admin reservation contract failed.' }
```

[Exclusive new proof/source hashes](evidence/admin-reservation-read-contract-2026-10-11.json). No old evidence is overwritten. The source is bind-mounted into the existing app; this does not establish ordinary authenticated live list/browser acceptance, and no source test is counted as a deployed UI.

## Next and rollback

Next: approve the proposed canonical admin routes/retained composition, wire the reservation list/detail/search/filter controls through the existing session transport, then verify source and actual deployed admin/root/role/ENFA/refresh behavior. Broader admin coverage remains tracked; neither this source foundation nor a menu is a complete admin feature.

Rollback reverses only this slice's added read validation/filter/response edits, preserving all unrelated dirty controller work, canonical lifecycle services and live history. Do not restore the whole file from HEAD, reset data or remove schema/credentials/images. The accepted static admin and complete golden-flow proofs remain unchanged.
