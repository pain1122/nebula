## Verification Status

Last verified against code: 2026-06-15
Verification method:
- repo inspection
- route list
- tests
- database check where relevant

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
- Queue infrastructure exists through Laravel/Docker setup, but notification-specific queue policy is not defined.

## Open First

- `routes/auth.php`
- `app/Http/Controllers/Auth/EmailVerificationNotificationController.php`
- `app/Http/Controllers/Auth/VerifyEmailController.php`
- `app/Models/User.php`
- `config/mail.php`
- `config/services.php`
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
