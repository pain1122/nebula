<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\QuestionnaireSubmissionResource;
use App\Models\QuestionnaireSubmission;
use App\Services\AuditLogger;
use App\Support\QuerySorting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class QuestionnaireSubmissionController extends ApiController
{
    public function index(Request $request)
    {
        Gate::forUser($request->user())->authorize('viewAny', QuestionnaireSubmission::class);
        $questionnaireId = $request->query('questionnaire_id');
        $q = $request->query('q'); // phone / token / id
        $perPage = max(1, min($request->integer('per_page', 20), 100));

        $items = QuestionnaireSubmission::query()
            ->when($questionnaireId, fn ($x) => $x->where('questionnaire_id', (int) $questionnaireId))
            ->when($q, function ($x) use ($q) {
                $x->where(function ($qq) use ($q) {
                    $qq->where('id', $q)
                        ->orWhere('guest_phone', 'like', "%{$q}%");
                });
            });

        QuerySorting::apply($items, $request, [
            'id' => 'questionnaire_submissions.id',
            'questionnaire_id' => 'questionnaire_submissions.questionnaire_id',
            'submitter_name' => 'questionnaire_submissions.submitter_name',
            'guest_phone' => 'questionnaire_submissions.guest_phone',
            'total_score' => 'questionnaire_submissions.total_score',
            'created_at' => 'questionnaire_submissions.created_at',
        ], 'id', 'desc');

        $items = $items->with('questionnaire:id,public_id')->paginate($perPage);

        return $this->successResponse(
            data: QuestionnaireSubmissionResource::collection($items->getCollection())->resolve($request),
            message: 'Questionnaire submissions.',
            meta: [
                'pagination' => [
                    'current_page' => $items->currentPage(),
                    'last_page' => $items->lastPage(),
                    'per_page' => $items->perPage(),
                    'total' => $items->total(),
                ],
            ],
        );
    }

    public function show(Request $request, QuestionnaireSubmission $submission)
    {
        Gate::forUser($request->user())->authorize('view', $submission);

        return $this->successResponse(
            data: (new QuestionnaireSubmissionResource($submission->load('questionnaire:id,public_id')))->resolve($request),
            message: 'Questionnaire submission.',
        );
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
