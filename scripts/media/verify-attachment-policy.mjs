import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const evidenceRoot = new URL('../../docs/deployment/evidence/', import.meta.url);
const activated = process.argv.includes('--activated');
const afterApi = process.argv.includes('--after-api');
assert.ok(!afterApi || activated, 'Post-API verification requires the activated schema.');
const apiAcceptance = afterApi ? JSON.parse(readFileSync(new URL('attachment-api-live-2026-10-08.json', evidenceRoot), 'utf8')) : null;
if (apiAcceptance) assert.equal(apiAcceptance.acceptance, 'passed');
const prior = JSON.parse(readFileSync(new URL('upload-policy-live-2026-10-08.json', evidenceRoot), 'utf8'));
assert.equal(prior.acceptance, 'passed');
assert.match(prior.run, /^checkupino-upload-policy-\d+$/);
const php = `<?php
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
$policies = $app->make(App\\Services\\UploadPolicySettings::class);
$protected = App\\Models\\User::whereIn('id', [7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray();
$otherSettings = App\\Models\\SettingValue::whereHas('definition', fn($query) => $query->where('key','!=','uploads.medical'))->orderBy('id')->get()->toArray();
$events = App\\Models\\AuditEvent::where('action','settings.marketplace.updated')->where('reason','like','%${prior.run}%')->orderBy('id')->get();
echo json_encode([
 'checked_at' => now('Asia/Tehran')->toIso8601String(),
 'mysql_select' => Illuminate\\Support\\Facades\\DB::selectOne('SELECT 1 AS connected')->connected,
 'redis_ping' => (string) Illuminate\\Support\\Facades\\Redis::ping(),
 'scanning_enabled' => config('medical.scanner.enabled'), 'private_driver' => config('filesystems.disks.private.driver'),
 'attachment_schema_ready' => Illuminate\\Support\\Facades\\Schema::hasColumns('reservation_medical_requests', ['attachment_policy','attachment_policy_revision']),
 'attachment_migration_recorded' => Illuminate\\Support\\Facades\\DB::table('migrations')->where('migration','2026_10_08_000000_add_attachment_policy_to_medical_requests')->exists(),
 'attachment_columns' => Illuminate\\Support\\Facades\\Schema::getColumns('reservation_medical_requests'),
 'migration_inventory' => Illuminate\\Support\\Facades\\DB::table('migrations')->orderBy('id')->get(['id','migration','batch'])->toArray(),
 'medical' => $policies->describe('uploads.medical'), 'public_media' => $policies->describe('uploads.public_media'),
 'counts' => ['reservation_files' => App\\Models\\ReservationFile::withTrashed()->count(), 'reservation_medical_requests' => App\\Models\\ReservationMedicalRequest::withTrashed()->count(), 'reservation_reports' => App\\Models\\ReservationReport::withTrashed()->count(), 'jobs' => Illuminate\\Support\\Facades\\DB::table('jobs')->count(), 'setting_definitions' => App\\Models\\SettingDefinition::count(), 'setting_values' => App\\Models\\SettingValue::count()],
 'protected_accounts_fingerprint' => hash('sha256', json_encode($protected, JSON_THROW_ON_ERROR)),
 'other_settings_fingerprint' => hash('sha256', json_encode($otherSettings, JSON_THROW_ON_ERROR)),
 'audits' => $events->map(fn($event) => ['id'=>$event->id,'public_id'=>$event->public_id,'actor_id'=>$event->actor_user_id,'action'=>$event->action,'subject_type'=>$event->subject_type,'subject_id'=>$event->subject_id,'risk_level'=>$event->risk_level,'reason'=>$event->reason,'outcome'=>$event->outcome,'before'=>$event->before,'after'=>$event->after,'route'=>$event->route,'correlation_id'=>$event->correlation_id])->all(),
], JSON_THROW_ON_ERROR);
`;
const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], {
  input: php, encoding: 'utf8', windowsHide: true, timeout: 25000,
});
assert.equal(result.status, 0, 'Read-only attachment runtime inspection must succeed.');
const runtime = JSON.parse(result.stdout);
assert.equal(runtime.mysql_select, 1);
assert.ok(['1', 'PONG', '+PONG'].includes(runtime.redis_ping));
assert.equal(runtime.scanning_enabled, false);
assert.equal(runtime.private_driver, 'local');
assert.equal(runtime.attachment_schema_ready, activated);
assert.equal(runtime.attachment_migration_recorded, activated);
for (const [key, expected] of Object.entries({ reservation_files: afterApi ? 1 : 0, reservation_medical_requests: afterApi ? 1 : 0, reservation_reports: 0, jobs: 0 })) {
  assert.equal(runtime.counts[key], expected);
}
assert.equal(runtime.counts.setting_definitions, 4);
assert.equal(runtime.counts.setting_values, 4);
assert.deepEqual(runtime.medical, prior.restored.medical);
assert.deepEqual(runtime.public_media, prior.restored.public_media);
assert.equal(runtime.protected_accounts_fingerprint, prior.restored.protected_accounts_fingerprint);
assert.equal(runtime.other_settings_fingerprint, prior.restored.other_settings_fingerprint);
assert.deepEqual(runtime.audits, prior.restored.audits);
if (activated) {
  const baseline = JSON.parse(readFileSync(new URL('attachment-policy-runtime-2026-10-08.json', evidenceRoot), 'utf8'));
  const added = runtime.attachment_columns.filter(column => ['attachment_policy', 'attachment_policy_revision'].includes(column.name));
  assert.equal(added.length, 2);
  for (const column of added) assert.equal(column.nullable, true);
  assert.equal(added.find(column => column.name === 'attachment_policy').type_name, 'json');
  assert.equal(added.find(column => column.name === 'attachment_policy_revision').type, 'char(64)');
  assert.deepEqual(runtime.attachment_columns.filter(column => !added.includes(column)), baseline.attachment_columns);
  assert.deepEqual(runtime.migration_inventory.filter(row => row.migration !== '2026_10_08_000000_add_attachment_policy_to_medical_requests'), baseline.migration_inventory);
  assert.equal(runtime.migration_inventory.length, baseline.migration_inventory.length + 1);
}
const output = afterApi ? 'attachment-policy-post-api-runtime-2026-10-08.json' : activated ? 'attachment-policy-activation-runtime-2026-10-08.json' : 'attachment-policy-runtime-2026-10-08.json';
writeFileSync(fileURLToPath(new URL(output, evidenceRoot)), JSON.stringify({
  ...runtime, verification_is_read_only: true, live_migration_authorized: true,
  live_migration_performed_previously: activated, medical_upload_performed_previously: afterApi, acceptance: 'passed',
}, null, 2) + '\n');
console.log(`Read-only runtime passes: live schema ${activated ? 'activated with exactly two nullable columns' : 'unmigrated'}; restored limits/audits/protected fingerprints and ${afterApi ? 'one synthetic request/file with zero jobs/reports' : 'zero medical/jobs'} are preserved.`);
