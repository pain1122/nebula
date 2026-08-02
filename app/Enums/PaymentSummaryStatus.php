<?php

namespace App\Enums;

enum PaymentSummaryStatus: string
{
    case Unpaid = 'unpaid';
    case Paid = 'paid';
    case Reconciliation = 'reconciliation';
    case Refunded = 'refunded';
    case Voided = 'voided';
}
