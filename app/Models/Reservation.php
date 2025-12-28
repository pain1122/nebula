<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Models\DoctorProfile;
use App\Models\Checkup;
use App\Models\ReservationFile;
use App\Models\ReservationNote;
use App\Models\Payment;


class Reservation extends Model
{
    protected $fillable = [
        'user_id',
        'doctor_profile_id',
        'checkup_id',
        'starts_at',
        'ends_at',
        'status'
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'status'    => ReservationStatus::class,
    ];

    // بیمار
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // پزشک (پروفایل)
    public function doctor()
    {
        return $this->belongsTo(DoctorProfile::class, 'doctor_profile_id');
    }

    // چکاپ رزروشده
    public function checkup()
    {
        return $this->belongsTo(Checkup::class);
    }

    // یادداشت‌ها و فایل‌ها
    public function notes()
    {
        return $this->hasMany(ReservationNote::class);
    }
    public function files()
    {
        return $this->hasMany(ReservationFile::class);
    }

    // پرداخت
    public function payment()
    {
        return $this->hasOne(Payment::class);
    }

    // اسکوپ‌های کاربردی
    public function scopeUpcoming($q)
    {
        return $q->where('starts_at', '>', now());
    }
    public function scopeForUser($q, $userId)
    {
        return $q->where('user_id', $userId);
    }
    public function scopeForDoctor($q, $doctorProfileId)
    {
        return $q->where('doctor_profile_id', $doctorProfileId);
    }
}
