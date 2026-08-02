# Phase 1C Code Learning Report

Snapshot date: 2026-08-03

## Purpose

This report preserves the code-level explanation of Phase 1C so we can return to it after later roadmap work. It explains not only what was added, but why the files, methods, services, policies, transactions, and tests are structured this way.

Phase 1C established shared backend primitives. It did not build the Vite admin, a complete tenant product, live provider integrations, or the doctor/patient medical workflow.

Final verification:

- SQLite: 186 tests, 950 assertions, with one expected MySQL-only skip.
- Disposable MySQL: 187 tests, 961 assertions.
- MySQL two-process payment lock contention: passed.
- Touched PHP files: Pint passed.
- Non-vendor route discovery: 104 routes.
- Marketplace schema: 50 tables.
- Isolated tenant schema: 22 tables.

Detailed gate evidence is in `docs/audits/phase-1c-verification-gate-2026-08-03.md`.

## 1. How To Read This Backend

Most important mutations follow this path:

```text
Route middleware
    -> Form Request
    -> Controller
    -> Policy/Gate
    -> Domain service
    -> Locked database transaction
    -> Audit and/or outbox in the same transaction
    -> Explicit API resource/envelope
    -> Focused regression test
```

Each layer has a different responsibility.

### Route middleware

Routes decide the authentication mechanism and broad preconditions. For example, privileged platform controls use Sanctum authentication, active-account enforcement, the root-admin route group, and recent-password confirmation.

Recent-password middleware is deliberately route/session based. A bearer token alone cannot claim that the human recently re-entered a password.

### Form Requests

Form Requests own the external input boundary:

- which fields are accepted
- their basic types and shapes
- initial HTTP authorization
- rejection of client-owned server fields

They do not own transaction decisions or state transitions.

### Controllers

Controllers translate HTTP into a service call and serialize the result. A controller should not become the only place a business rule exists, because console commands, jobs, tests, or another API controller could bypass it.

`app/Http/Controllers/Api/Admin/PlatformPrimitiveController.php` is representative: it validates input through a Form Request, calls a service, and returns an explicit safe shape.

### Policies and Gates

Policies answer who may perform an action on a particular subject. Services call the policy again even when the HTTP layer already checked authority. This defense matters because services can be invoked outside the original controller.

### Services

Services own business invariants and state transitions. They decide what must be locked, which current states are legal, which rows change together, and whether an audit or outbox write is mandatory.

### Models and migrations

Models provide relations, casts, safe mass-assignment boundaries, hidden fields, and public identifiers. Migrations provide the last line of integrity through foreign keys, unique indexes, cardinality, and data types.

Application validation improves error messages. Database constraints protect integrity when requests race or code paths drift.

### Tests

Tests prove behavior at several levels:

- unit tests for signatures and canonical payloads
- service tests for state decisions and rollback
- API tests for authentication, validation, response privacy, and middleware
- schema/lifecycle tests for constraints and reversible migrations
- MySQL-only tests for behavior SQLite cannot prove

## 2. Marketplace Control And Tenant-Local Enforcement

Relevant files:

- `app/Services/TenantRegistryService.php`
- `app/Services/TenantFeatureOverrideService.php`
- `app/Services/TenantFeatureGate.php`
- `app/Services/TenantHeartbeatIngestor.php`
- `app/Support/TenantEntitlementSignature.php`
- `app/Support/TenantHeartbeatSignature.php`
- `tests/Feature/Api/MarketplaceControlApiTest.php`
- `tests/Feature/Services/TenantFeatureGateTest.php`

### Why there are two identities

A marketplace hospital is a public directory record. A tenant instance is a separately deployed hospital application being monitored. They may describe the same real hospital, but they do not share users, reservations, payments, questionnaires, or medical records.

Merging them would accidentally turn directory administration into tenant database authority.

### Marketplace feature override

`TenantFeatureOverrideService::set()` follows this pattern:

```php
Gate::forUser($actor)->authorize('manageFeatures', $tenantInstance);

return DB::transaction(function () {
    // Lock tenant, feature, and existing override.
    // Store desired enabled/disabled state.
    // Write fail-closed audit.
    // Publish tenant.entitlement.changed intent.
});
```

The marketplace row is the control-plane decision. It does not directly write the tenant database. Instead it publishes a delivery intent. A later transport/tenant-management adapter can create and deliver a signed effective entitlement.

This separation prevents routine marketplace administration from becoming cross-database operational access.

### Tenant feature decision

`TenantFeatureGate::allows()` reads only the configured tenant connection. It verifies:

- exactly one tenant installation identity exists
- the feature entitlement exists and is enabled
- the signature algorithm is supported
- issue and expiry times are acceptable
- signing key ID is known
- the signature matches the entire canonical entitlement payload

Its final fallback is:

```php
} catch (Throwable) {
    return false;
}
```

That is fail-closed behavior. A broken configuration, database error, unknown key, malformed time, or invalid signature denies the feature. Security-sensitive availability is not guessed.

### Reports example

The tenant setting `reports.enabled` cannot grant reporting by itself. `SettingsResolver` intersects the local value with `TenantFeatureGate::allows('tenant.reports')`.

This gives the marketplace direct control-plane authority while preserving tenant-local enforcement:

```text
Marketplace desired override
    -> signed effective entitlement is delivered
    -> tenant verifies it locally
    -> local reports.enabled may enable the UI/runtime
```

Local configuration may narrow an entitlement, but it cannot widen one.

### Heartbeats

`TenantHeartbeatIngestor` uses an allowlist rather than trying to redact arbitrary payloads after receipt. Accepted data is limited to version, health states, error fingerprints, and aggregate counters.

The service also verifies:

- target tenant public ID matches the signed payload
- timestamp is recent and not from the future
- HMAC/signature matches the tenant machine-secret reference
- nonce has never been used
- tenant row is locked while the snapshot and current version/heartbeat fields update

Patient, reservation, payment, questionnaire-answer, file, note, and report data are rejected before storage.

## 3. Settings Registry And Resolution

Relevant files:

- `config/settings.php`
- `app/Services/SettingsRegistry.php`
- `app/Services/SettingsResolver.php`
- `app/Services/MarketplaceSettingService.php`
- `app/Services/TenantSettingService.php`

### Definition versus value

A setting definition describes the contract:

```php
'booking.pending_hold_minutes' => [
    'group' => 'booking',
    'value_type' => 'integer',
    'default' => 60,
    'validation_rules' => ['integer', 'min:5', 'max:180'],
    'allowed_scopes' => ['platform', 'site'],
]
```

A setting value is one scoped override of that definition.

Keeping definitions centralized prevents every controller from inventing a different type, default, or scope for the same key.

### Precedence

Marketplace precedence is:

```text
user -> site -> platform -> registry default
```

Tenant precedence is:

```text
local user -> implicit hospital -> registry default
```

The tenant does not accept a client-selected hospital or tenant ID. Its database connection already defines the tenant boundary.

### Secret handling

Settings rows are not a secret vault. A sensitive integration setting may contain a reviewed secret reference, but not the credential itself. Actual credentials belong in environment or secret-management storage.

### Mutation service pattern

The mutation services:

1. resolve the known definition
2. validate type and rules
3. validate scope and scope key
4. apply entitlement restrictions
5. authorize the actor
6. require a reason where privileged
7. lock definition/current value
8. write value and audit in one transaction

## 4. Public Media And Private Medical Files

Relevant files:

- `app/Models/PublicMediaAttachment.php`
- `app/Services/PublicMediaService.php`
- `app/Models/ReservationFile.php`
- `app/Services/ReservationFileService.php`
- `app/Policies/ReservationFilePolicy.php`
- `config/filesystems.php`

### Why there are two services

Public marketing images and private medical files have opposite availability rules.

Public media may become directly addressable after validation. Private medical files must never become public merely because storage succeeded.

Combining these paths would make it easy for a future developer to return a public URL for a medical file.

### Public media

`public_media_attachments` is polymorphic so later hospitals, posts, products, and other public entities can reuse it. Client-writable model fields are limited to presentation metadata such as collection, alt text, and sort order. Disk, path, checksum, archive actor, and archive reason remain server owned.

### Private files

The private-file flow is a state machine:

```text
upload -> quarantined -> clean | infected | failed
```

Only clean, active, retained, policy-authorized files may be downloaded. Storage metadata uses opaque paths and SHA-256 checksums. Access and lifecycle changes are audited without logging paths or medical contents.

### Storage and database atomicity

Database transactions cannot roll back a filesystem write. The service therefore uses compensating cleanup:

```text
write storage object
    -> attempt database transaction
    -> if transaction/audit fails, delete the new storage object
```

Replacement archives the previous record and creates a quarantined replacement rather than silently mutating history.

## 5. Policy, Step-Up, Audit, And Transactions

Relevant files:

- `app/Http/Middleware/EnsureRecentPasswordConfirmation.php`
- `app/Services/AuditLogger.php`
- `app/Services/TenantAuditLogger.php`
- policies under `app/Policies/`

These controls answer different questions:

| Control | Question |
| --- | --- |
| Authentication | Who is making the request? |
| Active-account middleware | Is that identity currently allowed to act? |
| Policy | May this actor perform this action on this subject? |
| Recent-password step-up | Did the human recently re-prove control of the session? |
| Reason | Why was this high-authority action taken? |
| Audit | What was attempted and committed? |

One control does not replace another.

### Fail-closed audit

A privileged service writes the domain mutation and audit row in the same transaction:

```php
return DB::transaction(function () {
    $subject = Model::query()->lockForUpdate()->findOrFail($id);
    $before = $this->snapshot($subject);

    $subject->forceFill($changes)->save();

    $this->auditLogger->log(/* before, after, reason */);

    return $subject->fresh();
});
```

If audit logging throws, the mutation rolls back. This is stronger than logging afterward, where a privileged change could commit without evidence.

### Allowlisted snapshots

The audit logger does not serialize whole models. Each service gives it an explicit minimal before/after snapshot. Recursive redaction is still applied as defense in depth, but it is not the primary privacy boundary.

## 6. API Contract And Serialization

Relevant files:

- `docs/architecture/api-v1-contract.md`
- `app/Http/Middleware/AttachApiContractContext.php`
- `app/Http/Controllers/Api/ApiController.php`
- `app/Http/Resources/`
- `app/Http/Requests/`
- `app/Support/QuerySorting.php`

### Compatibility strategy

Existing `/api/*` routes remain version 1. The API adds version and correlation metadata without moving every established path at once.

Breaking field/path/type changes require a later explicit v2 contract. Additive v1 fields are allowed.

### Input and output ownership

Form Requests own accepted input. API Resources own output. Raw Eloquent serialization is not an acceptable new contract because database convenience fields often include internal IDs, medical values, secret references, or hidden lifecycle metadata.

### Public identifiers

New external routes prefer public ULIDs. Numeric IDs may remain temporarily where an existing v1 client needs compatibility, but new integrations should not depend on them.

### Pagination and sorting

Pagination is capped and sorting/filtering columns are allowlisted. A client cannot turn a user-supplied string into an arbitrary SQL column or request an unbounded export through a list endpoint.

### Money and time

Money uses integer minor units plus a three-character currency:

```json
{"amount": 1250000, "currency": "IRR"}
```

This avoids floating-point rounding ambiguity. Dates use ISO 8601 with timezone context.

## 7. Outbox And Provider-Neutral Integrations

Relevant files:

- `app/Enums/OutboxEventType.php`
- `config/outbox.php`
- `app/Services/OutboxPublisher.php`
- `app/Services/OutboxDispatcher.php`
- `app/Contracts/Integrations/`

### The problem the outbox solves

This is unsafe:

```text
commit reservation
send provider message
```

If the process crashes between those steps, the reservation exists but delivery intent is lost.

Phase 1C instead records sanitized intent in the same database transaction:

```text
transaction:
    create domain row
    create outbox row
commit

later dispatcher:
    claim row
    call transport adapter
    mark dispatched or schedule retry
```

Production integrations now include:

- `reservation.created` from `BookingService`
- `payment.attempt.requested` from `PaymentLifecycleService`
- `tenant.entitlement.changed` from `TenantFeatureOverrideService`

### Payload allowlists

`config/outbox.php` defines every allowed key for each event. Missing keys and unknown keys fail validation. This prevents a developer from casually adding phone numbers, medical answers, provider secrets, or file paths to an integration message.

### Idempotency and leases

Each logical event has a stable event ID. The dispatcher locks a pending row, records processing, and sends the same identity on retry. A stale processing lease can be recovered after worker failure without inventing a second logical event.

Backoff delays retries. A maximum attempt count creates an explicit terminal failure instead of an infinite hot loop.

### Contracts versus adapters

Interfaces such as `PaymentGateway`, `MessageTransport`, `PushTransport`, and `OutboxTransport` define what the application needs. They do not select Stripe, an SMS vendor, Firebase, or credentials.

That provider choice belongs to a later bounded integration task.

## 8. Payments, Canonical Success, And Holds

Relevant files:

- `app/Services/PaymentLifecycleService.php`
- `app/Services/PaymentAdjustmentService.php`
- `app/Services/ReservationHoldService.php`
- `app/Services/ReservationOverrideService.php`
- `app/Jobs/ExpireOverdueReservationHolds.php`
- payment enums under `app/Enums/`

### Summary versus attempts

One reservation has one payment summary, but it may have many payment attempts.

```text
reservation
    -> one payment summary
        -> many provider attempts
        -> many provider events
        -> many adjustment requests
        -> at most one canonical successful attempt
```

The summary answers the product question: what is the payment state of this reservation?

An attempt answers the integration question: what happened with this specific provider try?

### Attempt idempotency

Creating an attempt first searches by provider plus idempotency key. If the same key already belongs to the same summary, the existing attempt is returned. It does not extend the reservation hold and does not publish another logical outbox event.

If the key belongs to another payment, the request fails.

### Callback order

`processCallback()` performs decisions in this order:

1. verify callback signature
2. reduce provider payload to an allowlisted subset
3. begin transaction
4. return the prior result for a duplicate external event ID
5. lock payment summary, reservation, and attempt
6. store the verified provider event
7. apply failure, success, late-success, or competing-success decision
8. mark event processed

Signature verification happens before canonical state changes.

### Canonical success

The payment-summary row is the serialization point. Competing callbacks lock the same row. The first eligible success becomes canonical; the later success sees `successful_attempt_id` and becomes reconciliation.

SQLite cannot prove row-level lock waiting, so `PaymentLifecycleMySqlConcurrencyTest` forks two processes:

```text
worker A locks payment summary
worker B starts successful callback and waits
worker A commits canonical success
worker B resumes and records reconciliation
```

The test verifies that worker B actually waited, not merely that two callbacks ran sequentially.

### Holds

A pending reservation holds its slot until `hold_expires_at`. Creating or retrying a payment attempt copies that expiry but never extends it.

`ReservationHoldService` performs idempotent expiry. The scheduled job runs cleanup every minute, but synchronous booking/payment checks remain mandatory. A delayed scheduler must not allow an expired hold to become valid.

### Adjustments

A refund/void adjustment currently reserves an amount and records authority/reason/audit. It does not claim that a provider executed the refund. Provider execution and final adjustment transitions remain later work.

## 9. Testing Standards Learned During Phase 1C

### Test invariants, not implementation trivia

MySQL exposed a test that compared decoded JSON arrays with `assertSame()`. MySQL native JSON normalized object key order, while SQLite text storage preserved insertion order.

JSON object order is not meaningful, so the portable test asserts named fields:

```php
$this->assertSame($tenantId, $payload['tenant_public_id']);
$this->assertSame('tenant.reports', $payload['feature_key']);
$this->assertFalse($payload['enabled']);
$this->assertNull($payload['expires_at']);
```

The lesson is broader: tests should protect the contract, not incidental storage formatting.

### SQLite plus MySQL

SQLite gives fast feedback and excellent transaction/test isolation. MySQL is still required for:

- real row locks
- native JSON behavior
- foreign-key/index-name portability
- engine-specific rollback behavior
- persistent-database lifecycle interaction

### Failure tests are first-class

Happy paths do not prove atomicity. Phase 1C tests intentionally make audit/outbox writes throw and then assert that the domain mutation did not remain.

### Idempotency tests count rows

An idempotency test should not only compare returned IDs. It should also prove no duplicate attempt, provider event, or outbox event was inserted.

## 10. File Structure Rules To Preserve

When adding a future backend behavior:

1. Put request shape in a Form Request or DTO-style boundary.
2. Put subject authority in a policy.
3. Put lifecycle decisions in a domain service.
4. Use enums for stable state vocabulary.
5. Use public identifiers externally.
6. Lock the row that serializes the invariant.
7. Write mandatory audit/outbox records inside the owning transaction.
8. Return explicit resources rather than raw models.
9. Add failure, duplicate, authorization, and privacy tests—not only a success test.
10. Run SQLite for compatibility and MySQL for production database semantics.

## 11. What Phase 1C Deliberately Did Not Build

- Vite admin pages or client UI.
- Monitoring dashboards or cross-tenant operational browsing.
- Automatic tenant deployment, migration fleet, backup, or support access.
- Live payment, SMS, email, or push providers.
- Public payment webhook routes and provider-specific signature formats.
- Executed refunds/voids.
- Doctor-request/patient-upload/review/report medical workflow.
- Appointment completion and rating-trigger workflow.
- Blog, product, order, mobile-device, notification-template, or preference product domains.

Those boundaries are important. A good foundation makes later work safer; it should not disguise unfinished product workflows as complete.
