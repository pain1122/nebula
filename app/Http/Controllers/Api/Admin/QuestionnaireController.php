<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Questionnaire;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class QuestionnaireController extends Controller
{
    public function index()
    {
        return Questionnaire::query()
            ->withCount('questions')
            ->latest('id')
            ->paginate(20);
    }

    public function show(Questionnaire $questionnaire)
    {
        $questionnaire->load([
            'questions.choices' => fn($q) => $q->orderBy('sort_order'),
            'recommendations' => fn($q) => $q->orderBy('priority')->orderBy('min_score'),
        ]);

        return $questionnaire;
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        return DB::transaction(function () use ($data) {
            $q = Questionnaire::create([
                'title' => $data['title'],
                'slug' => $data['slug'],
                'status' => $data['status'] ?? 'draft',
                'cover_image_url' => $data['cover_image_url'] ?? null,
                'content_html' => $data['content_html'] ?? null,
            ]);

            $this->syncNested($q, $data);

            return $q->fresh()->load(['questions.choices', 'recommendations']);
        });
    }

    public function update(Request $request, Questionnaire $questionnaire)
    {
        $data = $this->validatePayload($request, $questionnaire->id);

        return DB::transaction(function () use ($questionnaire, $data) {
            $questionnaire->update([
                'title' => $data['title'],
                'slug' => $data['slug'],
                'status' => $data['status'] ?? $questionnaire->status,
                'cover_image_url' => $data['cover_image_url'] ?? null,
                'content_html' => $data['content_html'] ?? null,
            ]);

            $this->syncNested($questionnaire, $data);

            return $questionnaire->fresh()->load(['questions.choices', 'recommendations']);
        });
    }

    public function destroy(Questionnaire $questionnaire)
    {
        $questionnaire->delete();
        return response()->noContent();
    }

    private function validatePayload(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', Rule::unique('questionnaires', 'slug')->ignore($ignoreId)],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
            'cover_image_url' => ['nullable', 'string', 'max:1024'],
            'content_html' => ['nullable', 'string'],

            'questions' => ['required', 'array', 'min:1'],
            'questions.*.text' => ['required', 'string'],
            'questions.*.sort_order' => ['nullable', 'integer'],
            'questions.*.choices' => ['required', 'array', 'min:1'],
            'questions.*.choices.*.text' => ['required', 'string'],
            'questions.*.choices.*.score' => ['required', 'integer'],
            'questions.*.choices.*.sort_order' => ['nullable', 'integer'],

            'recommendations' => ['nullable', 'array'],
            'recommendations.*.min_score' => ['required_with:recommendations', 'integer'],
            'recommendations.*.max_score' => ['required_with:recommendations', 'integer'],
            'recommendations.*.title' => ['required_with:recommendations', 'string', 'max:255'],
            'recommendations.*.body_html' => ['nullable', 'string'],
            'recommendations.*.priority' => ['nullable', 'integer'],
            'recommendations.*.conditions' => ['nullable', 'array'],
        ]);
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

        if (!empty($data['recommendations'])) {
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
