<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CheckupCategory extends Model
{
    protected $fillable = ['name','slug','description'];

    public function checkups() { return $this->hasMany(Checkup::class); }
}
