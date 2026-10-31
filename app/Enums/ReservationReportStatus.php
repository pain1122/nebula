<?php

namespace App\Enums;

enum ReservationReportStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
}
