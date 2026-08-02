<?php

namespace App\Enums;

enum PaymentAdjustmentStatus: string
{
    case Pending = 'pending';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Reconciliation = 'reconciliation';
}
