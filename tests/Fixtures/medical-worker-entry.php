<?php

// Test-only entry point: an actual bounded Laravel worker, never a live database.
use Illuminate\Contracts\Console\Kernel;
use Symfony\Component\Console\Input\ArrayInput;

$directory = $argv[1] ?? '';
$mode = $argv[2] ?? '';
$stat = @lstat($directory);
if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite'
    || getenv('APP_KEY') !== 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
    || getenv('DB_URL') || getenv('LARAVEL_STORAGE_PATH') !== $directory
    || ! preg_match('#^/tmp/checkupino-worker-[a-f0-9]{16}$#D', $directory)
    || ! is_array($stat) || ($stat['mode'] & 0170777) !== 0040700 || $stat['uid'] !== posix_geteuid()
    || realpath($directory) !== $directory || ! in_array($mode, ['protocol', 'engine'], true)
    || getenv('DB_DATABASE') !== $directory.'/database.sqlite'
    || ! is_file($directory.'/database.sqlite') || is_link($directory.'/database.sqlite')
    || getenv('APP_CONFIG_CACHE') !== $directory.'/config.php' || file_exists($directory.'/config.php')
    || file_exists($directory.'/.env') || file_exists($directory.'/.env.testing')
    || is_link($directory.'/private') || is_link($directory.'/config.php')
    || ($mode === 'engine' && getenv('MEDICAL_SCANNER_INTEGRATION') !== 'true')) {
    exit(70);
}

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
// Do not load the project's environment file, including its encryption/storage secrets.
$app->useEnvironmentPath($directory);
$app->make(Kernel::class)->bootstrap();
if (! $app->environment('testing') || config('database.default') !== 'sqlite'
    || config('database.connections.sqlite.database') !== $directory.'/database.sqlite'
    || config('database.connections.sqlite.url')
    || config('filesystems.disks.private.driver') !== 'local'
    || config('filesystems.disks.private.root') !== $directory.'/private'
    || config('app.key') !== getenv('APP_KEY')) {
    exit(70);
}
config([
    'medical.scanner.enabled' => true,
    'medical.scanner.socket' => $mode === 'engine' ? '/run/medical-scan/clamd.sock' : $directory.'/clamd.sock',
    'medical.scanner.timeout_seconds' => $mode === 'engine' ? 45 : 1,
    'medical_parser.test_inline' => false,
    'medical_parser.socket' => $mode === 'engine' ? '/run/medical-content/content.sock' : $directory.'/content.sock',
]);

// One delivery only. No default queue, scheduler, daemon or live storage connection.
exit($app->handleCommand(new ArrayInput([
    'command' => 'queue:work', 'connection' => 'medical-scan',
    '--queue' => 'medical-scan', '--once' => true, '--sleep' => 0,
    '--tries' => 3, '--timeout' => 120, '--memory' => 128,
])));
