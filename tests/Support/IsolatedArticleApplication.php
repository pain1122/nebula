<?php

namespace Tests\Support;

use Illuminate\Contracts\Console\Kernel;
use RuntimeException;

trait IsolatedArticleApplication
{
    public function createApplication()
    {
        $environment = getenv('LARAVEL_STORAGE_PATH');
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite' || getenv('DB_DATABASE') !== ':memory:'
            || getenv('DB_URL') || getenv('DB_SOCKET') || posix_geteuid() !== 33 || $environment !== '/tmp/checkupino-article-source'
            || getenv('APP_CONFIG_CACHE') !== $environment.'/config.php' || ! is_dir($environment)
            || file_exists($environment.'/config.php') || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')
            || ! is_file($environment.'/empty.environment') || filesize($environment.'/empty.environment') !== 0) {
            throw new RuntimeException('Article schema tests require isolated SQLite memory, UID33, empty environment and no project cache.');
        }
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment)->loadEnvironmentFrom('empty.environment');
        $app->make(Kernel::class)->bootstrap();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32))]);
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url') || config('database.connections.sqlite.foreign_key_constraints') !== true) {
            throw new RuntimeException('Effective isolated database/FK guard failed.');
        }

        return $app;
    }
}
