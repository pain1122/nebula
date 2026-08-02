## Verification Status

Last verified against code: 2026-08-03
Verification method:
- repo inspection
- SQLite and user-confirmed disposable-MySQL suites
- marketplace/tenant outbox isolation, retry, recovery, and failure regressions
- 104-route list and touched-file Pint

If this file conflicts with source code, source code wins.
Update this module after verification.


# Notifications Context

Use this module for email verification notices, product notifications, mail delivery, SMS/push planning, notification preferences, or notification queue behavior.

Do not load this module for auth role taxonomy unless the task touches verification mail or notification delivery.

## Current State

- Laravel `User` model uses `Notifiable`.
- Breeze email verification notification route/controller exists.
- Product notification domain is not implemented yet.
- No first-party SMS, push, in-app notification, notification preference, or notification audit model is present.
- Provider-neutral `MessageTransport`, `PushTransport`, and `OutboxTransport` contracts exist without selecting vendors or credentials.
- Marketplace and tenant schemas have independent outboxes. `OutboxPublisher` accepts typed, allowlisted, sanitized domain events on an explicit connection.
- `OutboxDispatcher` owns idempotent claiming, stale-processing lease recovery, retry/backoff, terminal failure, and aggregate status counts. A transport adapter remains intentionally absent.
- Booking, payment-attempt creation, and marketplace tenant-feature override publish typed intent from their owning transactions; focused and full SQLite/MySQL regressions pass.
- User-sensitive queued work inherits execution-time active-account checks through `UserSensitiveJob` and `EnsureUserAccountIsActive`.
- Notification templates, preferences, consent, channel selection, and product delivery workflows remain future work.

## Open First

- `routes/auth.php`
- `app/Http/Controllers/Auth/EmailVerificationNotificationController.php`
- `app/Http/Controllers/Auth/VerifyEmailController.php`
- `app/Models/User.php`
- `config/mail.php`
- `config/services.php`
- `app/Contracts/Integrations/MessageTransport.php`
- `app/Contracts/Integrations/PushTransport.php`
- `app/Contracts/Integrations/OutboxTransport.php`
- `app/Services/OutboxPublisher.php`
- `app/Services/OutboxDispatcher.php`
- `app/Enums/OutboxEventType.php`
- `app/Jobs/UserSensitiveJob.php`
- `app/Jobs/Middleware/EnsureUserAccountIsActive.php`
- `tests/Feature/Services/OutboxFoundationTest.php`
- `.env.example`
- `.env.production.example`

Search only if needed:

```bash
rg -n "Notification|notify\\(|Mail::|sendEmailVerificationNotification|ShouldQueue" app config routes
```

## Guardrails

- Do not invent provider credentials or production mail settings.
- Do not add SMS/push providers without explicit approval.
- Do not send product medical or payment notifications without deciding privacy, consent, and audit requirements.
- Prefer queued notifications for user-facing delivery once product notifications exist.
- Keep verification mail separate from future product notification workflows.
- Keep domain transactions responsible for recording sanitized delivery intent; transports must not own domain state transitions.
- Do not put patient, questionnaire-answer, medical-file path, token, or credential payloads in outbox events.
- Treat retries as the same idempotency identity; do not create a new logical event for every delivery attempt.

## Verification

```bash
docker compose exec app php artisan route:list --except-vendor
docker compose exec app php artisan test
```

If mail config changes, inspect env requirements rather than printing real secrets.

## Update After Changes

- This module for durable notification facts.
- `docs/TODO.md` if notification roadmap is added.
- A new ADR if delivery provider, privacy, or audit strategy is decided.
