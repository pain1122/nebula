<?php

namespace App\Services\Content;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** One explicit editor action, ordinary reviewed transitions, one outer writer transaction. */
final class ArticleComposer
{
    public function __construct(private readonly ArticleEditorial $editorial, private readonly ArticlePublicationSchedules $schedules) {}

    public function finish(Request $request, array $article, string $intent, string $reason): array
    {
        abort_unless(DB::transactionLevel() > 0, 503);
        if ($intent === 'draft') {
            return $article;
        }
        // The explicit publish/schedule intent, fresh authority and signed revision authorize composition.
        // Do not set review/publication columns directly or run jobs to implement a convenient UI.
        foreach (['draft' => 'submit', 'in_review' => 'review'] as $state => $action) {
            if ($article['working_state'] !== $state) {
                continue;
            }
            $context = $this->editorial->context($this->forward($request, 'GET', ['action' => $action]), $article['id']);
            abort_unless($context['eligible'], 409);
            $article = $this->editorial->act($this->forward($request, 'POST', $this->action($context, $action, $reason)), $article['id'], fromComposer: true);
        }
        if ($intent === 'publish') {
            $context = $this->editorial->context($this->forward($request, 'GET', ['action' => 'publish']), $article['id']);
            abort_unless($context['eligible'], 409);

            return $this->editorial->act($this->forward($request, 'POST', $this->action($context, 'publish', $reason)), $article['id'], fromComposer: true);
        }
        abort_unless($intent === 'schedule', 422);
        $context = $this->schedules->context($this->forward($request, 'GET', ['action' => 'arm']), $article['id']);
        abort_unless($context['eligible'], 409);
        $result = $this->schedules->act($this->forward($request, 'POST', $this->action($context, 'arm', $reason)), $article['id'], fromComposer: true);

        return $article + ['schedule' => $result['schedule']];
    }

    private function action(array $context, string $action, string $reason): array
    {
        return ['action' => $action, 'expected_revision' => $context['revision'],
            'expected_version' => $context['current']['working']['version'], 'expected_hash' => $context['current']['working']['content_hash'],
            'reason' => $reason, 'confirmed' => true];
    }

    private function forward(Request $request, string $method, array $data): Request
    {
        $forward = Request::create($request->url(), $method, $method === 'GET' ? $data : [],
            $request->cookies->all(), [], $request->server->all(),
            $method === 'POST' ? json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) : null);
        $forward->headers->set('Content-Type', 'application/json');
        $forward->attributes->add($request->attributes->all());
        $forward->setUserResolver($request->getUserResolver());
        if ($request->hasSession()) {
            $forward->setLaravelSession($request->session());
        }

        return $forward;
    }
}
