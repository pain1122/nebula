<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class TenantHealthSnapshot extends Model
{
    use HasUlids;

    protected $fillable = ['tenant_instance_id', 'health_status', 'component_statuses', 'error_fingerprints', 'aggregate_counters', 'observed_at'];
    protected function casts(): array
    {
        return [
            'component_statuses' => 'array',
            'error_fingerprints' => 'array',
            'aggregate_counters' => 'array',
            'observed_at' => 'datetime',
        ];
    }
    public function uniqueIds(): array { return ['public_id']; }
}
