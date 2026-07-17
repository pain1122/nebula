<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class ReservationScheduleChange extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $fillable = [
        'reservation_id',
        'actor_id',
        'previous_doctor_workplace_id',
        'new_doctor_workplace_id',
        'previous_starts_at',
        'previous_ends_at',
        'previous_duration_minutes',
        'new_starts_at',
        'new_ends_at',
        'new_duration_minutes',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'previous_starts_at' => 'datetime',
            'previous_ends_at' => 'datetime',
            'new_starts_at' => 'datetime',
            'new_ends_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }
}
