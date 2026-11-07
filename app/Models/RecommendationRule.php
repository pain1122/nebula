<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Audit subject; coordinated services own all writes. */
final class RecommendationRule extends Model
{
    protected $guarded = ['*'];
}
