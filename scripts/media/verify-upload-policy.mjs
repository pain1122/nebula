import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const acceptedLiveSettings = process.argv.includes('--accepted-live-settings');

const docker = (args, input) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, timeout: 25000 });
  assert.equal(result.status, 0, 'Read-only upload-policy verification must succeed.');
  return result.stdout;
};
const php = `<?php
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
$settings = $app->make(App\\Services\\UploadPolicySettings::class);
echo json_encode([
  'checked_at' => now('Asia/Tehran')->toIso8601String(),
  'mysql_select' => Illuminate\\Support\\Facades\\DB::selectOne('SELECT 1 AS connected')->connected,
  'redis_ping' => (string) Illuminate\\Support\\Facades\\Redis::ping(),
  'scanning_enabled' => config('medical.scanner.enabled'),
  'private_driver' => config('filesystems.disks.private.driver'),
  'medical' => $settings->describe('uploads.medical'),
  'public_media' => $settings->describe('uploads.public_media'),
  'counts' => [
    'reservation_files' => App\\Models\\ReservationFile::withTrashed()->count(),
    'reservation_medical_requests' => App\\Models\\ReservationMedicalRequest::count(),
    'reservation_reports' => App\\Models\\ReservationReport::count(),
    'jobs' => Illuminate\\Support\\Facades\\DB::table('jobs')->count(),
    'setting_definitions' => App\\Models\\SettingDefinition::count(),
    'setting_values' => App\\Models\\SettingValue::count(),
    'upload_setting_definitions' => App\\Models\\SettingDefinition::whereIn('key', ['uploads.medical', 'uploads.public_media'])->count(),
  ],
], JSON_THROW_ON_ERROR);
`;
const runtime = JSON.parse(docker(['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], php));
assert.equal(runtime.mysql_select, 1);
assert.ok(['1', 'PONG', '+PONG'].includes(runtime.redis_ping));
assert.equal(runtime.scanning_enabled, false);
assert.equal(runtime.private_driver, 'local');
assert.deepEqual(runtime.counts, { reservation_files: 0, reservation_medical_requests: 0, reservation_reports: 0, jobs: 0, setting_definitions: acceptedLiveSettings ? 4 : 3, setting_values: acceptedLiveSettings ? 4 : 3, upload_setting_definitions: acceptedLiveSettings ? 1 : 0 });
assert.equal(runtime.medical.default_max_bytes, 10485760);
assert.equal(runtime.public_media.default_max_bytes, 5242880);
for (const policy of [runtime.medical, runtime.public_media]) {
  assert.match(policy.revision, /^[a-f0-9]{64}$/);
  assert.equal(policy.policy_state, 'active');
  assert.deepEqual(policy.value, []);
}
const names = ['checkupino_app', 'checkupino_prod-admin-1', 'checkupino_scan-scanner-1', 'checkupino_scan-scan-check-1'];
const containers = JSON.parse(docker(['inspect', ...names])).map((container) => ({
  name: container.Name.slice(1), image: container.Image, status: container.State.Status,
  exit_code: container.State.ExitCode, restarts: container.RestartCount,
}));
assert.equal(containers[2].status, 'exited');
assert.equal(containers[2].exit_code, 17);
assert.equal(containers[2].restarts, 0);
assert.equal(containers[3].status, 'running');
const health = [];
for (const [url, expected] of [
  ['http://localhost:8080/up', 200], ['http://localhost:3000/panel/upload-limits', 200],
  ['http://localhost:8080/api/admin/settings/uploads.medical', 401],
]) {
  const result = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
  assert.equal(result.status, expected);
  await result.body?.cancel();
  health.push({ url, status: result.status });
}
const evidence = { ...runtime, containers, health, verification_is_read_only: true,
  prior_live_settings_acceptance: acceptedLiveSettings,
  live_settings_writes_performed: acceptedLiveSettings,
  acceptance: 'Read-only backend policy/runtime only. SPA fallback HTTP 200 does not establish page artifact or authenticated browser acceptance.' };
const output = acceptedLiveSettings ? 'upload-policy-live-runtime-2026-10-08.json' : 'upload-policy-panel-runtime-2026-10-08.json';
writeFileSync(fileURLToPath(new URL('../../docs/deployment/evidence/' + output, import.meta.url)), JSON.stringify(evidence, null, 2) + '\n');
console.log('Read-only policy revisions, defaults, DB/Redis, counts and HTTP gates pass. No live write or worker run.');
