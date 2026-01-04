<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuestionnaireSubmission;
use Illuminate\Http\Request;

class QuestionnaireSubmissionController extends Controller
{
    public function index(Request $request)
    {
        $questionnaireId = $request->query('questionnaire_id');
        $q = $request->query('q'); // phone / token / id
        $perPage = (int) ($request->query('per_page', 20));

        $items = QuestionnaireSubmission::query()
            ->when($questionnaireId, fn($x) => $x->where('questionnaire_id', (int)$questionnaireId))
            ->when($q, function ($x) use ($q) {
                $x->where(function ($qq) use ($q) {
                    $qq->where('id', $q)
                        ->orWhere('guest_phone', 'like', "%{$q}%")
                        ->orWhere('guest_token', 'like', "%{$q}%");
                });
            })
            ->latest('id')
            ->paginate($perPage);

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

    public function show(QuestionnaireSubmission $submission)
    {
        return response()->json($submission);
    }

    public function destroy(QuestionnaireSubmission $submission)
    {
        $submission->delete();
        return response()->noContent();
    }
}
