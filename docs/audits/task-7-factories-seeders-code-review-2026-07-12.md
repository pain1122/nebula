# Task 7 Factories and Seeders Code Review

Date: 2026-07-12

## Outcome

Current Task item 7 is complete. The old single-doctor seed path was replaced by a repeatable marketplace graph and an independently executable minimal tenant-foundation fixture. No frontend source was changed in this task.

## Before

- `UserFactory` always populated `patient_status = free`, implicitly modeling staff and doctors as patients.
- `DatabaseSeeder` always created known-password accounts without an internal environment boundary.
- The doctor fixture wrote the removed `availability` JSON field, so it created no working-window rows.
- Services were attached through `DoctorProfile::checkups()`, now a read-only compatibility query rather than a writable pivot relation.
- There were no hospital/workplace schedules, settings/features, questionnaire graph, reservation/payment lifecycle, or tenant bootstrap fixtures.
- Several medical catalog strings were corrupted mojibake.

## After

### Credential boundary

- `config/demo.php` owns the local fixture switch and password.
- `DatabaseSeeder` always installs safe registries, but invokes demo fixtures only in `local` or `testing` when `SEED_DEMO_DATA` is enabled.
- `MarketplaceDemoSeeder`, `LocalUsersSeeder`, and `TenantFoundationSeeder` independently fail closed outside `local` or `testing`.
- `.env.production.example` disables demo data. No real environment file was changed.

### Factories

- `UserFactory` has explicit patient, doctor, admin, root-admin, active, suspended, and closed states. Its neutral state no longer assumes a patient lifecycle.
- Twenty-five domain factory files cover directory/listing requests, specialties, doctors/workplaces/windows, catalog, reservations/payment attempts, questionnaires/submissions/leads, private record metadata, rating options, audit, settings, features, and outbox records.
- Pure pivots intentionally have no factory classes; owning aggregate relations create them.
- `ReservationFactory` aligns its workplace with its doctor and attaches the selected checkup after creation.

### Foundation registries

`MarketplaceFoundationSeeder` composes four roles, five specialties, three categories, six checkups, three typed settings and values, four stable feature keys, and four rating options. This path has no known credentials.

### Marketplace demo graph

`MarketplaceDemoSeeder` creates:

- one root-admin, one admin, two doctors, and two patients
- three manually curated marketplace hospital directory entries
- two verified doctors with primary and secondary specialties
- three workplaces, including one doctor at two hospitals
- different service prices/durations and working windows per workplace
- one published versioned questionnaire with three questions, nine internally scored choices, and three internal recommendation ranges
- six reservation/payment states: live pending/unpaid, pending with a retryable failed attempt, confirmed/paid, completed/paid, cancelled, and expired

Payment fixtures use the `sandbox` provider. Each reservation owns one payment summary; provider retries are separate attempts.

### Minimal tenant fixture

`TenantFoundationSeeder` writes only through the `tenant` connection. It creates one installation, one singleton hospital profile, one tenant-local admin and `admin` role, one timezone setting/value, and one demo-signed `tenant.foundation` entitlement. It creates no marketplace directory, doctor workplace, reservation, payment, questionnaire, or other operational marketplace data.

## Why

Workplace is now the scheduling and service-eligibility boundary. A marketplace doctor can have different hours, prices, durations, and services at different directory hospitals without coupling hospital or tenant databases. Separating foundation and demo seeders also prevents fake accounts and transactions from becoming a production bootstrap side effect.

## Verification

- SQLite marketplace `migrate:fresh --seed`: passed.
- Marketplace repeat-seed relationship/count test: passed.
- Foundation factory smoke test: passed.
- Isolated tenant SQLite migrate plus two seed runs: passed; marketplace/booking tables absent.
- Marketplace MySQL fresh seed plus a second seed: passed.
- Isolated tenant MySQL migrate plus two seed runs: passed.
- Full backend suite: 96 tests, 539 assertions passed.
- Task-specific tests: 3 tests, 40 assertions passed.
- Pint source-directory check: passed.
- Route listing: 102 routes loaded.

The normal Docker database service could not bind Windows host port `3307`. MySQL verification used a temporary Compose database container on the project network without publishing that port; the container was removed afterward.

## Next boundary

Item 8 remains the broader foundation gate: lifecycle and constraint inspection plus ownership/IDOR, tenant mass-assignment, PII redaction, account/session revocation, CSRF/CORS, and the other listed security regressions.
