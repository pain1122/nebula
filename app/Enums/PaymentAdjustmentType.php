<?php

namespace App\Enums;

enum PaymentAdjustmentType: string
{
    case Refund = 'refund';
    case Void = 'void';
}
