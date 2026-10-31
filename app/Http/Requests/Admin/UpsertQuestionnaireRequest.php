<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpsertQuestionnaireRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canAccessAdminPanel() ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'expected_version' => ['sometimes', 'integer', 'min:1'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => [
                'required',
                'string',
                'max:255',
                Rule::unique('questionnaires', 'slug')->ignore($this->route('questionnaire')),
            ],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
            'cover_image_url' => ['nullable', 'string', 'max:1024'],
            'content_html' => ['nullable', 'string', 'max:20000'],
            'reason' => ['required', 'string', 'max:1000'],
            'questions' => ['required', 'array', 'list', 'min:1', 'max:100'],
            'questions.*' => ['array:text,sort_order,choices'],
            'questions.*.text' => ['required', 'string', 'max:2000'],
            'questions.*.sort_order' => ['nullable', 'integer'],
            'questions.*.choices' => ['required', 'array', 'list', 'min:1', 'max:50'],
            'questions.*.choices.*' => ['array:text,score,sort_order'],
            'questions.*.choices.*.text' => ['required', 'string', 'max:2000'],
            'questions.*.choices.*.score' => ['required', 'integer', 'between:-1000000,1000000'],
            'questions.*.choices.*.sort_order' => ['nullable', 'integer'],
            'recommendations' => ['nullable', 'array', 'list', 'max:100'],
            'recommendations.*' => ['array:min_score,max_score,title,body_html,priority,conditions'],
            'recommendations.*.min_score' => ['required_with:recommendations', 'integer'],
            'recommendations.*.max_score' => ['required_with:recommendations', 'integer'],
            'recommendations.*.title' => ['required_with:recommendations', 'string', 'max:255'],
            'recommendations.*.body_html' => ['nullable', 'string', 'max:20000'],
            'recommendations.*.priority' => ['nullable', 'integer'],
            'recommendations.*.conditions' => ['nullable', 'array'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $recommendations = $this->input('recommendations', []);

            if (! is_array($recommendations)) {
                return;
            }

            foreach ($recommendations as $index => $recommendation) {
                if (! is_array($recommendation)) {
                    continue;
                }

                $conditions = $recommendation['conditions'] ?? null;

                if ($conditions !== null && $conditions !== []) {
                    $validator->errors()->add(
                        "recommendations.{$index}.conditions",
                        'unsupported_conditions',
                    );
                }

                if ($this->hasIntegerRange($recommendation)
                    && (int) $recommendation['min_score'] > (int) $recommendation['max_score']) {
                    $validator->errors()->add(
                        "recommendations.{$index}.min_score",
                        'invalid_score_range',
                    );
                }
            }

            $count = count($recommendations);

            for ($left = 0; $left < $count; $left++) {
                if (! isset($recommendations[$left])
                    || ! is_array($recommendations[$left])
                    || ! $this->hasValidRange($recommendations[$left])) {
                    continue;
                }

                for ($right = $left + 1; $right < $count; $right++) {
                    if (! isset($recommendations[$right])
                        || ! is_array($recommendations[$right])
                        || ! $this->hasValidRange($recommendations[$right])) {
                        continue;
                    }

                    $leftPriority = (int) ($recommendations[$left]['priority'] ?? $left);
                    $rightPriority = (int) ($recommendations[$right]['priority'] ?? $right);
                    $rangesOverlap = (int) $recommendations[$left]['min_score'] <= (int) $recommendations[$right]['max_score']
                        && (int) $recommendations[$right]['min_score'] <= (int) $recommendations[$left]['max_score'];

                    if ($leftPriority === $rightPriority && $rangesOverlap) {
                        $validator->errors()->add(
                            "recommendations.{$right}.min_score",
                            'ambiguous_score_range',
                        );
                    }
                }
            }
        }];
    }

    /** @param array<string, mixed> $recommendation */
    private function hasIntegerRange(array $recommendation): bool
    {
        return isset($recommendation['min_score'], $recommendation['max_score'])
            && filter_var($recommendation['min_score'], FILTER_VALIDATE_INT) !== false
            && filter_var($recommendation['max_score'], FILTER_VALIDATE_INT) !== false;
    }

    /** @param array<string, mixed> $recommendation */
    private function hasValidRange(array $recommendation): bool
    {
        return $this->hasIntegerRange($recommendation)
            && (int) $recommendation['min_score'] <= (int) $recommendation['max_score'];
    }
}
