<?php

namespace App\Enums;

enum PaymentAttemptStatus: string
{
    case Initiated = 'initiated';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Expired = 'expired';
    case Reconciliation = 'reconciliation';
    case Refunded = 'refunded';
    case Voided = 'voided';
}
