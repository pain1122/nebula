# Foundation Target Domain and Ownership Contract

Snapshot date: 2026-07-12

Status: approved product direction for migration and shared-primitive planning.

Purpose: keep the main reservation marketplace and future hospital tenant websites structurally clean, operationally separate, and privacy-safe.

## Two Separate Product Contexts

Checkupino has two related but independent product contexts:

1. The main marketplace is a central reservation website with its own users, hospital directory, doctors, services, schedules, reservations, payments, questionnaires, and administration.
2. A tenant hospital website is a separate single-hospital application/database with its own admins, doctors, patients, schedules, reservations, payments, questionnaires, and medical data.

The marketplace is not a shared operational control plane for tenant hospital data. A marketplace user, doctor association, reservation, or admin role does not grant access to any tenant database.

The marketplace may monitor tenant instance health, subscription, feature state, schema version, and sanitized operational signals. Monitoring does not copy or expose tenant users, reservations, payments, questionnaire submissions, or medical records.

## Main Marketplace

The marketplace database owns:

- marketplace root-admin, admins, doctors, and clients/patients
- manually curated hospital directory profiles
- doctor skills, specialties, services, and hospital/workplace associations
- doctor-specific working hours and reservation windows per selected hospital/workplace
- marketplace availability, reservations, payment attempts, ratings, questionnaires, leads, notes, files, and reports
- marketplace settings, content, commerce, mobile configuration, audit events, and notifications
- tenant-instance registry and monitoring metadata only

### Marketplace hospital directory

- Hospital profiles are directory/category records manually created and maintained by marketplace admins.
- A directory hospital has no marketplace hospital-admin account and does not own or administer marketplace records.
- A hospital profile may contain name, slug, location, contact/public profile fields, media, active state, and filter metadata.
- Doctors choose existing hospital profiles as workplace/parent-category associations.
- If a hospital is missing, a doctor may submit a hospital-listing request for marketplace admin review. Approval creates a directory entry; it does not create a tenant or grant database access.
- Directory hospitals support clean filtering by hospital, location, doctor skill/specialty, service/checkup, price, and available reservation window.

### Marketplace doctors and workplaces

- A marketplace doctor has one marketplace identity/profile.
- The doctor may attach multiple marketplace hospital directory entries as workplaces.
- Every doctor-workplace association independently owns the doctor's services, working hours, reservation windows, pricing/overrides if permitted, and active state for that hospital.
- The doctor UI selects a workplace before editing schedules/services or viewing its reservations.
- Marketplace reservations reference the selected doctor-workplace association, not merely a doctor and an unrelated hospital ID.
- Removing a workplace archives future availability but preserves historical reservation snapshots.
- A later policy may prevent overlapping working hours across marketplace workplaces; this can be checked inside the marketplace database without tenant access.

### Marketplace administration

- `root-admin` alone creates/manages admin-level identities and authority.
- Marketplace `admin` manages hospital directory entries, doctor listing requests/verification, marketplace catalog, schedules, reservations, payments, questionnaires, and other allowed product data.
- No tenant hospital administrator exists in the marketplace identity/role system.
- Marketplace admins do not receive tenant operational access merely because a tenant is registered for monitoring.

## Tenant Hospital Website

Each tenant hospital is deployed/configured against its own database and website context.

The tenant database owns:

- its local admin, doctor, and patient/client identities and account states
- the hospital website/profile/settings/branding as an implicit singleton context
- local specialties, services/checkups, prices, doctors, working hours, reservation windows, and availability
- local reservations, payment attempts, questionnaires, leads, ratings, notifications, and audit events
- local private medical profiles, notes, requested tests, files, reports, prescriptions, follow-ups, and outcomes

Tenant rules:

- There is no hospital selector or hospital-directory category inside a tenant application; the hospital is the website/database itself.
- Doctors are added locally by that hospital and always default to the same hospital.
- Tenant doctor services, schedules, and reservations are local and do not derive from marketplace doctor-workplace records.
- Tenant admins exist only in the tenant database/application and have no marketplace admin identity by implication.
- Tenant patients/clients and medical histories are local; no automatic marketplace or cross-tenant identity/history exists.
- A tenant application cannot query another tenant database.
- Marketplace and tenant records are not automatically linked, synchronized, or merged, even if they describe the same real-world hospital or doctor.

An optional explicit link between a marketplace directory hospital and a monitored tenant instance may be added later for display/monitoring convenience. It must not create identity, reservation, or medical-data synchronization.

## Tenant Monitoring From The Marketplace

Marketplace monitoring may store only non-client operational metadata:

- tenant instance public ID and display label
- domain/site URL and enabled/disabled state
- subscription/plan and feature-entitlement state
- application/schema version
- last heartbeat and health status
- queue/scheduler/storage/provider health summaries
- sanitized aggregate usage counters and error fingerprints
- last successful backup/smoke-check timestamps

Monitoring must not store tenant patient identities, appointment details, payment transaction payloads, questionnaire answers, medical files, notes, or reports.

Tenant connection credentials remain secret references. Routine marketplace administration does not provide an interactive cross-tenant data browser. Any future support access requires a separate explicit, time-limited, audited support-access design.

## Account Lifecycle

Marketplace accounts and each tenant's local accounts independently support:

- `active`: normal policy-permitted access
- `suspended`: access denied; browser sessions and bearer tokens revoked immediately; records retained
- `closed`: login permanently denied; sessions/tokens revoked; identity archived and historical records retained

Reservation `pending` and hospital-listing-request pending states are separate domain states, not account states.

Account-state changes require actor, reason, timestamp, audit event, and recent-password step-up where appropriate. Ordinary application actions do not physically delete identities referenced by historical business or medical records.

## Reservation Lifecycle Shared By Both Contexts

- Reservation status `pending` means a client selected a time but has not completed payment.
- A pending reservation holds the slot for one hour through `hold_expires_at`.
- Multiple payment attempts may be made under the same reservation after provider errors.
- At most one payment attempt becomes the canonical successful payment.
- Successful payment confirms the reservation only if the hold and slot remain valid in a locked transaction.
- An unpaid hold becomes `expired` after one hour and releases the slot.
- `cancelled`, `expired`, and historical completed reservations remain retained but do not block new availability outside their occupied interval.
- A late payment callback cannot silently reactivate an expired slot; it enters reconciliation/refund/manual review.

Target reservation semantics:

- `pending`: unpaid one-hour hold
- `confirmed`: payment or approved confirmation path succeeded
- `completed`: appointment completed through the authorized workflow
- `cancelled`: cancelled with actor/reason/time
- `expired`: hold elapsed without successful payment

Payment status remains separate from reservation status.

## Scheduling and Plan Changes

- A service/checkup defines a default duration, while each reservation snapshots its actual duration.
- Marketplace doctor schedules are scoped to a doctor-workplace association.
- Tenant doctor schedules are local and implicitly scoped to the tenant hospital.
- Authorized changes may update start, end, duration, doctor, or marketplace workplace through an explicit reschedule workflow.
- Each change revalidates eligibility, working hours, reservation windows, payment implications, and conflicts inside the owning database.
- Previous/new values, actor, reason, and timestamp are preserved in schedule-change history and audit events.
- Direct updates that erase schedule history are not allowed.
- A reservation is never moved between the marketplace database and a tenant database. Cross-product movement is a cancel/new-booking workflow with explicit client action.

## Ownership Matrix

| Domain | Marketplace system of record | Tenant system of record |
| --- | --- | --- |
| Hospital identity | Manually curated directory profile | Implicit local website/hospital profile |
| Hospital admins | None | Local tenant database only |
| Doctors | Marketplace doctor plus doctor-workplace associations | Independent local doctor records |
| Doctor services/schedules | Per marketplace doctor-workplace | Local, implicitly same hospital |
| Patients/clients | Marketplace-local identities | Tenant-local identities |
| Reservations/payments | Marketplace database | Tenant database |
| Questionnaires/submissions/leads | Marketplace database | Tenant database |
| Medical notes/files/reports | Marketplace database/private marketplace storage when that workflow exists | Tenant database/private tenant storage |
| Content/commerce/mobile settings | Marketplace-owned | Tenant-local only when that tenant feature is enabled |
| Audit | Marketplace audit | Tenant-local audit |
| Tenant monitoring | Sanitized marketplace registry/health metadata | Tenant emits heartbeat/health data only |

## Identifier and Isolation Rules

- Use bigint local primary keys and ULID public IDs in both product contexts.
- Marketplace directory hospital IDs are not tenant database IDs.
- Marketplace doctor IDs are not tenant doctor IDs.
- Tenant instance IDs used for monitoring do not become ownership foreign keys in marketplace reservations.
- No cross-database FK or automatic identity mapping is required for the baseline.
- Tenant deployments use their configured database directly; normal tenant routes do not dynamically switch among tenant databases.
- Marketplace routes always use the marketplace database except the isolated monitoring service that receives sanitized tenant health signals.

## Retention Rules

- Ordinary removal means archive/close for identities, hospital directory entries, doctor workplaces, reservations, payment attempts, submissions, medical records, and audit events.
- Marketplace hospital-directory archive preserves doctor-workplace and reservation snapshots.
- Tenant hospital/profile closure follows an explicit export/retention/destruction process and never silently drops the tenant database.
- Doctor/workplace removal preserves historical reservations.
- Tenant doctor removal preserves local history.
- Physical purge requires a separately approved legal/retention workflow.

## Schema Baseline Consequences

The clean migration plan must preserve two schemas/migration paths, but it does not build two complete products now.

Phase 1 priority:

- fully rebuild the main marketplace foundation and its demo-critical domains
- create only the minimum tenant foundation needed to prove separation and avoid later schema/authority redesign
- do not build tenant product UI, complete tenant booking/medical workflows, cross-site synchronization, or advanced monitoring yet

Marketplace baseline:

- remove the inert `users.tenant_id`
- keep marketplace users/roles, doctor profiles, patients, reservations, payments, questionnaires, and related product tables
- add marketplace hospital directory and hospital-listing-request tables
- add doctor-workplace, workplace-service, and workplace schedule/reservation-window structures
- make reservations reference/snapshot the selected workplace/hospital
- add payment attempts, one-hour holds, immutable booking snapshots, and schedule-change history
- add tenant-instance monitoring/subscription/feature/health metadata without tenant business data

Minimal tenant foundation in Phase 1:

- establish a separate tenant migration namespace/path and schema-version record
- add a single-hospital profile/settings context and local authority bootstrap
- add local account-state, feature-entitlement cache/contract, audit, and outbox foundations
- omit marketplace hospital directory, hospital-listing requests, doctor-workplace selection, and marketplace admin authority
- reserve the local doctor/patient/product ownership boundary without implementing full tenant feature workflows

Phase 7 completes tenant-local doctors, patients, services, schedules, reservations, payments, questionnaires, medical workflows, monitoring, and website UI using the foundation above.

## Deferred Details That Do Not Block Migration Mapping

- hospital-listing-request review fields and anti-spam limits
- whether marketplace doctor workplace selection is immediately active or requires marketplace admin review
- cross-workplace schedule-overlap policy inside the marketplace
- optional future link between a marketplace directory hospital and a tenant monitoring instance
- time-limited support access to tenant systems
- optional SSO to reduce duplicate doctor credentials without synchronizing marketplace/tenant operational data
- automated per-tenant migration, backup, restore, health, and schema-version operations
- legal retention/anonymization periods

These later decisions must preserve the hard boundary: marketplace operations and tenant hospital operations remain separate.
