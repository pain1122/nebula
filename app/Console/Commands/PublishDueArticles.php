<?php

namespace App\Console\Commands;

use App\Services\Content\ArticleDuePublisher;
use Illuminate\Console\Command;
use Throwable;

final class PublishDueArticles extends Command
{
    protected $signature = 'articles:publish-due {--limit=20 : Maximum due schedules, 1 through 50}';

    protected $description = 'Publish a bounded set of exact reviewed article schedules; consumes no queued jobs';

    public function handle(ArticleDuePublisher $publisher): int
    {
        $limit = $this->option('limit');
        if (! is_string($limit) || ! preg_match('/\A(?:[1-9]|[1-4][0-9]|50)\z/', $limit)) {
            $this->error('Article publisher limit must be an integer from 1 through 50.');

            return self::FAILURE;
        }
        try {
            $result = $publisher->tick((int) $limit);
            $this->info(json_encode($result, JSON_THROW_ON_ERROR));

            return self::SUCCESS;
        } catch (Throwable) {
            $this->error('Article publisher unavailable or transaction failed; no success heartbeat recorded.');

            return self::FAILURE;
        }
    }
}
