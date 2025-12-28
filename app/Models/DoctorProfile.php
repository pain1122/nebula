<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DoctorProfile extends Model
{
    protected $fillable = [
        'user_id',
        'specialty_id',
        'phone',
        'experience_years',
        'fee',
        'bio',
        'availability',
        'verified',
    ];

    protected $casts = [
        'availability' => 'array',
        'verified' => 'bool',
    ];

    // روابط
    public function user()
    {
        return $this->belongsTo(User::class);
    }
    public function specialty()
    {
        return $this->belongsTo(Specialty::class);
    }

    // اسکوپ‌های مفید
    public function scopeVerified($q)
    {
        return $q->where('verified', true);
    }
    public function reservations()
    {
        return $this->hasMany(\App\Models\Reservation::class, 'doctor_profile_id');
    }

}
