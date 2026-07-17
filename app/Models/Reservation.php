<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Reservation extends Model
{
    use HasFactory, HasUlids;

    protected $attributes = [
        'status' => ReservationStatus::Pending->value,
    ];

    protected $fillable = [
        'user_id',
        'doctor_profile_id',
        'doctor_workplace_id',
        'checkup_id',
        'starts_at',
        'ends_at',
        'duration_minutes',
        'timezone',
        'status',
        'hold_expires_at',
        'booking_idempotency_key',
        'hospital_name_snapshot',
        'doctor_name_snapshot',
        'checkup_title_snapshot',
        'category_name_snapshot',
        'price_snapshot',
        'currency_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'hold_expires_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'completed_at' => 'datetime',
            'expired_at' => 'datetime',
            'status' => ReservationStatus::class,
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function doctor()
    {
        return $this->belongsTo(DoctorProfile::class, 'doctor_profile_id');
    }

    public function workplace()
    {
        return $this->belongsTo(DoctorWorkplace::class, 'doctor_workplace_id');
    }

    public function checkup()
    {
        return $this->belongsTo(Checkup::class)->withTrashed();
    }

    public function notes()
    {
        return $this->hasMany(ReservationNote::class);
    }

    public function files()
    {
        return $this->hasMany(ReservationFile::class);
    }

    public function payment()
    {
        return $this->hasOne(Payment::class);
    }

    public function scheduleChanges()
    {
        return $this->hasMany(ReservationScheduleChange::class);
    }

    public function scopeUpcoming($query)
    {
        return $query->where('starts_at', '>', now());
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeForDoctor($query, int $doctorProfileId)
    {
        return $query->where('doctor_profile_id', $doctorProfileId);
    }

    public function scopeBlocking($query)
    {
        return $query->where(function ($statuses): void {
            $statuses
                ->where('status', ReservationStatus::Confirmed->value)
                ->orWhere(function ($pending): void {
                    $pending
                        ->where('status', ReservationStatus::Pending->value)
                        ->where('hold_expires_at', '>', now());
                });
        });
    }
}
