# Foundation Shared Primitives Contract

Snapshot date: 2026-07-12

Status: target engineering contract for migration mapping and baseline implementation.

Depends on: `docs/architecture/foundation-target-domain-and-ownership-contract.md`.

Scope rule: marketplace primitives are implemented for the main product now. Tenant primitives are implemented only as a minimal separate-schema/profile/local-authority/entitlement/audit skeleton; complete tenant feature workflows remain Phase 7.

## Shared Without Runtime Coupling

The marketplace and tenant hospital applications reuse conventions and maintained code/schema definitions where useful, but they do not share operational rows or perform cross-database joins.

- Marketplace requests use the marketplace database.
- A tenant website uses only its configured hospital database.
- Shared primitives mean consistent lifecycle/security/API behavior, not a shared patient or reservation store.
- Marketplace-only structures are excluded from the tenant schema.
- Tenant-specific medical/privacy structures may exist only in the tenant schema until the marketplace needs the same workflow explicitly.

## General Conventions

- Bigint local primary keys; ULID public IDs for APIs and stable references.
- UTC timestamps plus IANA timezone on marketplace hospital directory profiles and tenant hospital settings.
- Integer minor-unit money plus ISO 4217 currency; never floating point.
- PHP backed enums plus request validation for lifecycles.
- Explicit archive/close transitions instead of ordinary physical deletes.
- Actor, reason, timestamp, and audit event for high-authority changes.
- No ownership IDs, status fields, disk paths, scan states, or provider states accepted through broad mass assignment.

## Data Classification

| Class | Examples | Rule |
| --- | --- | --- |
| Public | hospital directory profile, published doctor bio, service title | Explicit public resources only |
| Internal | settings, provider name, operational status | Authenticated and policy-scoped |
| PII | name, phone, email, NID, address | Remains in the owning marketplace or tenant database; redact from unnecessary responses/logs |
| Medical/sensitive | medical profile, questionnaire result, notes, files, reports | Private storage and least-privilege audited access |
| Secret | passwords, tokens, provider keys, tenant DB credentials | Hash/encrypt or external secret store; never audit/settings payloads |

## Marketplace Hospital Directory Primitive

Marketplace-only records:

- `marketplace_hospitals`: public ID, name, slug, location/contact/public profile, media, active/archive state, filter metadata, timestamps
- `hospital_listing_requests`: requesting doctor, proposed hospital data, evidence/notes, review status, reviewer/reason/timestamps
- `doctor_workplaces`: doctor profile, marketplace hospital, state, display/booking metadata, timestamps
- `doctor_workplace_services`: workplace, service/checkup, local price/duration override if allowed, active state
- `doctor_working_windows`: workplace, weekday/date rules, start/end, slot/duration/buffer policy, effective window, active state

Rules:

- Hospital directory profiles are administered only by marketplace admins; no hospital-admin ownership exists.
- Existing hospital selection creates a doctor-workplace association.
- Missing hospitals use listing requests; approval creates a directory profile, not a tenant.
- Unique active doctor/hospital workplace association prevents duplicates.
- Service and schedule queries begin from `doctor_workplaces`, enabling filters by hospital, skill/specialty, service, price, and availability.
- Archiving a hospital/workplace disables new availability but preserves reservation snapshots/history.

## Tenant Hospital Profile Primitive

Tenant-only records/configuration:

- one local hospital/site profile with branding, locale, timezone, currency, contact, and public website settings
- local admins, doctors, patients, specialties, services, schedules, reservations, payments, and medical workflows

Rules:

- No marketplace hospital directory table or doctor-workplace selector is required in a tenant schema.
- Local doctors are implicitly attached to the current hospital.
- Tenant admins and doctors are local identities/roles.
- The tenant application never accepts a tenant/hospital ownership ID from clients; ownership is implicit in the deployed database.

## Tenant Instance Monitoring Primitive

Marketplace monitoring records are not marketplace hospital directory ownership and not tenant business data.

Suggested marketplace-only records:

- `tenant_instances`: public ID, display label, domain, state, plan/subscription, feature-set version, app/schema version
- `tenant_health_snapshots`: tenant instance, heartbeat time, component statuses, sanitized error fingerprints, aggregate counters
- `tenant_feature_overrides`: tenant instance, feature key, enabled/disabled, reason, actor, expiry

Rules:

- An optional nullable link may associate a tenant instance with a marketplace directory hospital for display only.
- Health ingestion uses signed machine credentials/keys stored as secret references.
- No patient, reservation, payment transaction, questionnaire answer, or medical payload is accepted by monitoring endpoints.
- Monitoring access does not grant tenant-database access.
- Future support access is a separate time-limited/audited capability, not part of monitoring.

## Identity, Authority, and Account State

Marketplace and tenant databases each own their own users, sessions, tokens, roles, and permissions.

Account states:

- `active`: normal policy access
- `suspended`: deny access and revoke all sessions/tokens immediately
- `closed`: permanently deny login, revoke sessions/tokens, archive identity/history

Marketplace authority:

- `root-admin` alone manages admin-level identities/authority.
- `admin` manages allowed marketplace product data, including hospital directory records.
- No marketplace role represents a tenant hospital admin.

Tenant authority:

- local tenant admins manage that hospital's allowed product data
- local doctors/patients are restricted by local policy and ownership
- no marketplace role/ID grants tenant access

Revocation service requirements:

- revoke all Sanctum tokens for suspended/closed users
- invalidate Redis/database sessions through a stable user-session index
- queued jobs recheck account state at execution time
- account-state mutation, revocation intent, reason, and audit are transactional where possible

## Scoped Settings and Entitlements

Settings use a registry: key, group, value type, validation/default metadata, sensitivity class, and allowed scope.

Marketplace scopes:

- marketplace/platform
- marketplace site
- marketplace user preference

Tenant scopes are local to the tenant database:

- hospital/site
- local user preference

Rules:

- Unknown keys fail validation.
- Secrets are external references, not plaintext setting values.
- Tenant subscription/feature entitlement is monitored/configured from marketplace metadata, but the tenant application enforces a signed/cached effective feature set locally and fails closed when invalid/expired.
- Settings cannot enable a feature denied by entitlement.

Reserved groups include branding, localization, booking, payment provider, email/SMS/push, mobile release/maintenance, content, commerce, and integration references.

## Audit and Step-Up

Marketplace and every tenant maintain their own audit events.

Common fields:

- public ID and optional batch ID
- actor public/local ID and minimal display snapshot
- action/risk, subject type/public ID, reason/outcome
- sanitized before/after metadata
- route/request correlation ID, IP, user agent, created timestamp

Rules:

- Marketplace audit covers marketplace authority/product mutations and tenant monitoring/subscription/feature changes.
- Tenant audit covers only that hospital's mutations and sensitive access.
- Audit rows are never synchronized automatically between marketplace and tenants.
- Redaction is recursive/allowlist-based for sensitive subjects.
- Privileged mutation and audit write share the owning database transaction and fail closed.
- Step-up is session-backed and time-limited; bearer-only step-up needs a separately approved flow.

## Media and Private Files

Public media and private medical files use separate records/disks/policies in the owning product database/storage.

Metadata includes public ID, attachment owner, disk/provider, opaque path, safe/original filename, MIME, extension, size, checksum, uploader, classification, scan state, and retention/archive timestamps.

Medical rules:

- private storage namespace/account
- MIME/extension/size/checksum validation
- quarantine until malware scan passes
- policy-protected streaming or short-lived signed download
- access/download/archive audit events
- never served through public `/storage`
- clients cannot mass-assign disk/path/scan/retention state

## API and Serialization

Canonical envelope:

- success: `success`, `message`, `data`, optional `meta`
- error: `success=false`, `message`, stable `code`, optional field `errors`, correlation ID

Rules:

- Form Requests/DTOs define writes; API Resources define reads.
- Public IDs appear in URLs.
- Marketplace APIs cannot accept tenant-instance IDs as reservation ownership.
- Tenant API ownership is implicit in its deployment/database and cannot be client-selected.
- ISO 8601 dates/timezones, `{amount, currency}` money, stable string enums, and allowlisted pagination/filter/sort.
- Public questionnaire definitions hide each choice's score, recommendation thresholds/conditions, guest tokens, and internal metadata. A completed submission may return an explicitly approved user-facing total score and recommendation, but never the per-answer scoring map or internal recommendation rules.
- Admin list resources expose only fields needed for that screen; admin role does not imply automatic NID/medical/full-answer exposure.
- API versioning begins before independently deployed mobile/public clients.

## Reservation Hold and Scheduling

Shared reservation fields:

- public ID, local patient/doctor/service references
- status, starts/ends/duration/timezone
- `hold_expires_at`
- immutable hospital/workplace/doctor/service/price/currency snapshots appropriate to the product context
- created/updated/archive timestamps

Marketplace reservation additionally references a `doctor_workplace`; tenant reservation does not need a selectable hospital/workplace FK because the hospital is implicit.

Blocking statuses are `pending` while the unpaid one-hour hold is live and `confirmed`. Cancelled, expired, and past completed appointments do not block new availability beyond their occupied interval.

Schedule history stores previous/new start, end, duration, doctor, and—on marketplace only—workplace, plus actor/reason/time.

Marketplace working windows belong to doctor workplaces. Tenant working windows belong directly to local doctors. The same marketplace doctor can define different schedules per marketplace hospital without any tenant-database query.

An idempotent job expires overdue holds, while booking/payment callback paths also check expiry synchronously.

Hold-abuse controls must include authenticated-user/device/IP throttling, a cap on concurrent active holds, idempotent booking keys, and cleanup metrics. A client cannot extend a hold indefinitely by starting repeated payment attempts.

## Payment Attempts

Each owning database separates reservation payment summary, payment attempts, provider event receipts, and refunds/voids/adjustments.

Attempt fields: public ID, reservation, provider/reference, idempotency key, amount/currency, status, failure code/message, initiated/expires/completed times, sanitized metadata.

Rules:

- Multiple attempts before the one-hour hold expires.
- Unique provider reference/idempotency constraints.
- Locked transaction confirms canonical payment and reservation only if hold/slot remains valid.
- At most one canonical success.
- Append-only verified provider events without secrets.
- Manual override is root-admin-only in marketplace; tenant override authority is local policy, step-up, reason, and audit.

## Notifications and Integrations

- Typed domain events occur only after successful transitions.
- An outbox in the owning database stores minimal sanitized payload, delivery state, attempts, and availability time.
- Marketplace and tenant outboxes are independent.
- Email/SMS/push/payment adapters are idempotent and provider callbacks have unique external IDs.
- Sensitive medical content is excluded from normal notification bodies unless explicitly approved.

## Future Extension Points

- Blogs/content reuse media, locale, publication state, audit, and the owning product context.
- Commerce reuses money, payment attempts, idempotency, archive rules, and immutable order snapshots; commerce payment summaries remain distinct from reservation payments.
- Mobile reuses versioned APIs, token abilities, account scope, settings, device/push ownership, maintenance state, and outbox.
- Tenant features remain tenant-local even when entitlement/health is monitored centrally.

## Baseline Verification

Phase 1:

- marketplace schema and minimal tenant-foundation schema independently fresh-migrate, seed, rollback, and reapply on SQLite/MySQL
- marketplace hospital/workplace filters and schedule ownership are tested
- minimal tenant tests prove a separate database, implicit hospital profile, local authority bootstrap, entitlement contract, audit/outbox base, and absence of marketplace directory/workplace tables
- no marketplace hospital-admin role or tenant-membership authorization path exists
- monitoring endpoints reject patient/reservation/payment/submission/medical payloads
- marketplace identities cannot authenticate to tenant routes/databases by implication
- tenant applications cannot select or query another tenant database
- suspended/closed users lose sessions/tokens in their owning application
- marketplace hold expiry, payment retry/idempotency, hold-abuse limits, and cross-workplace schedule conflict behavior pass
- resource/redaction, audit redaction, and private-file quarantine/authorization tests pass

Phase 7 adds complete tenant doctor/schedule/reservation/payment/medical workflow verification, tenant monitoring UI, automated schema-version operations, backups/restores, and optional SSO tests.
