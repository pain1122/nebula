<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DoctorProfile extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $attributes = [
        'experience_years' => 0,
        'fee' => 0,
        'verified' => false,
    ];

    protected $fillable = [
        'user_id',
        'specialty_id',
        'phone',
        'experience_years',
        'fee',
        'bio',
        'verified',
    ];

    protected $casts = [
        'verified' => 'bool',
        'verified_at' => 'datetime',
    ];

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    // روابط
    public function user()
    {
        return $this->belongsTo(User::class);
    }
    public function specialty()
    {
        return $this->belongsTo(Specialty::class);
    }

    public function specialties()
    {
        return $this->belongsToMany(Specialty::class, 'doctor_specialty')
            ->withPivot('is_primary')
            ->withTimestamps();
    }

    public function workplaces()
    {
        return $this->hasMany(DoctorWorkplace::class);
    }

    protected function availability(): Attribute
    {
        return Attribute::get(function (): array {
            if (! $this->exists) {
                return [];
            }

            $workplace = $this->workplaces()->where('is_active', true)->orderBy('id')->first();

            if (! $workplace) {
                return [];
            }

            $dayNames = [0 => 'sun', 1 => 'mon', 2 => 'tue', 3 => 'wed', 4 => 'thu', 5 => 'fri', 6 => 'sat'];

            return $workplace->workingWindows()
                ->where('is_active', true)
                ->orderBy('weekday')
                ->orderBy('starts_at')
                ->get()
                ->groupBy('weekday')
                ->map(fn ($windows, $weekday): array => [
                    'day' => $dayNames[(int) $weekday],
                    'slots' => $windows
                        ->map(fn ($window): array => [
                            substr((string) $window->starts_at, 0, 5),
                            substr((string) $window->ends_at, 0, 5),
                        ])
                        ->values()
                        ->all(),
                ])
                ->values()
                ->all();
        });
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

    public function checkups()
    {
        return Checkup::query()
            ->whereHas('workplaces', function ($query): void {
                $query
                    ->where('doctor_workplaces.doctor_profile_id', $this->getKey())
                    ->where('doctor_workplaces.is_active', true)
                    ->where('doctor_workplace_checkup.is_active', true);
            });
    }

}
