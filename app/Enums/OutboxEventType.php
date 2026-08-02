<?php

namespace App\Enums;

enum OutboxEventType: string
{
    case ReservationCreated = 'reservation.created';
    case PaymentAttemptRequested = 'payment.attempt.requested';
    case NotificationRequested = 'notification.requested';
    case TenantEntitlementChanged = 'tenant.entitlement.changed';
}
