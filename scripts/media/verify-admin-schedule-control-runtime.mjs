import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

assert.equal(process.argv.length, 2, 'No runtime overrides accepted.');
const evidencePath = 'docs/deployment/evidence/admin-schedule-control-runtime-final-2026-10-15.json';
assert.ok(!existsSync(evidencePath), 'Inspect existing evidence instead of overwriting.');
const previous = JSON.parse(readFileSync('docs/deployment/evidence/admin-schedule-read-runtime-2026-10-15.json', 'utf8'));
const php = String.raw`<?php
require '/var/www/vendor/autoload.php';$app=require '/var/www/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
if(posix_geteuid()!==33||config('database.default')!=='mysql')throw new RuntimeException('UID33 MySQL required.');
DB::statement('SET TRANSACTION READ ONLY');DB::beginTransaction();
try{
 $fingerprints=function(){
  $hashes=[];foreach(['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events','audit_events','questionnaire_submissions','leads'] as $table)$hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
  $stable=App\Models\Reservation::findOrFail(8)->getAttributes();unset($stable['status'],$stable['completed_at'],$stable['updated_at']);$hashes['target_stable']=hash('sha256',json_encode($stable,JSON_THROW_ON_ERROR));
  $hashes['other_reservations']=hash('sha256',json_encode(DB::table('reservations')->where('id','!=',8)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
  $hashes['protected']=hash('sha256',json_encode(App\Models\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));return $hashes;
 };
 $schedules=function(){ $hashes=[];foreach(['doctor_workplaces','doctor_working_windows','doctor_working_window_breaks','doctor_visit_slots','doctor_workplace_checkup','doctor_profiles','marketplace_hospitals','checkups','checkup_categories','specialties','doctor_specialty','reservation_schedule_changes'] as $table)$hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));return $hashes;};
 $before=$fingerprints();$scheduleBefore=$schedules();$checks=[];
 $workplace=App\Models\DoctorWorkplace::findOrFail(App\Models\Reservation::findOrFail(8)->doctor_workplace_id);
 $slot=$workplace->visitSlots()->where('starts_at','>',now())->orderBy('starts_at')->firstOrFail();
 $date=$slot->starts_at->copy()->setTimezone($workplace->hospital->timezone)->toDateString();
 foreach([2,1] as $id){
  $actor=App\Models\User::with('roles')->findOrFail($id);if(!str_ends_with($actor->email,'@checkupino.test')||!$actor->canAccessAdminPanel())throw new RuntimeException('Synthetic administrator required.');
  foreach(['slot','day','week'] as $scope){
   $selection=['scope'=>$scope,'date'=>$date,'checkup_id'=>$slot->checkup_id];if($scope==='slot')$selection['slot_public_id']=$slot->public_id;
   $read=function($parameters)use($app,$actor,$workplace){$request=Request::create('/api/admin/schedules/workplaces/'.$workplace->id.'/slot-control?'.http_build_query($parameters),'GET');$request->setUserResolver(fn()=>$actor);$request->headers->set('Accept','application/json');$app->instance('request',$request);$request->setUserResolver(fn()=>$actor);$response=$app->make(App\Http\Controllers\Api\Admin\ScheduleControlController::class)->preview($request,(string)$workplace->id);if($response->getStatusCode()!==200||$response->headers->get('Cache-Control')!=='no-store, private')throw new RuntimeException('Preview/cache rejected.');$body=json_decode($response->getContent(),true,512,JSON_THROW_ON_ERROR);foreach(['internal','booking_notes','patient_id','password','storage_path',$actor->email] as $private)if(str_contains($response->getContent(),$private))throw new RuntimeException('Private field exposed.');return $body['data'];};
   $preview=$read($selection);$repeat=$read($selection+['preview_expires_at'=>$preview['preview_expires_at']]);
   if($preview['revision']!==$repeat['revision']||$preview['selection']['workplace_id']!==$workplace->id||$preview['selection']['checkup_id']!==$slot->checkup_id||$preview['eligible_count']!==count(array_filter($preview['items'],fn($item)=>$item['eligible'])))throw new RuntimeException('Exact preview contract rejected.');
   foreach($preview['items'] as $item)if(!is_string($item['price'])||$item['eligible']!==($item['exclusions']===[]))throw new RuntimeException('Eligibility rejected.');
   $checks[]=['actor_id'=>$id,'scope'=>$scope,'eligible'=>$preview['eligible_count'],'total'=>count($preview['items']),'stable_revision'=>true];
  }
 }
 $after=$fingerprints();$scheduleAfter=$schedules();if($before!==$after||$scheduleBefore!==$scheduleAfter)throw new RuntimeException('Data changed.');
 echo json_encode(['checks'=>$checks,'workplace_id'=>$workplace->id,'baseline'=>$before,'final'=>$after,'schedule_baseline'=>$scheduleBefore,'schedule_final'=>$scheduleAfter],JSON_THROW_ON_ERROR);
}finally{DB::rollBack();}
`;
const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 1000000 });
assert.equal(result.status, 0, 'Read-only preview verification failed: ' + result.stderr + result.stdout.slice(0, 1200));
assert.match(result.stdout, /^\s*\{/, 'Read-only preview did not produce JSON: ' + result.stdout.slice(0, 2500));
const runtime = JSON.parse(result.stdout);
assert.deepEqual(runtime.baseline, previous.baseline);
assert.deepEqual(runtime.final, previous.final);
for (const [table, hash] of Object.entries(previous.schedule_final)) assert.equal(runtime.schedule_final[table], hash);
const guest = await fetch(`http://localhost:8080/api/admin/schedules/workplaces/${runtime.workplace_id}/slot-control`, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
assert.equal(guest.status, 401);await guest.arrayBuffer();
const paths = ['app/Services/AdminVisitSlotControl.php', 'app/Http/Controllers/Api/Admin/ScheduleControlController.php', 'app/Http/Controllers/Api/Admin/ScheduleReadController.php', 'app/Http/Controllers/Api/Admin/ActivityController.php', 'app/Services/AuditLogger.php', 'routes/api.php', 'tests/Feature/Api/AdminScheduleControlTest.php', 'scripts/media/verify-admin-schedule-control.ps1', 'scripts/media/verify-admin-schedule-control-runtime.mjs'];
const sources = Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
writeFileSync(evidencePath, JSON.stringify({ acceptance: 'passed', checked_at: new Date().toISOString(), ...runtime, guest_status: 401, sources, scope: 'Twelve UID33 direct-controller preview reads in a MySQL read-only transaction, plus actual guest GET401. No authenticated HTTP save, business write, materialization, scanner/worker, schema or concurrency acceptance.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ acceptance: 'passed', readonly_previews: 12, protected_history_and_schedule_preserved: true }));
