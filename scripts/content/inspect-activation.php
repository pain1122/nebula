<?php

// Metadata only. This script never migrates, enables a feature or reads content/private health.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

try {
    $inProcess = getenv('ARTICLE_ADMIN_ENABLED') !== false;
    $mode = $argv[1] ?? '';
    if (count($argv) > 2 || ! in_array($mode, ['', '--expect-unmigrated', '--expect-migrated-disabled', '--expect-enabled'], true)
        || posix_geteuid() !== 33 || getcwd() !== '/var/www') {
        throw new RuntimeException('Owned context required.');
    }
    require '/var/www/vendor/autoload.php';
    $app = require '/var/www/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    if (DB::connection()->getDriverName() !== 'mysql') {
        throw new RuntimeException('Application MySQL required.');
    }
    DB::statement('SET TRANSACTION READ ONLY');
    DB::beginTransaction();
    try {
        $tables = [];
        foreach (['article_catalog_state', 'article_terms', 'article_term_versions', 'articles', 'article_versions', 'article_version_terms'] as $table) {
            $tables[$table] = Schema::hasTable($table);
        }
        $result = ['acceptance' => 'read_only_article_activation_inspection', 'uid' => posix_geteuid(),
            'enabled' => config('article_content.enabled') === true, 'flag_in_process' => $inProcess,
            'tables' => $tables,
            'migration_recorded' => DB::table('migrations')->where('migration', '2026_10_22_000002_create_article_content_foundation_tables')->exists(),
            'configuration_cached' => $app->configurationIsCached(),
            'health_enabled' => config('patient_health.enabled') === true,
            'coordination_row_exists' => $tables['article_catalog_state'] && DB::table('article_catalog_state')->where('id', 1)->exists(),
            'content_or_patient_rows_read' => 0, 'writes' => 0];
    } finally {
        DB::rollBack();
    }
    if ($mode !== '') {
        $migrated = $mode !== '--expect-unmigrated';
        if ($result['enabled'] !== ($mode === '--expect-enabled') || $result['migration_recorded'] !== $migrated
            || $result['coordination_row_exists'] !== $migrated || $result['configuration_cached'] || $inProcess
            || count(array_filter($tables, fn (bool $exists): bool => $exists !== $migrated)) > 0) {
            throw new RuntimeException('Activation precondition failed.');
        }
        $result['expected_state_verified'] = true;
    }
    echo json_encode($result, JSON_THROW_ON_ERROR)."\n";
} catch (Throwable $error) {
    fwrite(STDERR, json_encode(['acceptance' => 'refused', 'class' => $error::class], JSON_THROW_ON_ERROR)."\n");
    exit(1);
}
