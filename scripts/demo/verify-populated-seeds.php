<?php

use App\Enums\ReservationFileScanStatus;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

$stage = 'isolation';
try {
    $root = '/tmp/checkupino-seed-runtime';
    $mysql = getenv('CHECKUPINO_SEED_MYSQL') === 'true';
    $databaseAdmitted = $mysql
        ? getenv('DB_CONNECTION') === 'mysql' && getenv('DB_HOST') === 'mysql-acceptance' && getenv('DB_PORT') === '3306'
            && getenv('DB_DATABASE') === 'checkupino_schedule_acceptance' && getenv('DB_USERNAME') === 'schedule_acceptance'
        : getenv('DB_CONNECTION') === 'sqlite' && getenv('DB_DATABASE') === ':memory:';
    if (getenv('CHECKUPINO_SEED_RUNTIME') !== 'true' || getenv('APP_ENV') !== 'testing'
        || ! $databaseAdmitted || getenv('DB_URL') || getenv('DB_SOCKET')
        || posix_geteuid() !== 33 || getenv('LARAVEL_STORAGE_PATH') !== $root || getenv('APP_CONFIG_CACHE') !== $root.'/config.php'
        || ! is_file($root.'/empty.environment') || filesize($root.'/empty.environment') !== 0 || file_exists($root.'/config.php')) {
        throw new RuntimeException('Isolated populated seed context required.');
    }
    require '/var/www/vendor/autoload.php';
    $app = require '/var/www/bootstrap/app.php';
    $app->useEnvironmentPath($root)->loadEnvironmentFrom('empty.environment');
    $app->make(Kernel::class)->bootstrap();
    $driver = $mysql ? 'mysql' : 'sqlite';
    if (config('database.default') !== $driver || DB::connection()->getDriverName() !== $driver
        || config('database.connections.'.$driver.'.database') !== getenv('DB_DATABASE') || config('database.connections.'.$driver.'.url')) {
        throw new RuntimeException('Effective isolated database required.');
    }
    if ($mysql && (config('database.connections.mysql.host') !== 'mysql-acceptance'
        || config('database.connections.mysql.username') !== 'schedule_acceptance'
        || (int) config('database.connections.mysql.port') !== 3306
        || (int) DB::selectOne('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()')->n !== 0)) {
        throw new RuntimeException('Exact disposable database must be empty; no reset or replay is allowed.');
    }
    config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'demo.seed_enabled' => true,
        'demo.verified_media_seed_enabled' => true, 'article_content.enabled' => true,
        'article_content.presentation_enabled' => true, 'article_content.media_enabled' => true,
        'article_content.publisher_enabled' => false, 'article_content.scheduling_enabled' => false,
        'medical.scanner.enabled' => true, 'medical_parser.test_inline' => false,
        'filesystems.disks.private.root' => $root.'/app/private', 'filesystems.disks.article-media.root' => $root.'/app/article-media']);
    $stage = 'migrate';
    if (Artisan::call('migrate', ['--force' => true]) !== 0) {
        throw new RuntimeException('Isolated migrations failed.');
    }
    $stage = 'seed';
    if (Artisan::call('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true]) !== 0) {
        throw new RuntimeException('Isolated populated seeding failed.');
    }
    $counts = static function (): array {
        $result = [];
        foreach (['users', 'reservations', 'patient_health_snapshots', 'patient_biometric_observations', 'questionnaire_submissions',
            'articles', 'article_versions', 'article_terms', 'article_media_assets', 'article_version_media',
            'reservation_medical_requests', 'reservation_files', 'reservation_reports', 'audit_events', 'jobs'] as $table) {
            $result[$table] = DB::table($table)->count();
        }

        return $result;
    };
    $first = $counts();
    $snapshot = static function () use ($first): string {
        $rows = [];
        foreach (array_keys($first) as $table) {
            $rows[$table] = DB::table($table)->orderBy('id')->get()->all();
        }

        return hash('sha256', json_encode($rows, JSON_THROW_ON_ERROR));
    };
    $beforeRepeat = $snapshot();
    $stage = 'repeat';
    if (Artisan::call('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true]) !== 0 || $counts() !== $first
        || $snapshot() !== $beforeRepeat) {
        throw new RuntimeException('Populated seeding repeated or changed records.');
    }
    $stage = 'assertions';
    if ($first['article_media_assets'] !== 3 || $first['reservation_files'] !== 2 || $first['reservation_reports'] !== 4
        || $first['jobs'] !== 0 || App\Models\ReservationFile::where('scan_status', '!=', ReservationFileScanStatus::Clean->value)->exists()
        || DB::table('article_media_assets')->where('status', '!=', 'released')->exists()) {
        throw new RuntimeException('Expected actual verified media and normal report histories.');
    }
    $scanAudit = App\Models\AuditEvent::where('action', 'reservation_medical_file.scan_recorded')->firstOrFail();
    echo json_encode(['execution' => 'passed', 'driver' => $driver, 'counts' => $first,
        'real_scanner' => true, 'remote_parser' => true, 'scanner_database' => $scanAudit->after['scanner_database_version'],
        'owned_jobs_processed' => 2, 'repeat_preserved' => true, 'repeat_exact_rows_preserved' => true, 'live_database_writes' => 0,
        'scope' => 'Temporary fresh synthetic database/storage only; real socket processing and exact owned encrypted deliveries, no general workers or current DB access.'], JSON_THROW_ON_ERROR)."\n";
} catch (Throwable $error) {
    fwrite(STDERR, json_encode(['execution' => 'failed', 'stage' => $stage, 'class' => $error::class,
        'line' => $error->getLine(), 'message' => getenv('APP_ENV') === 'testing' ? $error->getMessage() : 'Probe refused.'], JSON_THROW_ON_ERROR)."\n");
    exit(1);
}
