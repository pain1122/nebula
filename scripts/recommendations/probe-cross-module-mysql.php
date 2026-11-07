<?php

// Real recommendation service saves; only the admitted empty disposable MySQL is allowed.
use App\Models\AuditEvent;
use App\Models\User;
use Checkupino\Acceptance\Recommendations\CrossAuditRefusal;
use Checkupino\Acceptance\Recommendations\CrossModuleFixture as Fixture;
use Checkupino\Acceptance\Recommendations\CrossModuleIntegrity as Integrity;
use Database\Seeders\RolesSeeder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\Process\Process;

class RecommendationMysqlAssertion extends RuntimeException {}
class RecommendationAuditRefusal extends RuntimeException {}

function recommendationEnsure(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RecommendationMysqlAssertion($message);
    }
}

$stage = 'configuration';
$failure = function (Throwable $error) use (&$stage): void {
    $applicationFrame = null;
    foreach ($error->getTrace() as $frame) {
        if (str_starts_with($frame['file'] ?? '', '/var/www/app/')) {
            $applicationFrame = ['file' => substr($frame['file'], strlen('/var/www/')), 'line' => $frame['line'] ?? null];
            break;
        }
    }
    fwrite(STDERR, json_encode(['recommendation_mysql_failure' => true, 'stage' => $stage, 'class' => $error::class,
        'http_status' => $error instanceof HttpExceptionInterface ? $error->getStatusCode() : null, 'application_frame' => $applicationFrame,
        'line' => $error->getLine(), 'file' => str_replace('/var/www/', '', $error->getFile()),
        'mysql_code' => $error instanceof QueryException ? ($error->errorInfo[1] ?? null) : null,
        'assertion' => $error instanceof RecommendationMysqlAssertion || $error instanceof \Checkupino\Acceptance\Recommendations\CrossIntegrityAssertion ? $error->getMessage() : null], JSON_THROW_ON_ERROR)."\n");
    exit(1);
};
set_exception_handler($failure);
$mode = $argv[1] ?? '';
$root = '/tmp/checkupino-recommendation-cross-mysql';
recommendationEnsure(in_array($mode, ['parent', 'child'], true) && getenv('CHECKUPINO_RECOMMENDATION_CROSS_MYSQL') === 'true'
    && getenv('APP_ENV') === 'testing' && getenv('DB_CONNECTION') === 'mysql' && posix_geteuid() === 33
    && getenv('DB_HOST') === 'mysql-acceptance' && getenv('DB_PORT') === '3306'
    && getenv('DB_DATABASE') === 'checkupino_schedule_acceptance' && getenv('DB_USERNAME') === 'schedule_acceptance'
    && preg_match('/^[a-f0-9]{32}$/D', (string) getenv('DB_PASSWORD')) && ! getenv('DB_URL') && ! getenv('DB_SOCKET')
    && getenv('APP_KEY') === 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
    && getenv('LARAVEL_STORAGE_PATH') === $root && getenv('APP_CONFIG_CACHE') === $root.'/config.php'
    && getenv('APP_ROUTES_CACHE') === $root.'/routes.php' && getenv('MEDICAL_SCAN_ENABLED') === 'false',
    'Explicit isolated configuration is required before boot.');
umask(0077);
if ($mode !== 'child') {
    recommendationEnsure(count($argv) === 2 && ! file_exists($root), 'A fresh process and temporary storage are required.');
    mkdir($root, 0700);
    foreach (['framework/cache', 'framework/sessions', 'framework/views', 'logs', 'private'] as $directory) {
        mkdir($root.'/'.$directory, 0700, true);
    }
    file_put_contents($root.'/empty.environment', '');
}
$stat = lstat($root);
recommendationEnsure(is_array($stat) && $stat['uid'] === 33 && ($stat['mode'] & 0170000) === 0040000
    && ! file_exists($root.'/.env') && ! file_exists($root.'/.env.testing') && ! file_exists($root.'/config.php')
    && is_file($root.'/empty.environment') && filesize($root.'/empty.environment') === 0, 'Owned empty isolated environment is required.');
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->useEnvironmentPath($root)->loadEnvironmentFrom('empty.environment');
$stage = 'boot';
$app->make(Kernel::class)->bootstrap();
set_exception_handler($failure);
recommendationEnsure(config('database.default') === 'mysql' && config('database.connections.mysql.host') === 'mysql-acceptance'
    && config('database.connections.mysql.database') === 'checkupino_schedule_acceptance' && ! config('database.connections.mysql.url')
    && config('queue.default') === 'database' && config('cache.default') === 'array' && ! config('medical.scanner.enabled')
    && DB::selectOne('SELECT DATABASE() AS name')->name === 'checkupino_schedule_acceptance', 'Effective isolated configuration is required.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 8');
config(['article_content.enabled' => true]);
$matrix = json_decode(file_get_contents('/var/www/scripts/recommendations/cross-module-cases.json'), true, flags: JSON_THROW_ON_ERROR);
recommendationEnsure(count($matrix) === 16, 'Exact sixteen-case cross-module matrix required.');

require '/var/www/scripts/recommendations/CrossModuleFixture.php';
require '/var/www/scripts/recommendations/CrossModuleIntegrity.php';
require '/var/www/scripts/recommendations/CrossModuleAnchor.php';
config(['recommendations.authoring_enabled' => true, 'recommendations.enabled' => true, 'patient_health.enabled' => true]);
recommendationEnsure(config('session.driver') === 'database' && config('session.connection') === null, 'Real disposable database sessions required for account revocation.');
Fixture::installObserver();

function crossWait(string $path): void
{
    $until = microtime(true) + 10;
    do {
        clearstatcache(true, $path);
        if (is_file($path)) {
            return;
        }
        usleep(10000);
    } while (microtime(true) < $until);
    throw new RecommendationMysqlAssertion('Transaction barrier timed out.');
}

function crossAnchor(string $sql, array $bindings, array $case): bool
{
    return \Checkupino\Acceptance\Recommendations\CrossModuleAnchor::matches($sql, $bindings, $case);
}

if ($mode === 'child') {
    [$token, $side] = [$argv[2] ?? '', $argv[3] ?? ''];
    recommendationEnsure(count($argv) === 4 && preg_match('/^[a-f0-9]{16}$/D', $token) && in_array($side, ['leader', 'follower'], true), 'Invalid child arguments.');
    $case = json_decode(file_get_contents($root.'/'.$token.'.json'), true, flags: JSON_THROW_ON_ERROR);
    $actor = User::findOrFail($case[$side.'_actor']);
    $stage = $case['name'].'-'.$side;
    file_put_contents($root.'/'.$token.'.'.$side.'.prepared', (string) DB::connection()->getPdo()->query('SELECT CONNECTION_ID()')->fetchColumn());
    crossWait($root.'/'.$token.'.go');
    $observed = false;
    if ($side === 'leader') {
        DB::listen(function ($query) use (&$observed, $case, $root, $token): void {
            if (! $observed && crossAnchor($query->sql, $query->bindings, $case)) {
                recommendationEnsure(DB::transactionLevel() >= 1, 'Real writer/reader transaction required.');
                $observed = true;
                file_put_contents($root.'/'.$token.'.locked', '1');
                crossWait($root.'/'.$token.'.release');
            }
        });
        if ($case['audit_failure'] ?? false) {
            AuditEvent::creating(fn () => throw new CrossAuditRefusal('Synthetic late cross-module audit refusal.'));
        }
    } else {
        crossWait($root.'/'.$token.'.locked');
        DB::connection()->beforeExecuting(function ($sql, $bindings) use (&$observed, $case, $root, $token): void {
            if (! $observed && crossAnchor($sql, $bindings, $case)) {
                $observed = true;
                file_put_contents($root.'/'.$token.'.attempted', '1');
            }
        });
    }
    $result = Fixture::run($actor, $case[$side], $case, $case[$side.'_body']);
    recommendationEnsure($observed && DB::transactionLevel() === 0, 'Observed anchor and closed child transaction required.');
    file_put_contents($root.'/'.$token.'.'.$side.'.done', '1');
    echo json_encode($result + ['barrier' => true], JSON_THROW_ON_ERROR)."\n";
    exit(0);
}

$stage = 'empty_schema';
recommendationEnsure((int) DB::selectOne('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()')->total === 0, 'Empty schema required; no reset/replay.');
$version = DB::selectOne('SELECT VERSION() AS version')->version;
$isolation = DB::selectOne('SELECT @@transaction_isolation AS level')->level;
recommendationEnsure(str_starts_with($version, '8.0.46') && $isolation === 'REPEATABLE-READ'
    && (int) DB::selectOne('SELECT @@foreign_key_checks AS enabled')->enabled === 1, 'Pinned MySQL, repeatable-read and active foreign keys required.');
pcntl_async_signals(true);
pcntl_signal(SIGALRM, fn () => throw new RecommendationMysqlAssertion('Parent deadline expired.'));
pcntl_alarm(300);
recommendationEnsure(Artisan::call('migrate', ['--force' => true]) === 0, 'Isolated fresh migration failed.');
recommendationEnsure(Artisan::call('db:seed', ['--class' => RolesSeeder::class, '--force' => true]) === 0, 'Role fixtures failed.');
DB::table('jobs')->insert(['queue' => 'default', 'payload' => 'synthetic-recommendation-cross-sentinel', 'attempts' => 0,
    'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
$unrelated = [];
foreach (['jobs', 'reservations', 'payment_attempts', 'outbox_events', 'reservation_files', 'reservation_reports'] as $table) {
    $unrelated[$table] = Integrity::rows($table);
}

function crossCounts(): array
{
    return ['audits' => DB::table('audit_events')->count(), 'rule_versions' => DB::table('recommendation_rule_versions')->count(),
        'article_versions' => DB::table('article_versions')->count(), 'reviews' => DB::table('recommendation_rule_reviews')->count(),
        'health_versions' => DB::table('patient_health_snapshots')->count(), 'article_revision' => (int) DB::table('article_catalog_state')->value('revision'),
        'rule_revision' => (int) DB::table('recommendation_catalog_state')->value('revision')];
}

function crossPair(array $case): array
{
    global $stage, $root;
    $stage = $case['name'].'_fixture';
    $fixture = Fixture::build($case);
    $before = crossCounts();
    $immutable = [];
    foreach (['recommendation_rule_versions', 'recommendation_rule_reviews', 'recommendation_rule_version_targets',
        'article_versions', 'article_version_terms', 'patient_health_snapshots', 'patient_biometric_observations'] as $table) {
        $immutable[$table] = Integrity::rows($table);
    }
    $token = bin2hex(random_bytes(8));
    file_put_contents($root.'/'.$token.'.json', json_encode($fixture, JSON_THROW_ON_ERROR));
    $stage = $case['name'].'_interleaving';
    $children = [];
    $results = [];
    try {
        foreach (['leader', 'follower'] as $side) {
            $children[$side] = new Process([PHP_BINARY, __FILE__, 'child', $token, $side], '/var/www', timeout: 30);
            $children[$side]->start();
        }
        crossWait($root.'/'.$token.'.leader.prepared');
        crossWait($root.'/'.$token.'.follower.prepared');
        $connection = (int) file_get_contents($root.'/'.$token.'.follower.prepared');
        file_put_contents($root.'/'.$token.'.go', '1');
        crossWait($root.'/'.$token.'.locked');
        crossWait($root.'/'.$token.'.attempted');
        $seen = false;
        $until = microtime(true) + 4;
        do {
            foreach (DB::select('SHOW FULL PROCESSLIST') as $thread) {
                if ((int) $thread->Id === $connection && in_array($thread->Command, ['Query', 'Execute'], true)
                    && crossAnchor((string) $thread->Info, [$fixture['patient'], $fixture['doctor']], $fixture)) {
                    $seen = true;
                    break;
                }
            }
            if (! $seen) {
                usleep(10000);
            }
        } while (! $seen && microtime(true) < $until);
        recommendationEnsure($seen && ! is_file($root.'/'.$token.'.follower.done'), 'Exact contender must wait on the real cross-module anchor.');
        file_put_contents($root.'/'.$token.'.release', '1');
        foreach ($children as $side => $child) {
            $child->wait();
            if (! $child->isSuccessful()) {
                foreach (preg_split('/\r?\n/', $child->getErrorOutput()) as $line) {
                    $diagnostic = json_decode($line, true);
                    if (is_array($diagnostic) && ($diagnostic['recommendation_mysql_failure'] ?? null) === true) {
                        fwrite(STDERR, json_encode($diagnostic, JSON_THROW_ON_ERROR)."\n");
                    }
                }
                throw new RecommendationMysqlAssertion('Child failed; preserve the populated fixture.');
            }
            $results[$side] = json_decode($child->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        }
    } finally {
        foreach ($children as $child) {
            if ($child->isRunning()) {
                $child->stop(1);
            }
        }
    }
    fwrite(STDERR, json_encode(['recommendation_cross_pair_observed' => ['name' => $case['name'], 'results' => $results]], JSON_THROW_ON_ERROR)."\n");
    recommendationEnsure(array_column($results, 'outcome') === $case['expected'], 'Exact ordered cross-module outcomes required.');
    foreach (['leader', 'follower'] as $side) {
        recommendationEnsure($results[$side]['barrier'] === true, 'Each operation must observe its actual database anchor.');
        if ($case[$side] === 'match') {
            $expected = in_array($results[$side]['outcome'], ['matched', 'no_matches', 'insufficient_information'], true) ? 1 : 0;
            recommendationEnsure($results[$side]['health_reads'] === $expected, 'Private health reads must obey current eligibility/authority.');
        }
    }
    $after = crossCounts();
    foreach (['audits', 'article_revision', 'rule_revision', 'health_versions', 'reviews'] as $key) {
        recommendationEnsure($after[$key] === $before[$key] + $case[$key], 'Exact writer/history/audit/catalog delta required.');
    }
    recommendationEnsure($after['rule_versions'] === $before['rule_versions'] && $after['article_versions'] === $before['article_versions'], 'No incidental rule/article version writes allowed.');
    foreach ($immutable as $table => $rows) {
        recommendationEnsure(array_slice(Integrity::rows($table), 0, count($rows)) === $rows, 'All prior immutable clinical/content/health history must remain unchanged.');
    }
    $owner = Fixture::owner($fixture);
    recommendationEnsure($owner === ['outcome' => $case['post_state'], 'health_reads' => $case['post_health_reads']], 'Fresh owner result after both operations must reflect current state.');
    $record = ['name' => $case['name'], 'outcomes' => array_column($results, 'outcome'), 'anchor' => $case['anchor'],
        'contender_lock_observed' => true, 'exact_atomic_deltas_verified' => true, 'immutable_history_preserved' => true,
        'post_state' => $owner['outcome'], 'private_read_boundaries_verified' => true];
    fwrite(STDERR, json_encode(['recommendation_cross_case' => $record], JSON_THROW_ON_ERROR)."\n");
    // Ordinary audited retirement isolates the next fixture; never clear publication/review columns directly.
    Fixture::retire($fixture);

    return $record;
}

$stage = 'foreign_key_integrity';
$integrity = Integrity::foreignKeys();
fwrite(STDERR, json_encode(['recommendation_cross_integrity' => $integrity], JSON_THROW_ON_ERROR)."\n");
$stage = 'expiry_and_health_states';
$temporal = Integrity::temporal();
fwrite(STDERR, json_encode(['recommendation_cross_temporal' => $temporal], JSON_THROW_ON_ERROR)."\n");
$stage = 'exact_review_replacement';
$replacement = Integrity::replacement();
fwrite(STDERR, json_encode(['recommendation_cross_replacement' => $replacement], JSON_THROW_ON_ERROR)."\n");
$cases = [];
foreach ($matrix as $case) {
    $cases[] = crossPair($case);
}
foreach ($unrelated as $table => $rows) {
    recommendationEnsure(Integrity::rows($table) === $rows, 'Unrelated clinical/finance/outbox and queue sentinel must remain unchanged.');
}
pcntl_alarm(0);
echo json_encode(['acceptance' => 'passed', 'database' => 'checkupino_schedule_acceptance', 'mysql' => $version, 'isolation' => $isolation,
    'integrity' => $integrity, 'temporal' => $temporal, 'replacement' => $replacement, 'cases' => $cases,
    'unrelated_tables_and_queue_preserved' => true,
    'limits' => 'Synthetic isolated schema/domain/forced-interleaving acceptance only. Real clinical review, live migration/activation, served browser/session and media acceptance are separate.'], JSON_THROW_ON_ERROR)."\n";
