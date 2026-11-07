<?php

// Real recommendation service saves; only the admitted empty disposable MySQL is allowed.
use App\Models\AuditEvent;
use App\Models\User;
use Database\Seeders\RolesSeeder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
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
        'assertion' => $error instanceof RecommendationMysqlAssertion ? $error->getMessage() : null], JSON_THROW_ON_ERROR)."\n");
    exit(1);
};
set_exception_handler($failure);
$mode = $argv[1] ?? '';
$root = '/tmp/checkupino-recommendation-mysql';
recommendationEnsure(in_array($mode, ['parent', 'child'], true) && getenv('CHECKUPINO_RECOMMENDATION_MYSQL') === 'true'
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
$matrix = json_decode(file_get_contents('/var/www/scripts/recommendations/mysql-cases.json'), true, flags: JSON_THROW_ON_ERROR);
recommendationEnsure(count($matrix) === 8, 'Exact eight-case matrix required.');

function recommendationWait(string $path): void
{
    $until = microtime(true) + 8;
    do {
        clearstatcache(true, $path);
        if (is_file($path)) {
            return;
        }
        usleep(10000);
    } while (microtime(true) < $until);
    throw new RecommendationMysqlAssertion('Transaction barrier timed out.');
}

function recommendationRequest(User $actor, string $method = 'GET', array $body = []): Request
{
    $request = $method === 'GET' ? Request::create('/', 'GET', $body)
        : Request::create('/', $method, [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR));
    app()->instance('request', $request);
    $request->setUserResolver(fn () => $actor);
    $session = app('session')->driver();
    $session->start();
    $session->put('auth.password_confirmed_at', time());
    $request->setLaravelSession($session);

    return $request;
}

config(['recommendations.authoring_enabled' => true, 'recommendations.enabled' => false]);

function recommendationRun(User $actor, string $operation, string $id, array $body): array
{
    $service = app(App\Services\Recommendations\RecommendationAdministration::class);
    $request = recommendationRequest($actor, $operation === 'draft' ? 'PUT' : 'POST', $body);

    return match ($operation) {
        'draft' => $service->save($request, $id),
        'revoke' => $service->designate($request, $id),
        default => $service->act($request, $id),
    };
}

function recommendationContent(string $article): array
{
    return ['definition' => ['schema_version' => 1, 'health_catalog_version' => App\Services\Health\HealthCatalog::VERSION,
        'include' => ['field' => 'smoking', 'operator' => 'eq', 'value' => 'yes', 'max_age_days' => 30], 'exclude' => null],
        'translations' => ['en' => ['title' => 'Synthetic rule', 'explanation' => 'Invented software fixture only.'],
            'fa' => ['title' => 'قاعده ساختگی', 'explanation' => 'فقط نمونه ساختگی نرم‌افزار.']],
        'population' => ['en' => 'Synthetic test records.', 'fa' => 'رکوردهای ساختگی آزمون.'],
        'limitations' => ['en' => 'No actual clinical review or criteria.', 'fa' => 'بدون بازبینی یا معیار بالینی واقعی.'],
        'sources' => [['label' => 'Synthetic reference', 'url' => 'https://example.test/synthetic']], 'targets' => [$article], 'priority' => 1];
}

function recommendationFixture(array $case): array
{
    global $stage;
    $stage = $case['name'].'_article_fixture';
    $admin = User::factory()->admin()->create()->fresh();
    $rootActor = User::factory()->rootAdmin()->create()->fresh();
    $doctor = User::factory()->doctor()->create()->fresh();
    App\Models\DoctorProfile::factory()->create(['user_id' => $doctor->id, 'verified' => true]);
    $articleWriter = app(App\Services\Content\ArticleDraftWrite::class);
    $context = $articleWriter->context(recommendationRequest($admin), null);
    $slug = str_replace('_', '-', $case['name']);
    $article = $articleWriter->save(recommendationRequest($admin, 'POST', ['slug' => 'synthetic-'.$slug,
        'expected_revision' => $context['revision'], 'reason' => 'Synthetic isolated recommendation fixture.', 'confirmed' => true,
        'intent' => 'publish', 'editorial_confirmed' => true,
        'translations' => ['en' => ['title' => 'Synthetic article', 'body_html' => '<p>Invented software fixture only.</p>', 'seo' => []]],
        'taxonomy' => [], 'health_references' => [], 'source_links' => []]), null);
    $stage = $case['name'].'_rule_fixture';
    $service = app(App\Services\Recommendations\RecommendationAdministration::class);
    $create = $service->read(recommendationRequest($admin))['create_revision'];
    $content = recommendationContent($article['id']);
    $rule = $service->save(recommendationRequest($admin, 'POST', ['slug' => 'rule-'.$slug, 'content' => $content,
        'expected_revision' => $create, 'action_key' => (string) Illuminate\Support\Str::uuid()]), null)['id'];
    $grant = null;
    if ($case['mode'] !== 'draft') {
        $grantRevision = $service->read(recommendationRequest($rootActor))['grant_revision'];
        $grant = $service->designate(recommendationRequest($rootActor, 'POST', ['expected_revision' => $grantRevision,
            'action_key' => (string) Illuminate\Support\Str::uuid(), 'confirmed' => true,
            'reviewer_id' => $doctor->public_id, 'evidence_ref' => 'synthetic-software-fixture-not-qualification',
            'valid_until_local' => now('Asia/Tehran')->addDays(30)->format('Y-m-d\TH:i')]))['id'];
        $view = $service->read(recommendationRequest($admin), $rule);
        $service->act(recommendationRequest($admin, 'POST', ['action' => 'submit', 'reviewer_id' => $doctor->public_id,
            'expected_revision' => $view['contexts']['submit'], 'action_key' => (string) Illuminate\Support\Str::uuid()]), $rule);
        if ($case['mode'] === 'reviewed') {
            $view = $service->read(recommendationRequest($doctor), $rule);
            $service->act(recommendationRequest($doctor, 'POST', ['action' => 'approve', 'assessment' => 'Synthetic software mechanics, not actual clinical review.',
                'attested' => true, 'valid_until_local' => now('Asia/Tehran')->addDays(7)->format('Y-m-d\TH:i'),
                'expected_revision' => $view['contexts']['approve'], 'action_key' => (string) Illuminate\Support\Str::uuid()]), $rule);
        }
    }
    $fixture = $case + ['rule' => $rule, 'grant' => $grant];
    foreach (['leader', 'follower'] as $side) {
        $operation = $case[$side];
        $actor = in_array($operation, ['approve', 'withdraw'], true) ? $doctor : ($operation === 'revoke' ? $rootActor : $admin);
        $body = ['action_key' => (string) Illuminate\Support\Str::uuid()];
        if ($operation === 'revoke') {
            $board = $service->read(recommendationRequest($actor));
            $body += ['expected_revision' => collect($board['grants'])->firstWhere('id', $grant)['revoke_revision'], 'confirmed' => true];
        } else {
            $view = $service->read(recommendationRequest($actor), $rule);
            $body['expected_revision'] = $view['contexts'][$operation === 'draft' ? 'save' : $operation];
            if ($operation === 'draft') {
                $changed = $content;
                $changed['translations']['en']['explanation'] = 'Synthetic '.$side.' replacement.';
                $body += ['slug' => 'rule-'.$slug, 'content' => $changed];
            } else {
                $body['action'] = $operation;
                if ($operation === 'approve') {
                    $body += ['assessment' => 'Synthetic independent assessment.', 'attested' => true, 'valid_until_local' => now('Asia/Tehran')->addDays(7)->format('Y-m-d\TH:i')];
                } elseif ($operation === 'withdraw') {
                    $body += ['assessment' => 'Withdraw synthetic approval.', 'review_id' => $view['reviews'][0]['id']];
                }
            }
        }
        $fixture[$side.'_actor'] = $actor->id;
        $fixture[$side.'_id'] = $operation === 'revoke' ? $grant : $rule;
        $fixture[$side.'_body'] = $body;
    }
    if ($case['duplicate'] ?? false) {
        $fixture['follower_body'] = $fixture['leader_body'];
    }

    return $fixture;
}

if ($mode === 'child') {
    [$token, $side] = [$argv[2] ?? '', $argv[3] ?? ''];
    recommendationEnsure(count($argv) === 4 && preg_match('/^[a-f0-9]{16}$/D', $token) && in_array($side, ['leader', 'follower'], true), 'Invalid child arguments.');
    $case = json_decode(file_get_contents($root.'/'.$token.'.json'), true, flags: JSON_THROW_ON_ERROR);
    $actor = User::findOrFail($case[$side.'_actor']);
    $stage = $case['name'].'-'.$side;
    file_put_contents($root.'/'.$token.'.'.$side.'.prepared', (string) DB::connection()->getPdo()->query('SELECT CONNECTION_ID()')->fetchColumn());
    recommendationWait($root.'/'.$token.'.go');
    $observed = false;
    $locking = fn (string $sql) => str_contains(strtolower($sql), 'for update') && str_contains($sql, '`recommendation_catalog_state`');
    if ($side === 'leader') {
        DB::listen(function ($query) use (&$observed, $locking, $root, $token): void {
            if (! $observed && $locking($query->sql)) {
                recommendationEnsure(DB::transactionLevel() === 1, 'Real catalog transaction required.');
                $observed = true;
                file_put_contents($root.'/'.$token.'.locked', '1');
                recommendationWait($root.'/'.$token.'.release');
            }
        });
        if ($case['audit_failure'] ?? false) {
            AuditEvent::creating(fn () => throw new RecommendationAuditRefusal('Synthetic late audit refusal.'));
        }
    } else {
        recommendationWait($root.'/'.$token.'.locked');
        DB::connection()->beforeExecuting(function ($sql) use (&$observed, $locking, $root, $token): void {
            if (! $observed && $locking($sql)) {
                $observed = true;
                file_put_contents($root.'/'.$token.'.attempted', '1');
            }
        });
    }
    try {
        recommendationRun($actor, $case[$side], $case[$side.'_id'], $case[$side.'_body']);
        $outcome = 'committed';
    } catch (RecommendationAuditRefusal) {
        $outcome = 'audit_rolled_back';
    } catch (HttpExceptionInterface $error) {
        recommendationEnsure(in_array($error->getStatusCode(), [403, 409], true), 'Unexpected HTTP refusal.');
        $outcome = $error->getStatusCode() === 403 ? 'forbidden' : 'conflict';
    }
    recommendationEnsure($observed && DB::transactionLevel() === 0, 'Barrier and closed child transaction required.');
    file_put_contents($root.'/'.$token.'.'.$side.'.done', '1');
    echo json_encode(['outcome' => $outcome, 'barrier' => true], JSON_THROW_ON_ERROR)."\n";
    exit(0);
}

$stage = 'empty_schema';
recommendationEnsure((int) DB::selectOne('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()')->total === 0, 'Empty schema required; no reset/replay.');
$version = DB::selectOne('SELECT VERSION() AS version')->version;
$isolation = DB::selectOne('SELECT @@transaction_isolation AS level')->level;
recommendationEnsure(str_starts_with($version, '8.0.46') && $isolation === 'REPEATABLE-READ', 'Pinned MySQL and isolation required.');
pcntl_async_signals(true);
pcntl_signal(SIGALRM, fn () => throw new RecommendationMysqlAssertion('Parent deadline expired.'));
pcntl_alarm(180);
recommendationEnsure(Artisan::call('migrate', ['--force' => true]) === 0, 'Isolated migration failed.');
$migration = require '/var/www/database/migrations/2026_11_05_000001_create_recommendation_rule_tables.php';
$migration->down();
$migration->up();
recommendationEnsure(Artisan::call('db:seed', ['--class' => RolesSeeder::class, '--force' => true]) === 0, 'Role fixtures failed.');
DB::table('jobs')->insert(['queue' => 'default', 'payload' => 'synthetic-recommendation-sentinel', 'attempts' => 0, 'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);

function recommendationRows(string $table): array
{
    return DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
}

function recommendationPair(array $case): array
{
    global $stage, $root;
    $stage = $case['name'];
    $fixture = recommendationFixture($case);
    $stage = $case['name'].'_interleaving';
    $immutable = [];
    foreach (['recommendation_rule_versions', 'recommendation_rule_reviews', 'recommendation_rule_version_targets', 'article_versions', 'article_version_terms'] as $table) {
        $immutable[$table] = recommendationRows($table);
    }
    $before = ['versions' => DB::table('recommendation_rule_versions')->count(), 'reviews' => DB::table('recommendation_rule_reviews')->count(),
        'audits' => AuditEvent::count(), 'revision' => (int) DB::table('recommendation_catalog_state')->value('revision')];
    $token = bin2hex(random_bytes(8));
    file_put_contents($root.'/'.$token.'.json', json_encode($fixture, JSON_THROW_ON_ERROR));
    $children = [];
    $results = [];
    try {
        foreach (['leader', 'follower'] as $side) {
            $children[$side] = new Process([PHP_BINARY, __FILE__, 'child', $token, $side], '/var/www', timeout: 25);
            $children[$side]->start();
        }
        recommendationWait($root.'/'.$token.'.leader.prepared');
        recommendationWait($root.'/'.$token.'.follower.prepared');
        $connection = (int) file_get_contents($root.'/'.$token.'.follower.prepared');
        file_put_contents($root.'/'.$token.'.go', '1');
        recommendationWait($root.'/'.$token.'.locked');
        recommendationWait($root.'/'.$token.'.attempted');
        $seen = false;
        $until = microtime(true) + 4;
        do {
            foreach (DB::select('SHOW FULL PROCESSLIST') as $thread) {
                if ((int) $thread->Id === $connection && in_array($thread->Command, ['Query', 'Execute'], true)
                    && str_contains((string) $thread->Info, '`recommendation_catalog_state`') && str_contains(strtolower((string) $thread->Info), 'for update')) {
                    $seen = true;
                    break;
                }
            }
            if (! $seen) {
                usleep(10000);
            }
        } while (! $seen && microtime(true) < $until);
        recommendationEnsure($seen && ! is_file($root.'/'.$token.'.follower.done'), 'Contender must be observed on the held real catalog lock.');
        file_put_contents($root.'/'.$token.'.release', '1');
        foreach ($children as $side => $child) {
            $child->wait();
            recommendationEnsure($child->isSuccessful(), 'Child failed; preserve the populated fixture.');
            $results[$side] = json_decode($child->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        }
    } finally {
        foreach ($children as $child) {
            if ($child->isRunning()) {
                $child->stop(1);
            }
        }
    }
    fwrite(STDERR, json_encode(['recommendation_mysql_pair_observed' => ['name' => $case['name'], 'outcomes' => array_column($results, 'outcome'),
        'contender_lock_observed' => true]], JSON_THROW_ON_ERROR)."\n");
    recommendationEnsure(array_column($results, 'outcome') === $case['expected'], 'Exact paired outcomes required.');
    recommendationEnsure(DB::table('recommendation_rule_versions')->count() === $before['versions'] + $case['versions'], 'Exact version delta required.');
    recommendationEnsure(DB::table('recommendation_rule_reviews')->count() === $before['reviews'] + $case['reviews'], 'Exact review delta required.');
    recommendationEnsure(AuditEvent::count() === $before['audits'] + 1 && (int) DB::table('recommendation_catalog_state')->value('revision') === $before['revision'] + 1, 'One atomic audit/catalog commit required.');
    foreach ($immutable as $table => $rows) {
        recommendationEnsure(array_slice(recommendationRows($table), 0, count($rows)) === $rows, 'All prior immutable versions/reviews/targets must remain unchanged.');
    }
    $rule = DB::table('recommendation_rules')->where('public_id', $fixture['rule'])->first();
    recommendationEnsure($rule->published_version === null && $rule->published_review_id === null, 'No blocked publication may become active.');
    if ($case['leader'] === 'retire') {
        recommendationEnsure($rule->retired_at !== null, 'Retirement must persist.');
    }
    if ($case['leader'] === 'revoke') {
        recommendationEnsure(DB::table('recommendation_reviewer_grants')->where('public_id', $fixture['grant'])->value('revoked_at') !== null, 'Grant revocation must persist.');
    }
    $snapshot = app(App\Services\Recommendations\RecommendationAdministration::class)->read(recommendationRequest(User::findOrFail($fixture['leader'] === 'revoke' ? $fixture['follower_actor'] : $fixture['leader_actor'])), $fixture['rule']);
    recommendationEnsure(is_string($snapshot['working']['content_hash']), 'MySQL JSON round-trip hash must remain readable.');
    $result = ['name' => $case['name'], 'outcomes' => array_column($results, 'outcome'), 'contender_lock_observed' => true, 'atomic_versions_audits_catalog_verified' => true];
    fwrite(STDERR, json_encode(['recommendation_mysql_case' => $result], JSON_THROW_ON_ERROR)."\n");

    return $result;
}

$unrelated = [];
foreach (['jobs', 'reservations', 'payment_attempts', 'outbox_events', 'patient_health_snapshots', 'patient_biometric_observations', 'reservation_files', 'reservation_reports'] as $table) {
    $unrelated[$table] = recommendationRows($table);
}
$cases = [];
foreach ($matrix as $case) {
    $cases[] = recommendationPair($case);
}
foreach ($unrelated as $table => $rows) {
    recommendationEnsure(recommendationRows($table) === $rows, 'Unrelated lifecycle, private health and sentinel jobs must be unchanged.');
}
pcntl_alarm(0);
echo json_encode(['acceptance' => 'passed', 'database' => 'checkupino_schedule_acceptance', 'mysql' => $version, 'isolation' => $isolation, 'cases' => $cases,
    'empty_rollback_verified' => true, 'unrelated_tables_and_queue_preserved' => true,
    'limits' => 'First catalog-coordination slice only. Cross-module article/account/profile/health races, full FK-negative matrix, live HTTP/session/browser, actual clinical review and activation remain open.'], JSON_THROW_ON_ERROR)."\n";
