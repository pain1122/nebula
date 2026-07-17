<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Feature extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['key', 'name', 'description'];
    protected $attributes = ['is_active' => true];
    protected function casts(): array { return ['is_active' => 'boolean']; }
    public function uniqueIds(): array { return ['public_id']; }
}
