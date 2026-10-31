<?php

// Metadata only. Run as www-data in the existing app; never migrates or reads patient rows.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

try {
    $flagInProcess = getenv('PATIENT_HEALTH_ENABLED') !== false;
    $mode = $argv[1] ?? '';
    if (count($argv) > 2 || ! in_array($mode, ['', '--expect-unmigrated', '--expect-migrated-disabled', '--expect-enabled'], true)
        || posix_geteuid() !== 33 || getcwd() !== '/var/www') {
        throw new RuntimeException('Owned application context required.');
    }
    require '/var/www/vendor/autoload.php';
    $app = require '/var/www/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    if (DB::connection()->getDriverName() !== 'mysql') {
        throw new RuntimeException('Expected application MySQL context.');
    }
    DB::statement('SET TRANSACTION READ ONLY');
    DB::beginTransaction();
    try {
        $result = ['acceptance' => 'read_only_activation_inspection', 'uid' => posix_geteuid(),
            'health_enabled' => config('patient_health.enabled') === true,
            'health_flag_in_process' => $flagInProcess,
            'snapshot_table_exists' => Schema::hasTable('patient_health_snapshots'),
            'observation_table_exists' => Schema::hasTable('patient_biometric_observations'),
            'migration_recorded' => DB::table('migrations')->where('migration', '2026_10_22_000001_create_patient_health_foundation_tables')->exists(),
            'encryption_key_configured' => is_string(config('app.key')) && config('app.key') !== '',
            'configuration_cached' => $app->configurationIsCached(),
            'patient_rows_read' => 0, 'writes' => 0];
    } finally {
        DB::rollBack();
    }
    if ($mode !== '') {
        $migrated = $mode !== '--expect-unmigrated';
        if ($result['health_enabled'] !== ($mode === '--expect-enabled') || $result['snapshot_table_exists'] !== $migrated
            || $result['observation_table_exists'] !== $migrated || $result['migration_recorded'] !== $migrated
            || ! $result['encryption_key_configured'] || $result['configuration_cached'] || $result['health_flag_in_process']) {
            throw new RuntimeException('Activation metadata precondition failed.');
        }
        $result['expected_state_verified'] = true;
    }
    echo json_encode($result, JSON_THROW_ON_ERROR)."\n";
} catch (Throwable $error) {
    // No exception messages, credentials, query text, key fingerprints or private values.
    fwrite(STDERR, json_encode(['acceptance' => 'refused', 'class' => $error::class], JSON_THROW_ON_ERROR)."\n");
    exit(1);
}
