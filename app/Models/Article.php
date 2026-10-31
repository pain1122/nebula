<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Audit subject only; coordinated content services own all state transitions. */
final class Article extends Model
{
    protected $guarded = ['*'];
}
