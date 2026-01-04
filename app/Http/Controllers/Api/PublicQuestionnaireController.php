<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Questionnaire;
use App\Models\QuestionnaireSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublicQuestionnaireController extends Controller
{
    public function index(Request $request)
    {
        $q = $request->query('q'); // optional search

        $items = Questionnaire::query()
            ->select(['id', 'title', 'slug', 'cover_image_url', 'updated_at'])
            ->where('status', 'published')
            ->when($q, function ($query) use ($q) {
                $query->where(function ($qq) use ($q) {
                    $qq->where('title', 'like', "%{$q}%")
                        ->orWhere('slug', 'like', "%{$q}%");
                });
            })
            ->withCount('questions')
            ->latest('id')
            ->paginate(24);

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
        $q = Questionnaire::query()
            ->where('status', 'published')
            ->where('slug', $slug)
            ->with([
                'questions' => function ($qq) {
                    $qq->orderBy('sort_order')
                        ->with(['choices' => fn($qc) => $qc->orderBy('sort_order')]);
                },
            ])
            ->firstOrFail();

        return response()->json([
            'id' => $q->id,
            'title' => $q->title,
            'slug' => $q->slug,
            'cover_image_url' => $q->cover_image_url,
            'content_html' => $q->content_html,
            'questions' => $q->questions->map(fn($item) => [
                'id' => $item->id,
                'text' => $item->text,
                'sort_order' => $item->sort_order,
                'choices' => $item->choices->map(fn($c) => [
                    'id' => $c->id,
                    'text' => $c->text,
                    'score' => $c->score,
                    'sort_order' => $c->sort_order,
                ]),
            ]),
        ]);
    }

    public function submit(Request $request, string $slug)
    {
        $payload = $request->validate([
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question_id' => ['required', 'integer'],
            'answers.*.choice_id' => ['required', 'integer'],

            'submitter_name' => ['required', 'string', 'max:255'],
            'submitter_phone' => ['required', 'string', 'max:30'],
        ]);

        // ✅ برای روت public صراحتاً از sanctum بگیر
        $user = $request->user('sanctum'); // یا auth('sanctum')->user();

        $q = Questionnaire::query()
            ->where('status', 'published')
            ->where('slug', $slug)
            ->with([
                'questions.choices' => fn($x) => $x->orderBy('sort_order'),
                'recommendations' => fn($x) => $x->orderBy('priority')->orderBy('min_score'),
            ])
            ->firstOrFail();

        return DB::transaction(function () use ($q, $payload, $user) {
            // map برای چک سریع (بدون query اضافه)
            $choiceMap = [];
            $questionText = [];

            foreach ($q->questions as $qq) {
                $questionText[$qq->id] = $qq->text;

                foreach ($qq->choices as $c) {
                    $choiceMap[$c->id] = [
                        'score' => (int) $c->score,
                        'question_id' => $qq->id,
                        'choice_text' => $c->text,
                    ];
                }
            }

            $total = 0;
            $answersJson = [];

            foreach ($payload['answers'] as $a) {
                $qid = (int) $a['question_id'];
                $cid = (int) $a['choice_id'];

                if (!isset($choiceMap[$cid])) {
                    abort(422, 'گزینه نامعتبر است.');
                }

                if ($choiceMap[$cid]['question_id'] !== $qid) {
                    abort(422, 'گزینه با سؤال هم‌خوانی ندارد.');
                }

                $score = $choiceMap[$cid]['score'];
                $total += $score;

                $answersJson[] = [
                    'question_id' => $qid,
                    'choice_id' => $cid,
                    'score' => $score,
                    'question_text' => $questionText[$qid] ?? null,
                    'choice_text' => $choiceMap[$cid]['choice_text'] ?? null,
                ];
            }

            // recommendations یک Collection است
            $rec = $q->recommendations
                ->filter(fn($r) => $total >= (int) $r->min_score && $total <= (int) $r->max_score)
                ->first();

            $submission = QuestionnaireSubmission::create([
                'questionnaire_id' => $q->id,
                'questionnaire_title' => $q->title,
                'questionnaire_slug' => $q->slug,

                // ✅ لاگین/مهمان بر اساس $user
                'user_id' => $user?->id,

                // ✅ snapshot از فرم
                'submitter_name' => $payload['submitter_name'],
                'submitter_phone' => $payload['submitter_phone'],

                // ✅ اگر لاگین بود null، اگر مهمان بود مقدار بده
                'guest_token' => $user ? null : bin2hex(random_bytes(16)),
                'guest_phone' => $user ? null : $payload['submitter_phone'],

                'answers_json' => $answersJson,
                'total_score' => $total,
                'result_title' => $rec?->title,
                'result_body_html' => $rec?->body_html,
            ]);

            return response()->json([
                'submission_id' => $submission->id,
                'total_score' => $total,
                'recommendation' => $rec ? [
                    'title' => $rec->title,
                    'body_html' => $rec->body_html,
                ] : null,
            ]);
        });
    }

}
