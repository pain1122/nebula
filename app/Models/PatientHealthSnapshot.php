<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class PatientHealthSnapshot extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $guarded = ['id', 'public_id'];

    protected $hidden = ['payload'];

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    protected function casts(): array
    {
        return ['payload' => 'encrypted:array', 'recorded_at' => 'immutable_datetime', 'version' => 'integer', 'schema_version' => 'integer'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Health history is append-only.'));
        static::deleting(fn () => throw new LogicException('Health history is append-only.'));
    }
}
