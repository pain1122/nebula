<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Specialty extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $attributes = [
        'level' => 0,
        'is_active' => true,
    ];

    protected $fillable = ['name','slug','parent_id','level'];

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function parent()  { return $this->belongsTo(self::class, 'parent_id'); }
    public function children(){ return $this->hasMany(self::class, 'parent_id'); }

    // تاپ‌لول‌ها
    public function scopeRoots($q){ return $q->whereNull('parent_id'); }
}
