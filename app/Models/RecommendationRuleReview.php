<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Append-only clinical event, not an assertion of qualification by this model. */
final class RecommendationRuleReview extends Model
{
    public $timestamps = false;

    protected $guarded = ['*'];
}
