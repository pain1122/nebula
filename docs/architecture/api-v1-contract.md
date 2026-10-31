# API v1 Compatibility Contract

Snapshot date: 2026-08-16

The existing `/api/*` route space is API version 1. Existing paths remain in place while current first-party clients migrate to explicit public identifiers and resources. Every API response carries `X-API-Version: 1` and `X-Correlation-ID`; standard JSON envelopes include the same version and correlation identifier in `meta`.

Additive fields are allowed in v1. Removing a field, changing its meaning/type, or changing a path requires a new `/api/v2/*` contract and an explicit client migration. Numeric database IDs currently used by existing clients are compatibility fields only. New integrations use `public_id` ULIDs, and v1 resources add those ULIDs before numeric IDs can be deprecated.

Success envelopes contain `success`, `message`, `data`, and `meta`. Error envelopes contain `success`, `message`, stable `code`, `errors`, and `meta`. Validation errors use code `validation_failed`. Dates are ISO 8601 with timezone, money is `{amount, currency}` using integer minor units, and enums use their stable string values.

Pagination inputs are capped and sorting/filtering must be allowlisted. Resources and DTO/Form Request boundaries own external serialization; raw Eloquent models are not an acceptable new API contract. PII, medical answers, secret references, disk paths, and provider payloads are excluded unless an explicitly authorized private resource requires a reviewed subset.

Phase 1 verification covers representative public, authenticated patient, doctor, admin/root-admin, validation, pagination, authentication, public-ID, money, questionnaire, lifecycle, medical, and PII-safe resource paths across 68 current API routes. It does not claim that every compatibility controller has removed every legacy numeric ID; those fields remain governed by the additive v1 migration rule above. Evidence: `docs/audits/phase-1-verification-gate-2026-08-16.md`.
