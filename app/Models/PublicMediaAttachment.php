<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class PublicMediaAttachment extends Model
{
    use HasUlids;

    protected $fillable = [
        'collection',
        'alt_text',
        'sort_order',
    ];

    protected $hidden = [
        'disk',
        'path',
        'checksum_sha256',
    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function attachable()
    {
        return $this->morphTo();
    }
}
