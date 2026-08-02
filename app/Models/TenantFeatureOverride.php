<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class TenantFeatureOverride extends Model
{
    use HasUlids;

    protected $fillable = ['tenant_instance_id', 'feature_id', 'enabled', 'reason'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'expires_at' => 'datetime'];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function tenantInstance()
    {
        return $this->belongsTo(TenantInstance::class);
    }
}
