<?php

// Real content service saves; only the admitted empty disposable MySQL is allowed.
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

class ContentMysqlAssertion extends RuntimeException {}
class ContentAuditRefusal extends RuntimeException {}

function contentEnsure(bool $condition, string $message): void
{
    if (! $condition) {
        throw new ContentMysqlAssertion($message);
    }
}

$stage = 'configuration';
$failure = function (Throwable $error) use (&$stage): void {
    fwrite(STDERR, json_encode(['content_mysql_failure' => true, 'stage' => $stage, 'class' => $error::class,
        'line' => $error->getLine(), 'file' => str_replace('/var/www/', '', $error->getFile()),
        'mysql_code' => $error instanceof QueryException ? ($error->errorInfo[1] ?? null) : null,
        'assertion' => $error instanceof ContentMysqlAssertion ? $error->getMessage() : null], JSON_THROW_ON_ERROR)."\n");
    exit(1);
};
set_exception_handler($failure);
$mode = $argv[1] ?? '';
$root = '/tmp/checkupino-content-mysql';
contentEnsure(in_array($mode, ['parent', 'child'], true) && getenv('CHECKUPINO_CONTENT_MYSQL') === 'true'
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
    contentEnsure(count($argv) === 2 && ! file_exists($root), 'A fresh process and temporary storage are required.');
    mkdir($root, 0700);
    foreach (['framework/cache', 'framework/sessions', 'framework/views', 'logs', 'private'] as $directory) {
        mkdir($root.'/'.$directory, 0700, true);
    }
    file_put_contents($root.'/empty.environment', '');
}
$stat = lstat($root);
contentEnsure(is_array($stat) && $stat['uid'] === 33 && ($stat['mode'] & 0170000) === 0040000
    && ! file_exists($root.'/.env') && ! file_exists($root.'/.env.testing') && ! file_exists($root.'/config.php')
    && is_file($root.'/empty.environment') && filesize($root.'/empty.environment') === 0, 'Owned empty isolated environment is required.');
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->useEnvironmentPath($root)->loadEnvironmentFrom('empty.environment');
$stage = 'boot';
$app->make(Kernel::class)->bootstrap();
set_exception_handler($failure);
contentEnsure(config('database.default') === 'mysql' && config('database.connections.mysql.host') === 'mysql-acceptance'
    && config('database.connections.mysql.database') === 'checkupino_schedule_acceptance' && ! config('database.connections.mysql.url')
    && config('queue.default') === 'database' && config('cache.default') === 'array' && ! config('medical.scanner.enabled')
    && DB::selectOne('SELECT DATABASE() AS name')->name === 'checkupino_schedule_acceptance', 'Effective isolated configuration is required.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 8');
config(['article_content.enabled' => true]);
$matrix = json_decode(file_get_contents('/var/www/scripts/content/mysql-cases.json'), true, flags: JSON_THROW_ON_ERROR);
contentEnsure(count($matrix) === 11, 'Exact eleven-case matrix required.');

function contentWait(string $path): void
{
    $until = microtime(true) + 8;
    do {
        clearstatcache(true, $path);
        if (is_file($path)) {
            return;
        }
        usleep(10000);
    } while (microtime(true) < $until);
    throw new ContentMysqlAssertion('Transaction barrier timed out.');
}

function contentRequest(User $actor, string $method = 'GET', array $body = []): Request
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

function contentRun(User $actor, string $operation, ?string $id, array $body): array
{
    $request = contentRequest($actor, 'POST', $body);

    return match ($operation) {
        'create', 'draft' => app(App\Services\Content\ArticleDraftWrite::class)->save($request, $id),
        'term_create', 'term_update', 'term_retire' => app(App\Services\Content\ArticleTaxonomyWrite::class)->mutate($request, $id, substr($operation, 5)),
        'revoke_role' => DB::transaction(function () use ($actor): array {
            DB::table('article_catalog_state')->where('id', 1)->lockForUpdate()->first();
            User::whereKey($actor->id)->lockForUpdate()->firstOrFail();
            DB::table('model_has_roles')->where('model_type', User::class)->where('model_id', $actor->id)->delete();

            return [];
        }),
        default => app(App\Services\Content\ArticleEditorial::class)->act($request, $id),
    };
}

function contentBody(User $actor, string $operation, ?array $article, ?array $term, string $suffix): array
{
    $base = ['confirmed' => true, 'reason' => 'Synthetic isolated article acceptance'];
    if (str_starts_with($operation, 'term_')) {
        $context = app(App\Services\Content\ArticleTaxonomyWrite::class)->context(contentRequest($actor), $term['id'] ?? null);

        return $base + ['expected_revision' => $context['revision']] + ($operation === 'term_retire' ? ['action' => 'retire']
            : ['labels' => ['en' => 'Synthetic '.$suffix, 'fa' => 'واژه آزمایشی'], 'descriptions' => ['en' => 'Synthetic description', 'fa' => 'توضیح آزمایشی'], 'parent_id' => null]
            + ($term === null ? ['kind' => 'category', 'slug' => 'synthetic-'.$suffix] : []));
    }
    if (in_array($operation, ['create', 'draft'], true)) {
        $context = app(App\Services\Content\ArticleDraftWrite::class)->context(contentRequest($actor), $article['id'] ?? null);

        return $base + ['expected_revision' => $context['revision'], 'slug' => $article['slug'] ?? 'synthetic-'.$suffix,
            'translations' => ['en' => ['title' => 'Synthetic '.$suffix, 'summary' => 'Educational example', 'body_html' => '<p>Synthetic bounded content.</p>'],
                'fa' => ['title' => 'مقاله آزمایشی', 'summary' => 'خلاصه آموزشی', 'body_html' => '<p>محتوای آزمایشی</p>']],
            'taxonomy' => $term === null ? [] : [['id' => $term['id'], 'kind' => 'category']],
            'health_references' => ['condition.diabetes'], 'source_links' => [['url' => 'https://example.test/source', 'label' => 'Synthetic source']]];
    }
    if ($operation === 'revoke_role') {
        return [];
    }
    $query = ['action' => $operation] + ($operation === 'copy_version' ? ['source_version_id' => $article['published']['id']] : []);
    $context = app(App\Services\Content\ArticleEditorial::class)->context(contentRequest($actor, 'GET', $query), $article['id']);

    return $base + ['action' => $operation, 'expected_revision' => $context['revision'], 'expected_version' => $context['current']['working']['version'],
        'expected_hash' => $context['current']['working']['content_hash']] + ($operation === 'copy_version'
            ? ['source_version_id' => $context['source']['id'], 'source_hash' => $context['source']['content_hash']] : []);
}

if ($mode === 'child') {
    [$token, $side] = [$argv[2] ?? '', $argv[3] ?? ''];
    contentEnsure(count($argv) === 4 && preg_match('/^[a-f0-9]{16}$/D', $token) && in_array($side, ['leader', 'follower'], true), 'Invalid child arguments.');
    $case = json_decode(file_get_contents($root.'/'.$token.'.json'), true, flags: JSON_THROW_ON_ERROR);
    $actor = User::findOrFail($case['actor']);
    $stage = $case['name'].'-'.$side;
    file_put_contents($root.'/'.$token.'.'.$side.'.prepared', (string) DB::connection()->getPdo()->query('SELECT CONNECTION_ID()')->fetchColumn());
    contentWait($root.'/'.$token.'.go');
    $observed = false;
    $locking = fn (string $sql) => str_contains(strtolower($sql), 'for update') && str_contains($sql, '`article_catalog_state`');
    if ($side === 'leader') {
        DB::listen(function ($query) use (&$observed, $locking, $root, $token): void {
            if (! $observed && $locking($query->sql)) {
                contentEnsure(DB::transactionLevel() === 1, 'Real catalog transaction required.');
                $observed = true;
                file_put_contents($root.'/'.$token.'.locked', '1');
                contentWait($root.'/'.$token.'.release');
            }
        });
        if ($case['audit_failure'] ?? false) {
            AuditEvent::creating(fn () => throw new ContentAuditRefusal('Synthetic late audit refusal.'));
        }
    } else {
        contentWait($root.'/'.$token.'.locked');
        DB::connection()->beforeExecuting(function ($sql) use (&$observed, $locking, $root, $token): void {
            if (! $observed && $locking($sql)) {
                $observed = true;
                file_put_contents($root.'/'.$token.'.attempted', '1');
            }
        });
    }
    try {
        contentRun($actor, $case[$side], $case[$side.'_id'], $case[$side.'_body']);
        $outcome = $case[$side] === 'revoke_role' ? 'authority_changed' : 'committed';
    } catch (ContentAuditRefusal) {
        $outcome = 'audit_rolled_back';
    } catch (HttpExceptionInterface $error) {
        contentEnsure(in_array($error->getStatusCode(), [403, 409], true), 'Unexpected HTTP refusal.');
        $outcome = $error->getStatusCode() === 403 ? 'forbidden' : 'conflict';
    }
    contentEnsure($observed && DB::transactionLevel() === 0, 'Barrier and closed child transaction required.');
    file_put_contents($root.'/'.$token.'.'.$side.'.done', '1');
    echo json_encode(['outcome' => $outcome, 'barrier' => true], JSON_THROW_ON_ERROR)."\n";
    exit(0);
}

$stage = 'empty_schema';
contentEnsure((int) DB::selectOne('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()')->total === 0, 'Empty schema required; no reset/replay.');
$version = DB::selectOne('SELECT VERSION() AS version')->version;
$isolation = DB::selectOne('SELECT @@transaction_isolation AS level')->level;
contentEnsure(str_starts_with($version, '8.0.46') && $isolation === 'REPEATABLE-READ', 'Pinned MySQL and isolation required.');
pcntl_async_signals(true);
pcntl_signal(SIGALRM, fn () => throw new ContentMysqlAssertion('Parent deadline expired.'));
pcntl_alarm(180);
contentEnsure(Artisan::call('migrate', ['--force' => true]) === 0, 'Isolated migration failed.');
contentEnsure(Artisan::call('db:seed', ['--class' => RolesSeeder::class, '--force' => true]) === 0, 'Role fixtures failed.');
DB::table('jobs')->insert(['queue' => 'default', 'payload' => 'synthetic-content-sentinel', 'attempts' => 0, 'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
function contentRows(string $table): array
{
    return DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
}
function contentPair(array $case): array
{
    global $stage, $root;
    $stage = $case['name'];
    $actor = User::factory()->admin()->create()->fresh();
    $term = null;
    $article = null;
    $suffix = str_replace('_', '-', $case['name']);
    if ($case['name'] !== 'concurrent_creates') {
        $term = contentRun($actor, 'term_create', null, contentBody($actor, 'term_create', null, null, $suffix));
        $article = contentRun($actor, 'create', null, contentBody($actor, 'create', null, $term, $suffix));
        if (($case['reviewed'] ?? false) || ($case['published_draft'] ?? false)) {
            foreach (['submit', 'review'] as $action) {
                $article = contentRun($actor, $action, $article['id'], contentBody($actor, $action, $article, $term, $suffix));
            }
        }
        if ($case['published_draft'] ?? false) {
            $article = contentRun($actor, 'publish', $article['id'], contentBody($actor, 'publish', $article, $term, $suffix));
            $article = contentRun($actor, 'draft', $article['id'], contentBody($actor, 'draft', $article, $term, $suffix.'-replacement'));
        }
    }
    $oldVersions = [];
    foreach (['article_versions', 'article_term_versions', 'article_version_terms'] as $table) {
        $oldVersions[$table] = contentRows($table);
    }
    $before = ['articles' => DB::table('articles')->count(), 'versions' => DB::table('article_versions')->count(), 'terms' => DB::table('article_term_versions')->count(), 'audits' => AuditEvent::count(), 'revision' => (int) DB::table('article_catalog_state')->value('revision')];
    $fixture = $case + ['actor' => $actor->id];
    foreach (['leader', 'follower'] as $side) {
        $fixture[$side.'_id'] = str_starts_with($case[$side], 'term_') ? $term['id'] : ($case[$side] === 'create' ? null : ($article['id'] ?? null));
        $fixture[$side.'_body'] = contentBody($actor, $case[$side], $article, $term, $case['name'] === 'concurrent_creates' ? $suffix : $suffix.'-'.$side);
    }
    $token = bin2hex(random_bytes(8));
    file_put_contents($root.'/'.$token.'.json', json_encode($fixture, JSON_THROW_ON_ERROR));
    $children = [];
    $results = [];
    try {
        foreach (['leader', 'follower'] as $side) {
            $children[$side] = new Process([PHP_BINARY, __FILE__, 'child', $token, $side], '/var/www', timeout: 25);
            $children[$side]->start();
        }
        contentWait($root.'/'.$token.'.leader.prepared');
        contentWait($root.'/'.$token.'.follower.prepared');
        $connection = (int) file_get_contents($root.'/'.$token.'.follower.prepared');
        file_put_contents($root.'/'.$token.'.go', '1');
        contentWait($root.'/'.$token.'.locked');
        contentWait($root.'/'.$token.'.attempted');
        $seen = false;
        $until = microtime(true) + 4;
        do {
            foreach (DB::select('SHOW FULL PROCESSLIST') as $thread) {
                if ((int) $thread->Id === $connection && in_array($thread->Command, ['Query', 'Execute'], true) && str_contains((string) $thread->Info, '`article_catalog_state`') && str_contains(strtolower((string) $thread->Info), 'for update')) {
                    $seen = true;
                    break;
                }
            } if (! $seen) {
                usleep(10000);
            }
        } while (! $seen && microtime(true) < $until);
        contentEnsure($seen && ! is_file($root.'/'.$token.'.follower.done'), 'Contender must be observed on the held real catalog lock.');
        file_put_contents($root.'/'.$token.'.release', '1');
        foreach ($children as $side => $child) {
            $child->wait();
            if (! $child->isSuccessful()) {
                fwrite(STDERR, $child->getErrorOutput());
                throw new ContentMysqlAssertion('Child failed; no replay.');
            } $results[$side] = json_decode($child->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        }
    } finally {
        foreach ($children as $child) {
            if ($child->isRunning()) {
                $child->stop(1);
            }
        }
    }
    contentEnsure(array_column($results, 'outcome') === $case['expected'], 'Exact paired outcomes required.');
    $winner = $results['leader']['outcome'] === 'committed' ? 'leader' : ($results['follower']['outcome'] === 'committed' ? 'follower' : null);
    $operation = $winner === null ? '' : $case[$winner];
    contentEnsure(DB::table('articles')->count() === $before['articles'] + (int) ($operation === 'create'), 'Exact article count required.');
    contentEnsure(DB::table('article_versions')->count() === $before['versions'] + (int) in_array($operation, ['create', 'draft', 'copy_version'], true), 'Exact immutable article version count required.');
    contentEnsure(DB::table('article_term_versions')->count() === $before['terms'] + (int) str_starts_with($operation, 'term_'), 'Exact taxonomy version count required.');
    contentEnsure(AuditEvent::count() === $before['audits'] + (int) ($winner !== null) && (int) DB::table('article_catalog_state')->value('revision') === $before['revision'] + (int) ($winner !== null), 'Atomic audit/catalog counts required.');
    foreach ($oldVersions as $table => $rows) {
        contentEnsure(array_slice(contentRows($table), 0, count($rows)) === $rows, 'All old versions/references must remain byte-for-byte unchanged.');
    }
    if ($article !== null) {
        $stored = DB::table('articles')->where('public_id', $article['id'])->first();
        contentEnsure($stored->published_version === ($operation === 'publish' ? $stored->working_version : ($article['published']['version'] ?? null)), 'Only publication may move the published pointer.');
        if ($operation === 'archive') {
            contentEnsure($stored->archived_at !== null, 'Archive must remain terminal.');
        }
    }
    $result = ['name' => $case['name'], 'outcomes' => array_column($results, 'outcome'), 'contender_lock_observed' => true, 'atomic_versions_audits_catalog_verified' => true];
    fwrite(STDERR, json_encode(['content_mysql_case' => $result], JSON_THROW_ON_ERROR)."\n");

    return $result;
}
$unrelated = [];
foreach (['jobs', 'reservations', 'payment_attempts', 'outbox_events', 'patient_health_snapshots', 'patient_biometric_observations', 'reservation_files', 'reservation_reports'] as $table) {
    $unrelated[$table] = contentRows($table);
}
$cases = [];
foreach ($matrix as $case) {
    $cases[] = contentPair($case);
}
foreach ($unrelated as $table => $rows) {
    contentEnsure(contentRows($table) === $rows, 'Unrelated lifecycle and sentinel jobs must remain untouched.');
}
pcntl_alarm(0);
echo json_encode(['acceptance' => 'passed', 'database' => 'checkupino_schedule_acceptance', 'mysql' => $version, 'isolation' => $isolation, 'cases' => $cases,
    'unrelated_tables_and_queue_preserved' => true, 'limits' => 'Real forced service interleavings. Live HTTP/session/browser and activation acceptance remain separate.'], JSON_THROW_ON_ERROR)."\n";
