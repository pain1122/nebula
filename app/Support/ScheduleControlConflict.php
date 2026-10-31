<?php

namespace App\Support;

use RuntimeException;
use Throwable;

final class ScheduleControlConflict extends RuntimeException
{
    public function __construct(?Throwable $previous = null)
    {
        parent::__construct('Schedule is busy or has changed. Refresh availability and try again.', 409, $previous);
    }
}
