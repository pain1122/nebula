<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SubmitQuestionnaireRequest;
use App\Models\Questionnaire;
use App\Services\QuestionnaireSubmissionService;
use App\Support\QuerySorting;
use Illuminate\Http\Request;

class PublicQuestionnaireController extends Controller
{
    public function index(Request $request)
    {
        $search = $request->query('q');
        $items = Questionnaire::query()
            ->select(['id', 'title', 'slug', 'cover_image_url', 'updated_at'])
            ->where('status', 'published')
            ->when($search, function ($query) use ($search): void {
                $query->where(function ($nested) use ($search): void {
                    $nested->where('title', 'like', "%{$search}%")
                        ->orWhere('slug', 'like', "%{$search}%");
                });
            })
            ->withCount('questions');

        QuerySorting::apply($items, $request, [
            'id' => 'questionnaires.id',
            'title' => 'questionnaires.title',
            'slug' => 'questionnaires.slug',
            'updated_at' => 'questionnaires.updated_at',
            'questions_count' => 'questions_count',
        ], 'id', 'desc');

        $items = $items->paginate(24);

        return response()->json([
            'data' => $items->items(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
            ],
        ]);
    }

    public function show(string $slug)
    {
        $questionnaire = Questionnaire::query()
            ->where('status', 'published')
            ->where('slug', $slug)
            ->with([
                'questions' => function ($questions): void {
                    $questions->orderBy('sort_order')
                        ->with(['choices' => fn ($choices) => $choices->orderBy('sort_order')]);
                },
            ])
            ->firstOrFail();

        return response()->json([
            'id' => $questionnaire->id,
            'title' => $questionnaire->title,
            'slug' => $questionnaire->slug,
            'version' => $questionnaire->version,
            'cover_image_url' => $questionnaire->cover_image_url,
            'content_html' => $questionnaire->content_html,
            'questions' => $questionnaire->questions->map(fn ($question) => [
                'id' => $question->id,
                'text' => $question->text,
                'sort_order' => $question->sort_order,
                'choices' => $question->choices->map(fn ($choice) => [
                    'id' => $choice->id,
                    'text' => $choice->text,
                    'sort_order' => $choice->sort_order,
                ]),
            ]),
        ]);
    }

    public function submit(
        SubmitQuestionnaireRequest $request,
        string $slug,
        QuestionnaireSubmissionService $service,
    ) {
        $result = $service->submit(
            $slug,
            $request->validated(),
            $request->user('sanctum'),
        );
        $submission = $result['submission'];
        $recommendation = $result['recommendation'];

        return response()->json([
            'submission_id' => $submission->public_id,
            'total_score' => $submission->total_score,
            'recommendation' => $recommendation ? [
                'title' => $recommendation->title,
                'body_html' => $recommendation->body_html,
            ] : null,
        ]);
    }
}
