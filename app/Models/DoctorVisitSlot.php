<?php

namespace App\Models;

use DomainException;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DoctorVisitSlot extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'doctor_working_window_id',
        'doctor_workplace_id',
        'checkup_id',
        'starts_at',
        'ends_at',
        'price',
        'currency',
        'is_active',
    ];

    protected $attributes = [
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'price' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (DoctorVisitSlot $slot): void {
            $immutable = [
                'doctor_working_window_id',
                'doctor_workplace_id',
                'checkup_id',
                'starts_at',
                'ends_at',
                'currency',
            ];

            foreach ($immutable as $attribute) {
                if ($slot->isDirty($attribute)) {
                    throw new DomainException("Visit slot {$attribute} is immutable.");
                }
            }
        });
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function workingWindow()
    {
        return $this->belongsTo(DoctorWorkingWindow::class, 'doctor_working_window_id');
    }

    public function workplace()
    {
        return $this->belongsTo(DoctorWorkplace::class, 'doctor_workplace_id');
    }

    public function checkup()
    {
        return $this->belongsTo(Checkup::class);
    }

    public function reservations()
    {
        return $this->hasMany(Reservation::class);
    }
}
