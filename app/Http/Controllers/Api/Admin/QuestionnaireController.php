<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Admin\UpsertQuestionnaireRequest;
use App\Http\Resources\AdminQuestionnaireResource;
use App\Models\Questionnaire;
use App\Services\AuditLogger;
use App\Support\QuerySorting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class QuestionnaireController extends ApiController
{
    public function index(Request $request)
    {
        Gate::forUser($request->user())->authorize('viewAny', Questionnaire::class);
        $query = Questionnaire::query()
            ->withCount('questions');

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            $query->where(function ($q) use ($term): void {
                $q->where('title', 'like', "%{$term}%")
                    ->orWhere('slug', 'like', "%{$term}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        QuerySorting::apply($query, $request, [
            'id' => 'questionnaires.id',
            'title' => 'questionnaires.title',
            'slug' => 'questionnaires.slug',
            'status' => 'questionnaires.status',
            'created_at' => 'questionnaires.created_at',
            'updated_at' => 'questionnaires.updated_at',
            'questions_count' => 'questions_count',
        ], 'id', 'desc');

        $questionnaires = $query->paginate(max(1, min($request->integer('per_page', 20), 100)));

        return $this->successResponse(
            data: AdminQuestionnaireResource::collection($questionnaires->getCollection())->resolve($request),
            message: 'Admin questionnaires.',
            meta: [
                'pagination' => [
                    'current_page' => $questionnaires->currentPage(),
                    'last_page' => $questionnaires->lastPage(),
                    'per_page' => $questionnaires->perPage(),
                    'total' => $questionnaires->total(),
                ],
            ],
        );
    }

    public function show(Request $request, Questionnaire $questionnaire)
    {
        Gate::forUser($request->user())->authorize('view', $questionnaire);
        $questionnaire->load([
            'questions.choices' => fn ($q) => $q->orderBy('sort_order'),
            'recommendations' => fn ($q) => $q->orderBy('priority')->orderBy('min_score'),
        ]);

        return $this->successResponse(
            data: (new AdminQuestionnaireResource($questionnaire))->resolve($request),
            message: 'Admin questionnaire.',
        );
    }

    public function store(UpsertQuestionnaireRequest $request, AuditLogger $auditLogger)
    {
        Gate::authorize('create', Questionnaire::class);
        $data = $request->validated();
        $reason = trim($data['reason']);
        unset($data['reason']);

        $questionnaire = DB::transaction(function () use ($data, $reason, $request, $auditLogger) {
            $q = Questionnaire::create([
                'title' => $data['title'],
                'slug' => $data['slug'],
                'status' => $data['status'] ?? 'draft',
                'cover_image_url' => $data['cover_image_url'] ?? null,
                'content_html' => $data['content_html'] ?? null,
                'author_user_id' => request()->user()?->id,
                'published_at' => ($data['status'] ?? 'draft') === 'published' ? now() : null,
            ]);

            $this->syncNested($q, $data);

            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.questionnaire.created',
                subject: $q,
                riskLevel: 'high',
                before: null,
                after: $this->auditSnapshot($q),
                reason: $reason,
            );

            return $q->fresh()->load(['questions.choices', 'recommendations']);
        });

        return $this->successResponse(
            data: (new AdminQuestionnaireResource($questionnaire))->resolve($request),
            message: 'Questionnaire created.',
            status: 201,
        );
    }

    public function update(UpsertQuestionnaireRequest $request, Questionnaire $questionnaire, AuditLogger $auditLogger)
    {
        Gate::authorize('update', $questionnaire);
        $data = $request->validated();
        $reason = trim($data['reason']);
        unset($data['reason']);

        $questionnaire = DB::transaction(function () use ($questionnaire, $data, $reason, $request, $auditLogger) {
            $lockedQuestionnaire = Questionnaire::query()->lockForUpdate()->findOrFail($questionnaire->getKey());
            $before = $this->auditSnapshot($lockedQuestionnaire);
            $lockedQuestionnaire->update([
                'title' => $data['title'],
                'slug' => $data['slug'],
                'status' => $data['status'] ?? $lockedQuestionnaire->status,
                'cover_image_url' => $data['cover_image_url'] ?? null,
                'content_html' => $data['content_html'] ?? null,
                'version' => $lockedQuestionnaire->version + 1,
                'published_at' => ($data['status'] ?? $lockedQuestionnaire->status->value) === 'published'
                    ? ($lockedQuestionnaire->published_at ?? now())
                    : null,
            ]);

            $this->syncNested($lockedQuestionnaire, $data);

            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.questionnaire.updated',
                subject: $lockedQuestionnaire,
                riskLevel: 'high',
                before: $before,
                after: $this->auditSnapshot($lockedQuestionnaire),
                reason: $reason,
            );

            return $lockedQuestionnaire->fresh()->load(['questions.choices', 'recommendations']);
        });

        return $this->successResponse(
            data: (new AdminQuestionnaireResource($questionnaire))->resolve($request),
            message: 'Questionnaire updated.',
        );
    }

    public function destroy(Request $request, Questionnaire $questionnaire, AuditLogger $auditLogger)
    {
        Gate::authorize('delete', $questionnaire);
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        DB::transaction(function () use ($request, $questionnaire, $auditLogger, $data): void {
            $lockedQuestionnaire = Questionnaire::query()->lockForUpdate()->findOrFail($questionnaire->getKey());
            $before = $this->auditSnapshot($lockedQuestionnaire);
            $lockedQuestionnaire->delete();
            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.questionnaire.archived',
                subject: $lockedQuestionnaire,
                riskLevel: 'critical',
                before: $before,
                after: $this->auditSnapshot($lockedQuestionnaire),
                reason: trim($data['reason']),
            );
        });

        return response()->noContent();
    }

    /** @return array<string, mixed> */
    private function auditSnapshot(Questionnaire $questionnaire): array
    {
        return [
            'slug' => $questionnaire->slug,
            'status' => $questionnaire->status->value,
            'version' => $questionnaire->version,
            'published_at' => $questionnaire->published_at?->toISOString(),
            'deleted_at' => $questionnaire->deleted_at?->toISOString(),
        ];
    }

    private function syncNested(Questionnaire $q, array $data): void
    {
        // پاک‌سازی کامل و درج مجدد (MVP ساده و بدون دردسر)
        // بعداً اگر لازم شد می‌کنیم diff-based برای حفظ ID ها.
        $q->questions()->delete();
        $q->recommendations()->delete();

        foreach ($data['questions'] as $qi => $question) {
            $createdQ = $q->questions()->create([
                'text' => $question['text'],
                'sort_order' => $question['sort_order'] ?? $qi,
            ]);

            foreach ($question['choices'] as $ci => $choice) {
                $createdQ->choices()->create([
                    'text' => $choice['text'],
                    'score' => $choice['score'],
                    'sort_order' => $choice['sort_order'] ?? $ci,
                ]);
            }
        }

        if (! empty($data['recommendations'])) {
            foreach ($data['recommendations'] as $ri => $rec) {
                $q->recommendations()->create([
                    'min_score' => $rec['min_score'],
                    'max_score' => $rec['max_score'],
                    'title' => $rec['title'],
                    'body_html' => $rec['body_html'] ?? null,
                    'priority' => $rec['priority'] ?? $ri,
                    'conditions' => $rec['conditions'] ?? null,
                ]);
            }
        }
    }
}
