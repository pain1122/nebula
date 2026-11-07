<?php

namespace App\Services\Recommendations;

use App\Services\Content\PatientArticleRead;
use App\Services\Health\HealthCatalog;
use App\Services\Health\PatientHealthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use SensitiveParameter;

final class PatientRecommendationService
{
    public function __construct(private readonly RecommendationAuthority $authority, private readonly RecommendationContent $content,
        private readonly RecommendationAdministration $administration, private readonly PatientHealthService $health,
        private readonly RulePredicateEvaluator $evaluator, private readonly PatientArticleRead $articles) {}

    public function read(Request $request): array
    {
        abort_if(array_diff(array_keys($request->query()), ['language', 'article_id']), 422);
        $query = validator($request->query(), ['language' => 'sometimes|in:en,fa', 'article_id' => 'sometimes|string|ulid'])->validate();
        if (config('recommendations.enabled') !== true || config('recommendations.authoring_enabled') !== true
            || config('patient_health.enabled') !== true || config('article_content.enabled') !== true) {
            return ['state' => 'unavailable', 'items' => []];
        }

        return DB::transaction(function () use ($request, $query) {
            $this->authority->catalog();
            // Owner health/article readers require this X lock; acquire it directly,
            // rather than upgrading simultaneous shared locks for the same patient.
            $actor = $this->authority->actor($request, true);
            abort_unless($actor->roles->pluck('name')->sort()->values()->all() === ['patient'], 403);
            $rules = DB::table('recommendation_rules')->whereNull('retired_at')->whereNotNull('published_version')->orderBy('id')->limit(501)->sharedLock()->get();
            abort_if($rules->count() > 500, 503);
            $eligible = [];
            foreach ($rules as $rule) {
                $version = DB::table('recommendation_rule_versions')->where('rule_id', $rule->id)->where('version', $rule->published_version)->sharedLock()->first();
                abort_unless($version !== null, 503);
                $snapshot = $this->content->snapshot($version);
                $review = $this->administration->approval($rule, $version, $snapshot);
                if ($review !== null && (int) $review->id === (int) $rule->published_review_id) {
                    $eligible[] = [$rule, $version, $snapshot];
                }
            }
            if ($eligible === []) {
                return ['state' => 'unavailable', 'items' => []];
            }
            $health = $this->projection($this->health->read($actor), $actor->public_id);
            $instant = now('UTC')->toDateTimeImmutable();
            usort($eligible, fn ($a, $b) => $b[2]['priority'] <=> $a[2]['priority'] ?: strcmp($a[0]->public_id, $b[0]->public_id));
            $items = [];
            $unknown = false;
            foreach ($eligible as [$rule, $version, $snapshot]) {
                $outcome = $this->evaluator->evaluate(RuleCondition::fromArray($snapshot['definition']), $health, $instant);
                $unknown = $unknown || $outcome === PredicateOutcome::InsufficientData;
                if ($outcome !== PredicateOutcome::Match) {
                    continue;
                }
                $languages = $this->content->languages($snapshot);
                $language = in_array($query['language'] ?? 'en', $languages, true) ? ($query['language'] ?? 'en') : $languages[0];
                foreach ($snapshot['targets'] as $target) {
                    if ($target['id'] === strtolower($query['article_id'] ?? '') || isset($items[$target['id']])) {
                        continue;
                    }
                    $lookup = Request::create('/api/my/articles/'.$target['id'], 'GET', ['language' => $query['language'] ?? 'en']);
                    $lookup->setUserResolver(fn () => $actor);
                    $article = $this->articles->read($lookup, 'article', $target['id'])['data'];
                    abort_unless($article['version_id'] === $target['version_id'], 503);
                    // Only published card fields; no body, health values, rule criteria or review notes.
                    unset($article['body_html'], $article['source_links'], $article['author']);
                    $items[$target['id']] = ['article' => $article, 'explanation' => $snapshot['translations'][$language]['explanation'],
                        'explanation_language' => $language, 'rule_version_id' => $version->public_id];
                    if (count($items) === 6) {
                        break 2;
                    }
                }
            }

            return ['state' => $items !== [] ? 'matched' : ($unknown ? 'insufficient_information' : 'no_matches'), 'items' => array_values($items)];
        });
    }

    private function projection(#[SensitiveParameter] array $view, string $owner): array
    {
        abort_unless(($view['owner_id'] ?? null) === $owner && ($view['schema_version'] ?? null) === 1
            && ($view['catalog']['version'] ?? null) === HealthCatalog::VERSION, 503);

        return ['health_catalog_version' => HealthCatalog::VERSION, 'provenance' => (array) $view['provenance'], 'measurements' => (array) $view['measurements']];
    }
}
