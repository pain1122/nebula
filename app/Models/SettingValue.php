<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SettingValue extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['setting_definition_id', 'scope_type', 'scope_key', 'value'];

    protected $hidden = ['secret_reference'];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function definition()
    {
        return $this->belongsTo(SettingDefinition::class, 'setting_definition_id');
    }
}
