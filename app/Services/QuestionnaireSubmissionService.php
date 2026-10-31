<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\Questionnaire;
use App\Models\QuestionnaireRecommendation;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuestionnaireSubmissionService
{
    /**
     * @param  array{answers: list<array{question_id: int, choice_id: int}>, submitter_name: string, submitter_phone: string}  $payload
     * @return array{submission: QuestionnaireSubmission, recommendation: QuestionnaireRecommendation|null}
     */
    public function submit(string $slug, array $payload, ?User $user): array
    {
        return DB::transaction(function () use ($slug, $payload, $user): array {
            $questionnaire = Questionnaire::query()
                ->where('status', 'published')
                ->where('slug', $slug)
                ->lockForUpdate()
                ->firstOrFail();
            $questionnaire->load([
                'questions' => fn ($query) => $query
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->with(['choices' => fn ($choices) => $choices->orderBy('sort_order')->orderBy('id')]),
                'recommendations' => fn ($query) => $query
                    ->orderBy('priority')
                    ->orderBy('min_score')
                    ->orderBy('max_score')
                    ->orderBy('id'),
            ]);

            $answersByQuestion = collect($payload['answers'])->keyBy(
                fn (array $answer): int => (int) $answer['question_id'],
            );
            $expectedQuestionIds = $questionnaire->questions->pluck('id')->map(fn ($id): int => (int) $id);
            $submittedQuestionIds = $answersByQuestion->keys()->map(fn ($id): int => (int) $id);

            if (count($payload['answers']) !== $answersByQuestion->count()
                || $submittedQuestionIds->sort()->values()->all() !== $expectedQuestionIds->sort()->values()->all()) {
                throw ValidationException::withMessages([
                    'answers' => ['question_set_mismatch'],
                ]);
            }

            $totalScore = 0;
            $answersSnapshot = [];

            foreach ($questionnaire->questions as $question) {
                $answer = $answersByQuestion->get($question->id);
                $choiceId = (int) $answer['choice_id'];
                $choice = $question->choices->firstWhere('id', $choiceId);

                if ($choice === null) {
                    $choiceBelongsToQuestionnaire = $questionnaire->questions
                        ->flatMap->choices
                        ->contains('id', $choiceId);

                    throw ValidationException::withMessages([
                        'answers' => [$choiceBelongsToQuestionnaire
                            ? 'choice_question_mismatch'
                            : 'choice_not_in_questionnaire'],
                    ]);
                }

                $score = (int) $choice->score;
                $totalScore += $score;
                $answersSnapshot[] = [
                    'question_id' => $question->id,
                    'choice_id' => $choice->id,
                    'score' => $score,
                    'question_text' => $question->text,
                    'choice_text' => $choice->text,
                ];
            }

            $recommendation = $questionnaire->recommendations->first(
                fn (QuestionnaireRecommendation $candidate): bool => $totalScore >= (int) $candidate->min_score
                    && $totalScore <= (int) $candidate->max_score,
            );

            $submission = new QuestionnaireSubmission;
            $submission->forceFill([
                'questionnaire_id' => $questionnaire->id,
                'questionnaire_version' => $questionnaire->version,
                'questionnaire_title' => $questionnaire->title,
                'questionnaire_slug' => $questionnaire->slug,
                'user_id' => $user?->id,
                'submitter_name' => $payload['submitter_name'],
                'submitter_phone' => $payload['submitter_phone'],
                'guest_token_hash' => $user ? null : hash('sha256', bin2hex(random_bytes(32))),
                'guest_phone' => $user ? null : $payload['submitter_phone'],
                'answers_json' => $answersSnapshot,
                'total_score' => $totalScore,
                'result_title' => $recommendation?->title,
                'result_body_html' => $recommendation?->body_html,
            ])->save();

            if ($user === null) {
                Lead::updateOrCreate(
                    [
                        'phone' => $payload['submitter_phone'],
                        'source' => 'questionnaire',
                        'source_key' => $questionnaire->slug,
                    ],
                    [
                        'name' => $payload['submitter_name'],
                        'status' => 'new',
                        'questionnaire_submission_id' => $submission->id,
                        'meta' => [
                            'questionnaire_id' => $questionnaire->id,
                            'questionnaire_title' => $questionnaire->title,
                            'total_score' => $totalScore,
                            'result_title' => $recommendation?->title,
                        ],
                    ],
                );
            }

            return [
                'submission' => $submission,
                'recommendation' => $recommendation,
            ];
        });
    }
}
