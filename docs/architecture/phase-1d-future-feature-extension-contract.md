# Phase 1D Future-Feature Extension Contract

Snapshot date: 2026-08-03

Status: canonical Phase 1D contract for later content, commerce, mobile, tenant-site, reports, and notification work.

Depends on:

- `docs/architecture/foundation-target-domain-and-ownership-contract.md`
- `docs/architecture/foundation-shared-primitives-contract.md`
- `docs/architecture/api-v1-contract.md`
- `docs/audits/phase-1c-verification-gate-2026-08-03.md`

## Purpose And Boundary

Phase 1D reserves ownership, lifecycle vocabulary, security boundaries, and reusable extension points before later product phases create their domain tables and APIs.

It does not create empty placeholder tables, routes, controllers, models, or UI for features that have no current runtime workflow. A schema is added in its implementation phase when real cardinality, policy, retention, query, and transition requirements can be tested.

This avoids two opposite failures:

- building later features now and expanding Phase 1 without product decisions
- leaving ownership/state undefined until a frontend or vendor integration forces an accidental architecture

## Shared Rules For Every Future Domain

1. Ownership follows the active database context.
   - Marketplace-owned rows live in the marketplace database.
   - Tenant-owned rows live only in that tenant database.
   - A client never supplies a trusted `tenant_id` or database selector.
   - Cross-context references use reviewed public identifiers or sanitized integration messages, never operational foreign keys or cross-database joins.
2. New external identifiers are public ULIDs. Numeric IDs remain internal unless an existing v1 compatibility path documents them.
3. Lifecycle state uses enums and explicit service-owned transitions. Archive is distinct from physical deletion.
4. Historical snapshots survive later catalog/content/account archive where the business record must remain understandable.
5. Money uses integer minor units plus ISO-style three-character currency; floating-point money is forbidden.
6. Public media reuses `public_media_attachments`; private/medical files use a private, policy-protected, quarantined path.
7. Privileged mutations use policy authority, recent session-backed password confirmation where high-risk, a reason where applicable, and fail-closed audit in the owning transaction.
8. Integration intent uses typed, allowlisted outbox events in the owning transaction. Vendor adapters never own domain transitions.
9. New APIs use Form Requests/DTO-style writes, explicit Resources, capped pagination, allowlisted queries, stable errors, correlation IDs, and PII-minimal responses.
10. Secrets and push/provider tokens use secret storage or guarded credential records; they never enter normal settings, resources, audit metadata, outbox payloads, or logs.

## 1. Blogs And Content

### Ownership

- Marketplace content is marketplace-owned and may have platform/site scope.
- Tenant-site content is local to one tenant database and its implicit hospital.
- Content author identity belongs to the same database context as the content.
- Marketplace content must not point to a tenant-local user, file, or operational row.

### Reserved model shape

The Phase 4 design must separate:

- content identity and ownership
- localized content/version data
- taxonomy relations
- public media attachments
- publication history/audit

At minimum, a publishable content entity will require:

- public ULID
- owner context inferred from its database/site, not a client-selected tenant
- author/editor identity
- locale using one canonical project locale format
- slug unique within owner context, locale, and content type
- title, excerpt, and sanitized body/content representation
- `draft`, `scheduled`, `published`, and `archived` lifecycle vocabulary
- scheduled/published/archive timestamps and actor attribution
- explicit SEO title, description, canonical reference, indexing flags, and reviewed structured metadata
- polymorphic public-media collections with alt text and ordering

### Current reusable primitives

- `PublicMediaAttachment` and `PublicMediaService`
- scoped settings registry/resolver
- public ULIDs, archive conventions, audit/step-up, API resources, and outbox

### Deferred to Phase 4

Content tables, editor/body format, sanitization implementation, taxonomy, revisions, publication service, preview, search, routes, resources, and UI.

## 2. Products And Commerce

### Ownership

- Marketplace products/orders are marketplace-owned.
- Any future tenant commerce is tenant-local and must not reuse marketplace operational rows.
- A customer/order belongs to one owning product context.

### Reserved model boundaries

Product catalog, order, and payment are separate aggregates.

```text
product catalog
    -> variants/prices/media/inventory policy

order
    -> immutable customer/address/catalog snapshots
    -> order lines
    -> tax/discount/fee adjustments
    -> fulfillment state
    -> commerce payment summary/attempts
```

Reservation payment summaries are not reused as commerce/order payments. Both domains reuse money, attempt, provider-event, idempotency, adjustment, audit, and outbox conventions while retaining separate domain ownership and foreign keys.

### Required future invariants

- product and variant public IDs/slugs are unique in their owning context
- price is integer minor units plus currency
- accepted order lines snapshot name/SKU/price/tax/discount inputs
- discounts, taxes, and fees are explicit adjustments, not destructive rewrites of the base price
- order totals are server calculated and internally consistent
- inventory policy is explicit before reservation/decrement behavior is implemented
- order creation and payment attempts have independent idempotency identities
- archived products do not erase order history
- product media reuses public-media attachments

### Current reusable primitives

- money/currency conventions and payment provider contracts
- payment attempt/event/adjustment patterns without reusing reservation tables
- public media, public IDs, archive/retention, audit, settings, API, and outbox

### Deferred to Phase 5

Product, variant, price, inventory, cart, order, line, tax, discount, fulfillment, commerce-payment tables/services/APIs/UI and provider decisions.

## 3. Mobile Applications

### Client/API boundary

- Mobile/external clients use expiring, rotatable, revocable Sanctum bearer tokens.
- Browser admin remains session-cookie based; mobile support must not push the browser toward stored bearer tokens.
- Mobile clients use the current additive API v1 contract until a breaking v2 is intentionally introduced.
- Minimum/supported version and maintenance decisions are typed settings with explicit platform/application/release-channel scope when Phase 6 defines the applications and channels.
- Feature flags are server-authoritative and may only narrow backend policy/entitlement; a mobile flag never grants an unauthorized backend ability.

### Reserved device ownership

A future client-device record belongs to exactly one local user in one owning database context. It is not a global cross-marketplace/tenant identity.

A future device/push design must distinguish:

- client installation/device public identity
- user ownership and account state
- application identifier, platform, release channel, app version, locale, and last-seen time
- bearer-token identity/abilities/expiry
- push-provider token credential, environment, rotation, invalidation, and last failure

Push-provider tokens are guarded credentials. Normal API resources may expose only device public ID and reviewed metadata, never the token.

Account suspension/closure and device unlink/logout must revoke applicable bearer and push identities. A provider-invalid token is archived/revoked without deleting notification history.

### Current reusable primitives

- Sanctum bearer TTL/rotation/revocation and `device_name`
- API v1 version/correlation/error contract
- scoped settings/features/entitlements
- `PushTransport`, typed outbox, active-account job middleware, and secret-handling rules

### Deferred to Phase 6

Application/release-channel registry, mobile setting keys, client-device and push-token tables, registration/rotation APIs, notification preferences, provider adapter, release UI, and mobile clients.

No Phase 1D device table is created because there is not yet an application/channel lifecycle or push registration flow to validate its cardinality and credential-rotation rules.

## 4. Hospital And Clinic Tenant Sites

### Locked ownership

- One tenant application/database represents one implicit hospital.
- Tenant admins, doctors, patients, settings, features, audit, outbox, and future operational rows are local.
- There is no hospital selector inside a tenant product and no automatic marketplace identity or business-data synchronization.
- Marketplace tenant records remain monitoring/subscription/desired-feature metadata only.

### Control and enforcement

- Marketplace root-admin records desired subscription/feature state.
- Marketplace changes publish sanitized entitlement-change intent.
- A delivery adapter may later issue a signed effective entitlement.
- The tenant verifies and caches the signed entitlement locally and fails closed.
- Local settings may narrow, but never widen, entitlement.
- Signed replay-resistant heartbeats send only allowlisted health/version aggregates back to marketplace monitoring.

### Current reusable primitives

- independent six-migration tenant namespace with 22 verified tables
- installation/schema version, singleton hospital profile, local users/roles/sessions/tokens
- local settings, signed entitlement cache, audit, queues, and outbox
- marketplace registry/feature controls and sanitized heartbeat ingestion

### Deferred to Phase 7

Tenant-local doctor/patient/catalog/booking/payment/questionnaire/medical/content workflows, public site, monitoring dashboard, deployment fleet, migrations, backups/restores, support access, optional SSO, and full tenant operations.

## 5. Reports And Medical Files

### Ownership and separation

- A report/note is structured private medical data; a file is a storage attachment. They are related but not interchangeable.
- Marketplace reports belong to the relevant marketplace patient/reservation/medical context.
- Tenant reports belong only to the tenant-local patient/reservation/medical context.
- A marketplace report never references a tenant-local file or patient.

### Required future workflow boundary

The Phase 1E/Phase 3 vertical slice must explicitly model:

```text
doctor requests result/test
    -> patient uploads private quarantined file
    -> scan marks clean/infected/failed
    -> authorized doctor reviews
    -> doctor writes retained note/report
    -> patient views authorized outcome
```

Report publication/review state, authorship, patient/reservation ownership, amendments, retention, and visibility must be service/policy controlled. Editing must not silently rewrite signed/final historical outcomes.

### Current reusable primitives

- `ReservationFile`, `ReservationFileService`, `ReservationFilePolicy`
- private disk, server-owned opaque metadata, validation, checksum, quarantine/scan, archive/replacement/retention
- policy-protected download and access/lifecycle audit
- `reports.enabled` setting intersected with signed `tenant.reports` entitlement

### Deferred to Phase 1E item 19 and demo phase

Requested-test/result records, report/note lifecycle, doctor/patient routes/resources, review/amendment rules, outcome UI, and complete acceptance workflow.

## 6. Notifications

### Domain event versus delivery

A domain event records that something happened. A notification request decides that a recipient/channel/template should receive a message. A delivery attempt records provider transport behavior. These must remain separate.

```text
domain transition
    -> typed sanitized outbox event
    -> notification policy/preference decision
    -> notification request using template key + variables
    -> channel delivery attempt
```

### Reserved ownership and scoping

- notification rows belong to the same marketplace or tenant database as their recipient and originating domain event
- template definitions are scoped to owning context, locale, channel, and stable template key
- user preferences are local to the user/context and cannot grant a disallowed channel or expose another user's data
- mandatory security/transactional notices must be distinguished from optional marketing preferences
- delivery attempts retain provider-neutral status/error identity without raw credentials or unnecessary message content
- medical details are excluded from ordinary message bodies and outbox payloads unless a separately reviewed private-notification design permits a minimal subset

### Current reusable primitives

- `MessageTransport`, `PushTransport`, and `OutboxTransport`
- `notification.requested` typed allowlisted event shape
- outbox idempotency, leases, retry/backoff, terminal failure, and marketplace/tenant isolation
- active-account checks for user-sensitive jobs
- existing Laravel email-verification notification remains separate from the future product-notification domain

### Deferred to later feature phases

Notification/template/preference/delivery tables, channel policy, consent, localization rendering, provider adapters, in-app inbox, delivery APIs/UI, and medical/privacy decisions.

## Phase 1D Evidence Matrix

| Future domain | Ownership reserved | Lifecycle/security reserved | Existing runtime extension points | Full domain deferred |
| --- | --- | --- | --- | --- |
| Blogs/content | Marketplace or tenant-local | locale/slug/publication/archive/SEO | public media, settings, audit, API, outbox | Phase 4 |
| Products/commerce | Marketplace or tenant-local | catalog/order/payment separation, snapshots, tax/discount adjustments | money, media, payment contracts, audit, outbox | Phase 5 |
| Mobile | User/device local to owning database | bearer/device/push ownership, expiry/revocation, settings/features | Sanctum TTL/rotation, API v1, settings, push/outbox contracts | Phase 6 |
| Hospital/clinic sites | One implicit local hospital database | signed entitlement, local authority, sanitized monitoring | verified tenant schema, registry, heartbeat, audit/outbox | Phase 7 |
| Reports/medical files | patient/reservation in owning database | private/quarantine/review/report/retention/audit | private file service/policy and report entitlement | Phase 1E/Phase 3 |
| Notifications | recipient and event in owning database | templates/channels/preferences/delivery/privacy | transport contracts, typed outbox, job account checks | Later feature phases |

## Phase 1D Gate

Phase 1D is complete when:

- all six domains have explicit marketplace-versus-tenant ownership
- later lifecycle vocabulary and non-negotiable invariants are recorded
- each row maps to verified Phase 1C runtime primitives
- dead placeholder schema and premature product/provider/UI work are explicitly excluded
- roadmap, current task, project map, and task log reference this contract
- no Phase 1E or Phase 2 work is claimed complete

Changes to these ownership or aggregate boundaries require an intentional architecture update before implementation.
