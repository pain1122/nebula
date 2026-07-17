<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DoctorWorkplace extends Model
{
    use HasFactory, HasUlids;

    protected $attributes = [
        'is_active' => true,
    ];

    protected $fillable = [
        'doctor_profile_id',
        'marketplace_hospital_id',
        'display_name',
        'booking_notes',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function doctorProfile()
    {
        return $this->belongsTo(DoctorProfile::class);
    }

    public function hospital()
    {
        return $this->belongsTo(MarketplaceHospital::class, 'marketplace_hospital_id');
    }

    public function checkups()
    {
        return $this->belongsToMany(Checkup::class, 'doctor_workplace_checkup')
            ->withPivot([
                'price_override',
                'currency_override',
                'duration_override_minutes',
                'is_active',
            ])
            ->withTimestamps();
    }

    public function workingWindows()
    {
        return $this->hasMany(DoctorWorkingWindow::class);
    }
}
