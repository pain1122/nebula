<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuestionnaireQuestion extends Model
{
    use HasFactory, HasUlids;

    protected $table = 'questionnaire_questions';
    protected $fillable = ['questionnaire_id','text','sort_order'];

    public function uniqueIds(): array { return ['public_id']; }

    public function questionnaire() { return $this->belongsTo(Questionnaire::class); }
    public function choices() { return $this->hasMany(QuestionnaireChoice::class, 'question_id'); }
}
