// Read-only preservation evidence. Account metadata is returned only in memory to the browser harness.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

export function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 12000000 });
  assert.equal(result.status, 0, 'Project-scoped Docker inspection failed.');
  return result.stdout;
}
export function snapshot(withAccounts = false) {
  const php = `<?php
require '/var/www/vendor/autoload.php';
$app=require '/var/www/bootstrap/app.php';$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
if(posix_geteuid()!==33 || DB::connection()->getDriverName()!=='mysql')throw new RuntimeException('Context refused');
DB::statement('SET TRANSACTION READ ONLY');DB::beginTransaction();
try{
 $tables=['users','roles','permissions','reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events','audit_events','questionnaire_submissions','leads','checkups','checkup_categories','doctor_workplace_checkup','doctor_visit_slots','specialties','doctor_profiles','doctor_specialty','doctor_workplaces','doctor_working_windows','doctor_working_window_breaks','marketplace_hospitals','reservation_schedule_changes','payment_provider_events','payment_adjustments'];
 $hashes=[];$counts=[];foreach($tables as $table){if(!Schema::hasTable($table))throw new RuntimeException('Missing preservation table');$rows=DB::table($table)->orderBy('id')->get();$hashes[$table]=hash('sha256',json_encode($rows,JSON_THROW_ON_ERROR));$counts[$table]=$rows->count();}
 $hashes['protected']=hash('sha256',App\\Models\\User::with('roles')->whereIn('id',[7,8])->orderBy('id')->get()->toJson());
 $health=[];foreach(['patient_health_snapshots','patient_biometric_observations'] as $t)$health[$t]=Schema::hasTable($t)?DB::table($t)->count():null;
 $result=['hashes'=>$hashes,'counts'=>$counts,'health_counts'=>$health,'writes'=>0];
 ${withAccounts ? "$result['accounts']=App\\Models\\User::with('roles')->whereIn('id',[1,2,3,4,5])->orderBy('id')->get()->map(fn($u)=>['id'=>$u->id,'public_id'=>$u->public_id,'email'=>$u->email,'roles'=>$u->roles->pluck('name')->all()])->all();" : ''}
 echo json_encode($result,JSON_THROW_ON_ERROR);
}finally{DB::rollBack();}
`;
  const result = spawnSync('docker', ['exec', '-i', '--user', '33:33', '--workdir', '/var/www', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, 'Read-only state capture failed.');
  return JSON.parse(result.stdout);
}
export function runtime() {
  return JSON.parse(docker(['inspect', ...docker(['ps', '-a', '--filter', 'name=checkupino', '--format', '{{.Names}}']).trim().split(/\r?\n/)]))
    .map(c => ({ name: c.Name.slice(1), image: c.Image, status: c.State.Status, health: c.State.Health?.Status ?? null })).sort((a,b) => a.name.localeCompare(b.name));
}
