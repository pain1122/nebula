import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

assert.equal(process.argv.length, 2, 'No account/container/endpoint overrides accepted.');
const evidencePath = 'docs/deployment/evidence/admin-schedule-read-runtime-2026-10-15.json';
assert.ok(!existsSync(evidencePath), 'Evidence exists; inspect instead of overwriting.');
const expected = JSON.parse(readFileSync('docs/deployment/evidence/demo-appointment-completed-final-2026-10-11.json', 'utf8')).final.hashes;
const previous = JSON.parse(readFileSync('docs/deployment/evidence/admin-catalog-controls-acceptance-2026-10-15.json', 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
assert.equal(previous.acceptance, 'passed');
for (const [path, hash] of Object.entries({ ...previous.sources, ...previous.evidence })) {
  if (path !== 'routes/api.php') assert.equal(sha(path), hash, 'Unrelated accepted source/evidence changed: ' + path);
}
const php = String.raw`<?php
require '/var/www/vendor/autoload.php';$app=require '/var/www/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
if(posix_geteuid()!==33||config('database.default')!=='mysql')throw new RuntimeException('UID33 MySQL required.');
DB::statement('SET TRANSACTION READ ONLY');DB::beginTransaction();
try{
 $fingerprints=function(){
  $tables=['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events','audit_events','questionnaire_submissions','leads'];$hashes=[];
  foreach($tables as $table)$hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
  $stable=App\Models\Reservation::findOrFail(8)->getAttributes();unset($stable['status'],$stable['completed_at'],$stable['updated_at']);$hashes['target_stable']=hash('sha256',json_encode($stable,JSON_THROW_ON_ERROR));
  $hashes['other_reservations']=hash('sha256',json_encode(DB::table('reservations')->where('id','!=',8)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
  $hashes['protected']=hash('sha256',json_encode(App\Models\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));return $hashes;
 };
 $scheduleHashes=function(){ $hashes=[];foreach(['doctor_workplaces','doctor_working_windows','doctor_working_window_breaks','doctor_visit_slots','doctor_workplace_checkup','doctor_profiles','marketplace_hospitals','checkups','checkup_categories','specialties','doctor_specialty'] as $table)$hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));return $hashes;};
 $before=$fingerprints();$scheduleBefore=$scheduleHashes();$checks=[];
 $workplace=App\Models\DoctorWorkplace::findOrFail(App\Models\Reservation::findOrFail(8)->doctor_workplace_id);
 foreach([2,1] as $id){
  $actor=App\Models\User::with('roles')->findOrFail($id);if(!str_ends_with($actor->email,'@checkupino.test')||!$actor->canAccessAdminPanel())throw new RuntimeException('Synthetic administrator required.');
  foreach([
   ['index','/api/admin/schedules/workplaces?doctor_id='.$workplace->doctor_profile_id.'&hospital_id='.$workplace->marketplace_hospital_id.'&state=all',false],
   ['show','/api/admin/schedules/workplaces/'.$workplace->id,true],
   ['rules','/api/admin/schedules/workplaces/'.$workplace->id.'/rules?state=all',true],
   ['slots','/api/admin/schedules/workplaces/'.$workplace->id.'/slots',true],
   ['slots','/api/admin/schedules/workplaces/'.$workplace->id.'/slots?conflict=unblocked&timing=future&history=without',true]
  ] as [$method,$uri,$detail]){
   $request=Request::create($uri,'GET');$request->headers->set('Accept','application/json');$app->instance('request',$request);$request->setUserResolver(fn()=>$actor);
   $controller=$app->make(App\Http\Controllers\Api\Admin\ScheduleReadController::class);$response=$detail?$controller->$method($request,(string)$workplace->id):$controller->$method($request);$body=json_decode($response->getContent(),true,512,JSON_THROW_ON_ERROR);
   if($response->getStatusCode()!==200||$response->headers->get('Cache-Control')!=='no-store, private'||$body['meta']['read_only']!==true)throw new RuntimeException('Read/cache contract rejected.');
   foreach(['booking_notes','contact_phone','contact_email','password','archive_reason','storage_path',$actor->email] as $private)if(str_contains($response->getContent(),$private))throw new RuntimeException('Private field exposed.');
   if($method==='index'&&!in_array($workplace->id,array_column($body['data'],'id'),true))throw new RuntimeException('Composed workplace scope missing.');
   if($method==='show'&&$body['data']['id']!==$workplace->id)throw new RuntimeException('Workplace binding rejected.');
   if($method==='slots')foreach($body['data'] as $row){if(!is_string($row['price'])||!is_bool($row['blocking_reservation'])||!is_bool($row['has_reservation_history'])||!preg_match('/[+-][0-9]{2}:[0-9]{2}$/',$row['starts_at']))throw new RuntimeException('Slot contract rejected.');}
   $checks[]=['actor_id'=>$id,'method'=>$method,'status'=>200,'cache'=>'no-store, private','rows'=>isset($body['meta']['pagination'])?count($body['data']):1,'total'=>$body['meta']['pagination']['total']??null];
  }
 }
 $after=$fingerprints();$scheduleAfter=$scheduleHashes();if($before!==$after||$scheduleBefore!==$scheduleAfter)throw new RuntimeException('Read changed data.');
 echo json_encode(['checks'=>$checks,'workplace_id'=>$workplace->id,'baseline'=>$before,'final'=>$after,'schedule_baseline'=>$scheduleBefore,'schedule_final'=>$scheduleAfter],JSON_THROW_ON_ERROR);
}finally{DB::rollBack();}
`;
const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1000000 });
assert.equal(result.status, 0, 'Read-only MySQL schedule verification failed.');
const runtime = JSON.parse(result.stdout);
assert.deepEqual(runtime.baseline, expected);
assert.deepEqual(runtime.final, expected);
assert.deepEqual(runtime.schedule_baseline, runtime.schedule_final);
for (const [table, hash] of Object.entries(previous.catalog_after)) assert.equal(runtime.schedule_final[table], hash);
const guest = [];
for (const suffix of ['', '/' + runtime.workplace_id, '/' + runtime.workplace_id + '/rules', '/' + runtime.workplace_id + '/slots']) {
  const path = '/api/admin/schedules/workplaces' + suffix;
  const response = await fetch('http://localhost:8080' + path, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 401);await response.arrayBuffer();guest.push({ path, status: 401 });
}
const sources = ['app/Http/Controllers/Api/Admin/ScheduleReadController.php', 'routes/api.php', 'tests/Feature/Api/AdminScheduleReadContractTest.php', 'scripts/media/verify-admin-schedule-read.ps1', 'scripts/media/verify-admin-schedule-read-runtime.mjs'].map(path => ({ path, sha256: sha(path) }));
writeFileSync(evidencePath, JSON.stringify({ acceptance: 'passed', checked_at: new Date().toISOString(), ...runtime, guest, sources, prior_catalog_source_bindings_retained: 49, prior_catalog_evidence_bindings_retained: 19, scope: 'UID33 read-only MySQL transaction, existing synthetic admin/root direct controller reads, four actual guest HTTP401 refusals. Existing catalog/original/protected/schedule data unchanged. Additive API routes intentionally supersede their prior source hash. No authenticated browser/panel, mutation, concurrency, materialization, scanner/worker or schema acceptance.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ acceptance: 'passed', mysql_checks: runtime.checks.length, guest_refusals: guest.length, original_protected_catalog_schedule_preserved: true }));
