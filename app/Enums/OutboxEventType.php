<?php

namespace App\Enums;

enum OutboxEventType: string
{
    case ReservationCreated = 'reservation.created';
    case ReservationCompleted = 'reservation.completed';
    case RatingRequested = 'rating.requested';
    case PaymentAttemptRequested = 'payment.attempt.requested';
    case NotificationRequested = 'notification.requested';
    case TenantEntitlementChanged = 'tenant.entitlement.changed';
}
