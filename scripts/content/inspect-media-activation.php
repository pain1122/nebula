<?php

// Read-only exact extension/feature boundary. No content, patient information or credentials are emitted.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

try {
    $mode = $argv[1] ?? '';
    if (count($argv) !== 2 || ! in_array($mode, ['--expect-unmigrated', '--expect-migrated-disabled', '--expect-enabled'], true)
        || posix_geteuid() !== 33 || getcwd() !== '/var/www') {
        throw new RuntimeException('Owned application context required.');
    }
    require '/var/www/vendor/autoload.php';
    $app = require '/var/www/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    if (DB::connection()->getDriverName() !== 'mysql' || $app->configurationIsCached()
        || config('article_content.enabled') !== true || config('article_content.scheduling_enabled') !== false
        || config('article_content.publisher_enabled') !== false) {
        throw new RuntimeException('Expected inactive scheduler and uncached article administration required.');
    }
    DB::statement('SET TRANSACTION READ ONLY');
    DB::beginTransaction();
    try {
        $hashes = [];
        $counts = [];
        foreach (['article_catalog_state', 'articles', 'article_versions', 'article_terms', 'article_term_versions', 'article_version_terms', 'jobs'] as $table) {
            if (! Schema::hasTable($table) || DB::table($table)->count() > 50000) {
                throw new RuntimeException('Foundation or bounded inspection requirement failed.');
            }
            $query = DB::table($table)->orderBy('id');
            if ($table === 'article_versions') {
                // Compare original columns across additive DDL; nullable presentation is inspected separately.
                $query->select(array_values(array_diff(Schema::getColumnListing($table), ['presentation'])));
            }
            $rows = $query->get();
            $counts[$table] = $rows->count();
            $hashes[$table] = hash('sha256', json_encode($rows, JSON_THROW_ON_ERROR));
        }
        $migrated = $mode !== '--expect-unmigrated';
        $tables = [];
        foreach (['article_publication_schedules', 'article_media_assets', 'article_version_media'] as $table) {
            $tables[$table] = Schema::hasTable($table);
            if ($tables[$table] !== $migrated) {
                throw new RuntimeException('Absent, complete or partial schema differs from the expected stage.');
            }
            if ($migrated) {
                $counts[$table] = DB::table($table)->count();
            }
        }
        $recorded = DB::table('migrations')->where('migration', '2026_10_23_000001_create_article_scheduling_media_tables')->exists();
        if ($recorded !== $migrated || Schema::hasColumn('article_versions', 'presentation') !== $migrated
            || config('article_content.media_enabled') !== ($mode === '--expect-enabled')
            || config('article_content.presentation_enabled') !== ($mode === '--expect-enabled')) {
            throw new RuntimeException('Extension or feature stage mismatch.');
        }
        echo json_encode(['acceptance' => 'passed', 'stage' => $mode, 'uid' => 33, 'tables' => $tables,
            'counts' => $counts, 'hashes' => $hashes, 'migration_recorded' => $recorded,
            'media_enabled' => config('article_content.media_enabled'), 'presentation_enabled' => config('article_content.presentation_enabled'),
            'scheduled_publication_enabled' => false, 'writes' => 0], JSON_THROW_ON_ERROR)."\n";
    } finally {
        DB::rollBack();
    }
} catch (Throwable $error) {
    fwrite(STDERR, json_encode(['acceptance' => 'refused', 'class' => $error::class], JSON_THROW_ON_ERROR)."\n");
    exit(1);
}
