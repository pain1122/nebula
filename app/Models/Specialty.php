<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Specialty extends Model
{
    protected $fillable = ['name','slug','parent_id','level'];

    public function parent()  { return $this->belongsTo(self::class, 'parent_id'); }
    public function children(){ return $this->hasMany(self::class, 'parent_id'); }

    // تاپ‌لول‌ها
    public function scopeRoots($q){ return $q->whereNull('parent_id'); }
}
