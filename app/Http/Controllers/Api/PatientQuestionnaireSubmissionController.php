<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Illuminate\Http\Request;

class PatientQuestionnaireSubmissionController extends ApiController
{
    private function owner(Request $request): User
    {
        $owner = $request->user()?->fresh('roles');
        abort_unless($owner && $owner->permitsAuthentication() && $owner->hasRole(UserRole::Patient->value), 403);

        return $owner;
    }

    private function summary(QuestionnaireSubmission $submission): array
    {
        return [
            'public_id' => $submission->public_id,
            'questionnaire_title' => $submission->questionnaire_title,
            'questionnaire_version' => $submission->questionnaire_version,
            'submitted_at' => $submission->created_at?->toISOString(),
            'total_score' => $submission->total_score,
            'result_title' => $submission->result_title,
        ];
    }

    public function index(Request $request)
    {
        $owner = $this->owner($request);
        $data = $request->validate(['page' => ['sometimes', 'integer', 'min:1', 'max:100000']]);
        $items = QuestionnaireSubmission::query()->where('user_id', $owner->id)
            ->orderByDesc('created_at')->orderByDesc('id')->paginate(12, ['*'], 'page', $data['page'] ?? 1);
        $this->owner($request);

        return $this->successResponse(
            data: ['owner_id' => $owner->id, 'items' => $items->getCollection()->map(fn ($item) => $this->summary($item))->all()],
            meta: ['pagination' => ['current_page' => $items->currentPage(), 'last_page' => $items->lastPage(), 'total' => $items->total()]],
        )->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $submissionId)
    {
        $owner = $this->owner($request);
        $submission = QuestionnaireSubmission::query()->where('user_id', $owner->id)
            ->where('public_id', $submissionId)->firstOrFail();
        $retained = $submission->retention_until === null || $submission->retention_until->isFuture();
        $data = $this->summary($submission) + [
            'owner_id' => $owner->id,
            'answers_available' => $retained,
            'answers' => collect($retained ? $submission->answers_json : [])->map(fn ($answer) => [
                'question_text' => $answer['question_text'] ?? null,
                'choice_text' => $answer['choice_text'] ?? null,
            ])->values()->all(),
            'result_body_html' => $retained ? $submission->result_body_html : null,
        ];
        $this->owner($request);

        return $this->successResponse(data: $data)->header('Cache-Control', 'private, no-store');
    }
}
