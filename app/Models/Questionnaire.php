<?php 

namespace App\Models;

use App\Enums\QuestionnaireStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Questionnaire extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $attributes = [
        'status' => QuestionnaireStatus::Draft->value,
        'version' => 1,
    ];

    protected $fillable = [
        'author_user_id',
        'title',
        'slug',
        'status',
        'cover_image_url',
        'content_html',
        'version',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => QuestionnaireStatus::class,
            'published_at' => 'datetime',
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function questions() { return $this->hasMany(QuestionnaireQuestion::class); }
    public function recommendations() { return $this->hasMany(QuestionnaireRecommendation::class); }
}
