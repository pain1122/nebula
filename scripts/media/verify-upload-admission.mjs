import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const probe = process.argv.includes('--probe-shared-lock');
assert(process.argv.slice(2).every(value => value === '--probe-shared-lock'), 'Unsupported verifier argument.');
const php = String.raw`<?php
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$limits = App\Services\MedicalUploadAdmission::limits();
$result = [
    'limits' => $limits,
    'scanning_enabled' => (bool) config('medical.scanner.enabled'),
    'private_driver' => config('filesystems.disks.private.driver'),
    'requests' => Illuminate\Support\Facades\DB::table('reservation_medical_requests')->count(),
    'files' => Illuminate\Support\Facades\DB::table('reservation_files')->count(),
    'reports' => Illuminate\Support\Facades\DB::table('reservation_reports')->count(),
    'jobs' => Illuminate\Support\Facades\DB::table('jobs')->count(),
    'parser_available' => is_executable('/usr/local/bin/qpdf') && extension_loaded('gd'),
];
if (getenv('CHECKUPINO_ADMISSION_LOCK_PROBE') === '1') {
    if ($limits['cache_store'] !== 'database' || config('cache.stores.database.driver') !== 'database') {
        throw new RuntimeException('Shared lock probe requires the existing database store.');
    }
    $key = 'medical-upload:acceptance:'.bin2hex(random_bytes(16));
    $cache = Illuminate\Support\Facades\Cache::store('database');
    $lock = $cache->lock($key, 60);
    $child = 'require "/var/www/vendor/autoload.php"; $app=require "/var/www/bootstrap/app.php"; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); '
        .'$lock=Illuminate\\Support\\Facades\\Cache::store("database")->lock('.var_export($key, true).',60); '
        .'$acquired=$lock->get(); try { echo json_encode(["acquired"=>$acquired,"released"=>$lock->release()],JSON_THROW_ON_ERROR); } finally { if($acquired) $lock->release(); }';
    $contend = static function () use ($child): array {
        $process = new Symfony\Component\Process\Process([PHP_BINARY, '-r', $child], '/var/www', timeout: 15);
        $process->mustRun();
        return json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
    };
    $first = false;
    try {
        $first = $lock->get();
        if (!$first) throw new RuntimeException('Synthetic lock acquisition failed.');
        $busy = $contend();
        if ($busy !== ['acquired'=>false,'released'=>false] || !$lock->isOwnedByCurrentProcess()) {
            throw new RuntimeException('Shared owner-safe contention check failed.');
        }
        if (!$lock->release()) throw new RuntimeException('Synthetic owner release failed.');
        $resumed = $contend();
        if ($resumed !== ['acquired'=>true,'released'=>true]) throw new RuntimeException('Shared lock reuse failed.');
        $table = config('cache.stores.database.lock_table') ?: 'cache_locks';
        $remaining = Illuminate\Support\Facades\DB::connection(config('cache.stores.database.lock_connection'))
            ->table($table)->where('key', $cache->getStore()->getPrefix().$key)->count();
        if ($remaining !== 0) throw new RuntimeException('Synthetic lock cleanup failed.');
        $result['shared_lock_probe'] = ['cross_process_contention'=>true,'non_owner_release_denied'=>true,'owner_preserved'=>true,'reuse_after_release'=>true,'remaining_probe_rows'=>0];
    } finally {
        if ($first) $lock->release();
    }
}
echo json_encode($result, JSON_THROW_ON_ERROR), PHP_EOL;
`;
const args = ['exec', '-i', '--user', 'www-data', '--env', `CHECKUPINO_ADMISSION_LOCK_PROBE=${probe ? '1' : '0'}`, 'checkupino_app', 'php'];
const run = spawnSync('docker', args, { input: php, encoding: 'utf8', timeout: 60000 });
assert.equal(run.status, 0, 'Admission verification did not finish; inspect the restricted verifier operation.');
const runtime = JSON.parse(run.stdout);
assert.equal(runtime.scanning_enabled, false);
assert.equal(runtime.private_driver, 'local');
assert.equal(runtime.requests, 1);
assert.equal(runtime.files, 1);
assert.equal(runtime.reports, 0);
assert.equal(runtime.jobs, 0);
if (probe) {
    assert.equal(runtime.shared_lock_probe.remaining_probe_rows, 0);
    writeFileSync(new URL('../../docs/deployment/evidence/upload-admission-runtime-2026-10-08.json', import.meta.url), `${JSON.stringify({ verified_at_utc: new Date().toISOString(), timezone: 'Asia/Tehran', scope: 'Configuration/count reads and one temporary synthetic cache-lock key; no clinical writes', runtime }, null, 2)}\n`);
}
console.log(probe ? 'Shared upload admission lock passes cross-process contention, ownership, reuse and cleanup; no clinical writes.' : 'Read-only upload admission configuration and preserved medical counts pass.');
