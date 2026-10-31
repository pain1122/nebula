<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Audit subject only. Editorial media services own all lifecycle transitions. */
final class ArticleMediaAsset extends Model
{
    protected $guarded = ['*'];
}
