<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuestionnaireChoice extends Model
{
    use HasFactory, HasUlids;

    protected $table = 'questionnaire_choices';
    protected $fillable = ['question_id','text','score','sort_order'];

    public function uniqueIds(): array { return ['public_id']; }

    public function question() { return $this->belongsTo(QuestionnaireQuestion::class, 'question_id'); }
}
