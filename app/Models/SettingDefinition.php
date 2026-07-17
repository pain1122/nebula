<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SettingDefinition extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['key', 'group', 'value_type', 'default_value', 'validation_rules', 'sensitivity', 'allowed_scopes', 'description'];

    protected function casts(): array
    {
        return ['default_value' => 'array', 'validation_rules' => 'array', 'allowed_scopes' => 'array'];
    }

    public function uniqueIds(): array { return ['public_id']; }
}
