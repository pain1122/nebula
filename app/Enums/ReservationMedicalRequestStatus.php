<?php

namespace App\Enums;

enum ReservationMedicalRequestStatus: string
{
    case Open = 'open';
    case InReview = 'in_review';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
}
