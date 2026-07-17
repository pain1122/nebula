<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CheckupCategory extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $attributes = [
        'is_active' => true,
    ];

    protected $fillable = ['name','slug','description'];

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function checkups() { return $this->hasMany(Checkup::class); }
}
