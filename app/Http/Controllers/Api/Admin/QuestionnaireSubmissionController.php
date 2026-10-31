<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\AdminQuestionnaireSubmissionResource;
use App\Models\QuestionnaireSubmission;
use App\Services\AuditLogger;
use App\Support\AdminPanelFilters;
use App\Support\QuerySorting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class QuestionnaireSubmissionController extends ApiController
{
    public function index(Request $request)
    {
        Gate::forUser($request->user())->authorize('viewAny', QuestionnaireSubmission::class);
        $filters = AdminPanelFilters::validate($request, [
            'questionnaire_id' => ['nullable', 'integer', 'min:1'],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'version' => ['nullable', 'integer', 'min:1'],
            'owner_type' => ['nullable', Rule::in(['account', 'guest'])],
            'score_min' => ['nullable', 'integer', 'between:-100000000,100000000'],
            'score_max' => ['nullable', 'integer', 'between:-100000000,100000000', Rule::when($request->filled('score_min'), 'gte:score_min')],
        ]);
        $questionnaireId = $filters['questionnaire_id'] ?? null;
        $q = $filters['q'] ?? null;
        $perPage = min($filters['per_page'] ?? 20, 100);

        $items = QuestionnaireSubmission::query()
            ->when($questionnaireId, fn ($x) => $x->where('questionnaire_id', (int) $questionnaireId))
            ->when($q, function ($x) use ($q) {
                $x->where(function ($qq) use ($q) {
                    $qq->where('public_id', $q)->orWhere('result_title', 'like', "%{$q}%")->orWhere('submitter_name', 'like', "%{$q}%");
                });
            });

        if (! empty($filters['user_id'])) {
            $items->where('user_id', $filters['user_id']);
        }
        if (! empty($filters['version'])) {
            $items->where('questionnaire_version', $filters['version']);
        }
        if (isset($filters['score_min'])) {
            $items->where('total_score', '>=', $filters['score_min']);
        }
        if (isset($filters['score_max'])) {
            $items->where('total_score', '<=', $filters['score_max']);
        }
        if (($filters['owner_type'] ?? null) === 'guest') {
            $items->whereNull('user_id');
        } elseif (($filters['owner_type'] ?? null) === 'account') {
            $items->whereNotNull('user_id');
        }
        AdminPanelFilters::dates($items, $filters);
        QuerySorting::apply($items, $request, [
            'id' => 'questionnaire_submissions.id',
            'questionnaire_id' => 'questionnaire_submissions.questionnaire_id',
            'submitter_name' => 'questionnaire_submissions.submitter_name',
            'total_score' => 'questionnaire_submissions.total_score',
            'created_at' => 'questionnaire_submissions.created_at',
        ], 'id', 'desc');

        $items = $items->with('questionnaire:id,public_id')->orderByDesc('id')->paginate($perPage);

        return $this->successResponse(
            data: AdminQuestionnaireSubmissionResource::collection($items->getCollection())->resolve($request),
            message: 'Questionnaire submissions.',
            meta: [
                'pagination' => [
                    'current_page' => $items->currentPage(),
                    'last_page' => $items->lastPage(),
                    'per_page' => $items->perPage(),
                    'total' => $items->total(),
                ],
            ],
        )->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, QuestionnaireSubmission $submission)
    {
        Gate::forUser($request->user())->authorize('view', $submission);

        return $this->successResponse(
            data: (new AdminQuestionnaireSubmissionResource($submission->load('questionnaire:id,public_id')))->resolve($request),
            message: 'Questionnaire submission.',
        )->header('Cache-Control', 'private, no-store');
    }

    public function destroy(
        Request $request,
        QuestionnaireSubmission $submission,
        AuditLogger $auditLogger,
    ) {
        Gate::forUser($request->user())->authorize('delete', $submission);

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($request, $submission, $auditLogger, $data): void {
            $lockedSubmission = QuestionnaireSubmission::query()
                ->lockForUpdate()
                ->findOrFail($submission->getKey());

            $before = [
                'questionnaire_public_id' => $lockedSubmission->questionnaire?->public_id,
                'deleted_at' => $lockedSubmission->deleted_at?->toISOString(),
            ];

            $lockedSubmission->delete();

            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.questionnaire_submission.archived',
                subject: $lockedSubmission,
                riskLevel: 'critical',
                before: $before,
                after: [
                    'questionnaire_public_id' => $before['questionnaire_public_id'],
                    'deleted_at' => $lockedSubmission->deleted_at?->toISOString(),
                ],
                reason: $data['reason'],
            );
        });

        return response()->noContent();
    }
}
