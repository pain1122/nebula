<?php

namespace App\Models;

enum ReservationStatus: string
{
    case Pending  = 'pending';
    case Paid     = 'paid';
    case Done     = 'done';
    case Cancelled = 'cancelled';
}
