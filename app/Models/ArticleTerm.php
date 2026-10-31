<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Audit subject only; mutations belong to the coordinated content service. */
final class ArticleTerm extends Model
{
    protected $guarded = ['*'];
}
