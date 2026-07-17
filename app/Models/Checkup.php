<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Checkup extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $attributes = [
        'price' => 0,
        'currency' => 'IRR',
        'default_duration_minutes' => 30,
        'is_active' => true,
    ];

    protected $fillable = [
        'checkup_category_id',
        'title',
        'slug',
        'description',
        'price',
        'currency',
        'default_duration_minutes',
    ];

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function category()
    {
        return $this->belongsTo(CheckupCategory::class, 'checkup_category_id');
    }

    public function reservations()
    {
        return $this->hasMany(\App\Models\Reservation::class);
    }

    public function doctors()
    {
        return DoctorProfile::query()
            ->whereHas('workplaces.checkups', function ($query): void {
                $query
                    ->where('checkups.id', $this->getKey())
                    ->where('doctor_workplace_checkup.is_active', true);
            });
    }

    public function workplaces()
    {
        return $this->belongsToMany(DoctorWorkplace::class, 'doctor_workplace_checkup')
            ->withPivot([
                'price_override',
                'currency_override',
                'duration_override_minutes',
                'is_active',
            ])
            ->withTimestamps();
    }
}
