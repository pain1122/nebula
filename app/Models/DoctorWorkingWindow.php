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
        'checkup_id',
        'weekday',
        'starts_at',
        'ends_at',
        'visit_duration_minutes',
        'price_override',
        'currency_override',
        'effective_from',
        'effective_until',
        'is_active',
    ];

    protected $attributes = [
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'weekday' => 'integer',
            'visit_duration_minutes' => 'integer',
            'price_override' => 'integer',
            'effective_from' => 'date',
            'effective_until' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function workplace()
    {
        return $this->belongsTo(DoctorWorkplace::class, 'doctor_workplace_id');
    }

    public function checkup()
    {
        return $this->belongsTo(Checkup::class);
    }

    public function breaks()
    {
        return $this->hasMany(DoctorWorkingWindowBreak::class);
    }

    public function visitSlots()
    {
        return $this->hasMany(DoctorVisitSlot::class);
    }
}
