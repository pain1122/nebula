<?php

namespace App\Enums;

enum ReservationFileScanStatus: string
{
    case Quarantined = 'quarantined';
    case Clean = 'clean';
    case Infected = 'infected';
    case Failed = 'failed';
}
