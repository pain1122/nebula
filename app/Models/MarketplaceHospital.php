<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MarketplaceHospital extends Model
{
    use HasFactory, HasUlids;

    protected $attributes = [
        'timezone' => 'Asia/Tehran',
        'is_active' => true,
    ];

    protected $fillable = [
        'name',
        'slug',
        'timezone',
        'country_code',
        'province',
        'city',
        'address',
        'contact_phone',
        'contact_email',
        'website_url',
        'profile',
        'filter_metadata',
    ];

    protected function casts(): array
    {
        return [
            'filter_metadata' => 'array',
            'is_active' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function workplaces()
    {
        return $this->hasMany(DoctorWorkplace::class);
    }
}
