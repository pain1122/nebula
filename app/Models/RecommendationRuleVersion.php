<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Immutable service-owned version; no mass assignment. */
final class RecommendationRuleVersion extends Model
{
    protected $guarded = ['*'];
}
