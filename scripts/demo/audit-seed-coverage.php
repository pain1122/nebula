<?php

// Fresh SQLite memory only. Never reads the project environment or touches a live database.
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

$stage = 'isolation';
try {
    $root = '/tmp/checkupino-seed-audit';
    if (getenv('CHECKUPINO_SEED_AUDIT') !== 'true' || getenv('APP_ENV') !== 'testing'
        || getenv('DB_CONNECTION') !== 'sqlite' || getenv('DB_DATABASE') !== ':memory:'
        || getenv('DB_URL') || getenv('DB_SOCKET') || posix_geteuid() !== 33
        || getenv('LARAVEL_STORAGE_PATH') !== $root || getenv('APP_CONFIG_CACHE') !== $root.'/config.php'
        || getcwd() !== '/var/www' || ! is_dir($root) || ! is_file($root.'/empty.environment')
        || filesize($root.'/empty.environment') !== 0 || file_exists($root.'/config.php')) {
        throw new RuntimeException('Isolated seed-audit context required.');
    }

    require '/var/www/vendor/autoload.php';
    $app = require '/var/www/bootstrap/app.php';
    $app->useEnvironmentPath($root)->loadEnvironmentFrom('empty.environment');
    $app->make(Kernel::class)->bootstrap();
    if (! $app->environment('testing') || config('database.default') !== 'sqlite'
        || config('database.connections.sqlite.database') !== ':memory:'
        || config('database.connections.sqlite.url') || ! config('database.connections.sqlite.foreign_key_constraints')
        || DB::connection()->getDriverName() !== 'sqlite' || Schema::hasTable('users')) {
        throw new RuntimeException('Fresh isolated SQLite required before migration or seeding.');
    }

    config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'demo.seed_enabled' => true]);
    Carbon::setTestNow(Carbon::parse('2026-11-01 12:00:00', 'Asia/Tehran'));
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-11-01 12:00:00', 'Asia/Tehran'));
    $stage = 'fresh_migrations';
    if (Artisan::call('migrate', ['--force' => true]) !== 0) {
        throw new RuntimeException('Fresh source migrations failed.');
    }
    $stage = 'first_seed';
    if (Artisan::call('db:seed', ['--class' => Database\Seeders\DatabaseSeeder::class, '--force' => true]) !== 0) {
        throw new RuntimeException('Seed graph failed.');
    }

    $tables = ['users', 'marketplace_hospitals', 'doctor_profiles', 'doctor_workplaces', 'doctor_working_windows',
        'doctor_working_window_breaks', 'doctor_visit_slots', 'reservations', 'reservation_payment_summaries',
        'payment_attempts', 'questionnaires', 'questionnaire_choices', 'questionnaire_submissions',
        'patient_health_snapshots', 'patient_biometric_observations', 'articles', 'article_terms',
        'article_media_assets', 'reservation_medical_requests', 'reservation_files', 'reservation_reports',
        'audit_events', 'jobs'];
    $counts = static function () use ($tables): array {
        $result = [];
        foreach ($tables as $table) {
            $result[$table] = DB::table($table)->count();
        }

        return $result;
    };
    $first = $counts();
    $passwords = DB::table('users')->orderBy('id')->pluck('password', 'id')->all();
    $stage = 'second_seed';
    if (Artisan::call('db:seed', ['--class' => Database\Seeders\DatabaseSeeder::class, '--force' => true]) !== 0) {
        throw new RuntimeException('Repeated seed graph failed.');
    }
    $second = $counts();
    $changedPasswords = 0;
    foreach (DB::table('users')->pluck('password', 'id') as $id => $password) {
        $changedPasswords += (int) ($passwords[$id] !== $password);
    }
    $wrongWeekday = 0;
    foreach (App\Models\Reservation::with('visitSlot.workingWindow', 'workplace.hospital')->get() as $reservation) {
        $window = $reservation->visitSlot?->workingWindow;
        if ($window && CarbonImmutable::parse($reservation->starts_at)->setTimezone($reservation->timezone)->dayOfWeek !== $window->weekday) {
            $wrongWeekday++;
        }
    }
    $stage = 'coverage';
    echo json_encode([
        'execution' => 'passed', 'driver' => 'sqlite', 'database' => ':memory:', 'uid' => 33,
        'fixture_clock' => '2026-11-01T12:00:00+03:30', 'fresh_migrations_pass' => true,
        'seed_runs' => 2, 'counts_stable' => $first === $second, 'counts' => $second,
        'password_hashes_changed_on_repeat' => $changedPasswords, 'reservations_outside_linked_rule_weekday' => $wrongWeekday,
        'zero_count_tables' => array_keys(array_filter($second, static fn (int $count): bool => $count === 0)),
        'live_writes' => 0, 'jobs_consumed' => 0,
        'scope' => 'Existing seed graph audit only; no full-feature or actual payment/scanner/recommendation acceptance claim.',
    ], JSON_THROW_ON_ERROR)."\n";
} catch (Throwable $error) {
    fwrite(STDERR, json_encode(['execution' => 'failed', 'stage' => $stage, 'class' => $error::class,
        'line' => $error->getLine(), 'live_writes' => 0], JSON_THROW_ON_ERROR)."\n");
    exit(1);
}
