<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DoctorWorkingWindow extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'doctor_workplace_id',
        'weekday',
        'starts_at',
        'ends_at',
        'slot_duration_minutes',
        'buffer_minutes',
        'effective_from',
        'effective_until',
    ];

    protected $attributes = [
        'slot_duration_minutes' => 30,
        'buffer_minutes' => 0,
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'weekday' => 'integer',
            'slot_duration_minutes' => 'integer',
            'buffer_minutes' => 'integer',
            'effective_from' => 'date',
            'effective_until' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }
}
