<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Explicit designation subject. Qualification evidence is never generally serialized. */
final class RecommendationReviewerGrant extends Model
{
    protected $guarded = ['*'];

    protected $hidden = ['evidence_ref'];
}
