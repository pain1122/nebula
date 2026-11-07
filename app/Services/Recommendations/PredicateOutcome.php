<?php

namespace App\Services\Recommendations;

/** Predicate outcome only; no publication, authorization or clinical approval is implied. */
enum PredicateOutcome: string
{
    case Match = 'match';
    case NoMatch = 'no_match';
    case Excluded = 'excluded';
    case InsufficientData = 'insufficient_data';
}
