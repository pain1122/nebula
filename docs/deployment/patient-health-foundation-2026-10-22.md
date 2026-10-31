# Patient health source foundation — October22

The user approved the [two-table source proposal](patient-health-foundation-proposal-2026-10-22.md), correcting current conditions/allergies to controlled taxonomies. This record covers source implementation and isolated acceptance only. The existing static panel remains the accepted October18 image; the new feature is disabled by default. No live migration, save, environment edit, build or service activation occurred.

## Delivered source

- `HealthCatalog` is the versioned server-owned source of bilingual condition/allergen IDs. Search and multiple selection submit IDs only. No free-text diagnoses, duplicate disease questions or label-based recommendation matching. Reported, none known, unknown, declined and missing remain distinct. An unavailable term can be reported without falsely asserting none. This small vocabulary is product data, not a clinically reviewed coding standard.
- Two additive tables hold encrypted append-only snapshots and height/weight observations. Each observation binds owner, metric, public ID, unit and measured date inside authenticated encryption. Snapshots bind owner/version. Existing account/legacy profile/medical tables are unchanged; registration's default DOB and legacy notes are not imported. Quantities are exact integer hundredths of kg/cm. Technical limits are 0.01–1000kg and 0.01–300cm, not clinical screening thresholds; Gregorian dates span1900 through today in Tehran.
- `GET/PUT /api/my/health-profile` expose only the active patient owner, with fresh locked role checks rejecting mixed staff roles. No target account or client-derived BMI/source/owner is accepted. Saves require recent password, confirmation, current catalog and expected revision. User-row serialization and unique patient/version protect first and later writes. Changed facts preserve their own assertion times; unchanged measurements do not become fresh. Corrections require the selected same-owner/same-metric observation. Explicit clearing preserves history. API history is bounded to the latest20 per metric and indicates truncation.
- Audits contain snapshot/version/schema/count metadata only. Payloads are hidden on model serialization. Unreadable keys/ciphertext, unsupported versions, invalid references and transaction failures refuse safely; no blank editable fallback or raw exception/SQL output. Both rollback checks run before either table can drop; populated history blocks migration down. Application rollback disables the feature and retains both tables/key/history.
- Existing `/panel/profile` mounts the new card for an own patient profile only. EN/Farsi form and summary use retained Velzon8/4 grid, searchable taxonomy checkboxes, explicit Gregorian date inputs/localized summaries, no preselected gender, kg/cm measurements, age/BMI estimate and dated history. Numeric input accepts Persian/Arabic digits with a decimal period. No clinical BMI category or recommendation is generated. Save/Cancel share a flex row. Drafts stay in component memory; the existing pending flag stores no health values. Fresh reads, recent-password coordination, ambiguous-delivery locking and abort/session guards are reused. Support/doctor/admin/root profiles do not request these contents.

## Source verification

- Network-none, read-only pinned PHP process, UID33, empty isolated environment and SQLite memory: **11 tests/126 assertions pass**. Covers taxonomy/extra-field refusal, dates/digits/quantities, encrypted persistence, owner-only access, missing/negative/unknown/declined, age/BMI without classification, append/clear/corrections, stale/duplicate/no-op, audit rollback, corrupt history and populated migration retention.
- Focused frontend `PatientHealth`, `UserProfile`, `ProfileOverview`: **41 tests pass**, including EN/Farsi edits/cancel, stable IDs, fresh-revision refusal, ambiguous delivery, account-change abort, foreign response refusal and no health fetch on support/staff/doctor profiles.
- Typecheck, affected-file lint, PHP Pint and quality ratchets are checked for this source candidate; see the accompanying source receipt for final results/bindings. No790-test replay or historical accepted writer was run.
- First PHP attempt hit the intended write throttle while batching invalid inputs. The test now advances synthetic time between quantity cases; the production limiter remains unchanged. One frontend mock typing/spread issue was corrected; no production workaround or relaxed checks.

Repeat the isolated PHP gate from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/health/test-source.ps1
if ($LASTEXITCODE -ne 0) { throw 'Health source gate failed.' }
```

Focused frontend commands, from `frontend`:

```powershell
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
npm.cmd exec -- vitest run src/test/PatientHealth.test.tsx src/test/UserProfile.test.tsx src/test/ProfileOverview.test.tsx
if ($LASTEXITCODE -ne 0) { throw 'Health UI tests failed.' }
```

## Next acceptance and activation sequence

October22 update: [eight-case health MySQL acceptance and cleanup](patient-health-mysql-2026-10-22.md) are now closed. Additional isolated contract/backup-restore gate passes6/61; original11/126 and frontend41 source remain accepted. The [concrete activation/rollback package](patient-health-activation-proposal-2026-10-22.md) is prepared; no live migration/flag/deployment/save is authorized or executed yet. Steps1/2 below are historical completed preparation/execution; continue with the package's live authorization and served-acceptance gates. Managed taxonomy editing retains its explicit backward-compatibility prerequisite in the later blog slice.

1. Prepare the bounded health-specific MySQL harness, reusing the accepted disposable admission guard. Prove simultaneous first saves and later measurement/fact saves serialize to one commit plus one stale refusal, audit failure rolls back, and fresh account/role revocation wins. Do not run the completed19-case clinical-writer harness against newly changed routes/audit hashes. Its historical receipt remains immutable.
2. Operator starts only the guarded disposable database when that harness is ready. Inspect health/pin/internal network/tmpfs/sole membership and empty schema first. Apply source migrations only there. Preserve failed evidence; never reset/replay a populated fixture automatically. Backend/database Compose ownership stays with the user; only the earlier final cleanup was delegated.
3. After MySQL acceptance, prepare a concrete separately approved live migration/feature activation and static-admin build/rollback plan. Source approval does **not** authorize running that plan. `PATIENT_HEALTH_ENABLED` defaults false; main `.env` is unchanged. Retain the existing encryption key, take appropriate backups, apply only the exact additive migration after inspection; never use refresh/fresh/reseed/reset. Verify effective runtime/schema before enabling controls. Missing or disabled schema returns503 without an editable empty record.
4. Verify served patient EN/Farsi1440/390px layout/accessibility and no health requests on support/staff/doctor pages. Use synthetic accounts and separately attended save acceptance; protected patients7/8 remain untouched. Preserve current two medical jobs, scanner cooldown/freshness and existing booking/payment/report history. No worker is needed for this health slice.
5. Then blog/article and taxonomy authoring/library contracts. Link resources to immutable health IDs, with versioned reviewed explanation rules. Broader taxonomy management, aliases/retirement, clinician access, article publication and recommendations remain subsequent slices; public SEO pages/new content-manager role are deferred.

No independent clinical expert review, served health UI or production readiness is claimed by this source gate. Subsequent MySQL concurrency acceptance is recorded separately above.
