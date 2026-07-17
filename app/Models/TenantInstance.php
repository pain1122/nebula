<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class TenantInstance extends Model
{
    use HasUlids;

    protected $fillable = ['marketplace_hospital_id', 'display_name', 'domain', 'plan_key'];
    protected $hidden = ['machine_secret_reference'];
    protected $attributes = ['state' => 'active'];
    protected function casts(): array { return ['last_heartbeat_at' => 'datetime']; }
    public function uniqueIds(): array { return ['public_id']; }
}
