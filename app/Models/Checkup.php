<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Checkup extends Model
{
    protected $fillable = ['checkup_category_id', 'title', 'slug', 'description', 'price'];

    public function category()
    {
        return $this->belongsTo(CheckupCategory::class, 'checkup_category_id');
    }

    public function reservations()
    {
        return $this->hasMany(\App\Models\Reservation::class);
    }
}