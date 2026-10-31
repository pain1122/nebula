<?php

namespace Tests\Support;

use Illuminate\Contracts\Console\Kernel;
use RuntimeException;

trait IsolatedProfileApplication
{
    public function createApplication()
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            return parent::createApplication();
        }
        $environment = '/tmp/checkupino-upload-tests';
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite'
            || getenv('DB_DATABASE') !== ':memory:' || getenv('DB_URL') || posix_geteuid() !== 33
            || getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || getenv('LARAVEL_STORAGE_PATH') !== $environment
            || ! is_dir($environment) || file_exists($environment.'/config.php')
            || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')) {
            throw new RuntimeException('Profile regressions require isolated SQLite and skip project environment/cache.');
        }
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment);
        $app->make(Kernel::class)->bootstrap();
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url')) {
            throw new RuntimeException('Effective SQLite guard failed before schema setup.');
        }

        return $app;
    }
}
