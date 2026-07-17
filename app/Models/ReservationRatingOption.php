<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReservationRatingOption extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    public const TYPE_PRO = 'pro';

    public const TYPE_CON = 'con';

    protected $fillable = [
        'type',
        'label',
        'slug',
        'description',
        'active',
        'sort_order',
    ];

    protected $casts = [
        'active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function uniqueIds(): array
    {
        return ['public_id'];
    }
}
