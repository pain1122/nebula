import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

assert.equal(process.argv.length, 2, 'No account/container/endpoint overrides accepted.');
const evidencePath = 'docs/deployment/evidence/admin-payment-controls-runtime-2026-10-16.json';
assert.ok(!existsSync(evidencePath), 'Inspect accepted evidence instead of overwriting.');
const previous = JSON.parse(readFileSync('docs/deployment/evidence/admin-schedule-controls-acceptance-2026-10-15.json', 'utf8'));
const story = JSON.parse(readFileSync('docs/deployment/evidence/admin-schedule-control-runtime-final-2026-10-15.json', 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const contextPaths = ['CURRENT_TASK.md', 'docs/TODO.md', 'AI_BOOT.md', 'docs/ai-context/CONTINUE_PROMPT.md', 'docs/ai-context/modules/booking.md', 'docs/ai-context/modules/admin-panel.md', 'docs/ai-context/TASK_LOG.md'];
for (const [path, hash] of Object.entries(previous.sources)) if (!['routes/api.php','frontend/src/locales/en.json','frontend/src/locales/fa.json','scripts/media/check-demo-readiness.mjs'].includes(path) && !contextPaths.includes(path)) assert.equal(sha(path), hash, 'Unrelated accepted source changed: ' + path);
for (const [path, hash] of Object.entries(previous.evidence)) assert.equal(sha(path), hash, 'Prior immutable evidence changed: ' + path);
const php = String.raw`<?php
require '/var/www/vendor/autoload.php';$app=require '/var/www/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
if(posix_geteuid()!==33||config('database.default')!=='mysql')throw new RuntimeException('UID33 MySQL required.');
$pong=Illuminate\Support\Facades\Redis::connection()->ping();if(!in_array($pong,[true,'PONG','+PONG'],true))throw new RuntimeException('Redis health failed.');
DB::statement('SET TRANSACTION READ ONLY');DB::beginTransaction();
try{
 $fingerprints=function(){
  $hashes=[];foreach(['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events','audit_events','questionnaire_submissions','leads'] as $table)$hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
  $stable=App\Models\Reservation::findOrFail(8)->getAttributes();unset($stable['status'],$stable['completed_at'],$stable['updated_at']);$hashes['target_stable']=hash('sha256',json_encode($stable,JSON_THROW_ON_ERROR));
  $hashes['other_reservations']=hash('sha256',json_encode(DB::table('reservations')->where('id','!=',8)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
  $hashes['protected']=hash('sha256',json_encode(App\Models\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));return $hashes;
 };
 $schedules=function(){ $hashes=[];foreach(['doctor_workplaces','doctor_working_windows','doctor_working_window_breaks','doctor_visit_slots','doctor_workplace_checkup','doctor_profiles','marketplace_hospitals','checkups','checkup_categories','specialties','doctor_specialty','reservation_schedule_changes'] as $table)$hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));return $hashes;};
 $finance=function(){ $hashes=[];foreach(['payment_provider_events','payment_adjustments'] as $table)$hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));return $hashes;};
 $before=$fingerprints();$scheduleBefore=$schedules();$financeBefore=$finance();$checks=[];
 $reservation=App\Models\Reservation::findOrFail(8);$payment=$reservation->payment()->firstOrFail();
 if($payment->status->value!=='paid'||$reservation->status->value!=='completed')throw new RuntimeException('Accepted financial story mismatch.');
 foreach([2,1] as $id){
  $actor=App\Models\User::with('roles')->findOrFail($id);if(!str_ends_with($actor->email,'@checkupino.test')||!$actor->canAccessAdminPanel())throw new RuntimeException('Synthetic administrator required.');
  foreach([
   ['index','/api/admin/payments?status=paid&reservation_status=completed&patient_id='.$reservation->user_id.'&doctor_id='.$reservation->doctor_profile_id.'&currency='.$payment->currency,false],
   ['show','/api/admin/payments/'.$payment->public_id,true],
   ['attempts','/api/admin/payments/'.$payment->public_id.'/attempts',true],
   ['adjustments','/api/admin/payments/'.$payment->public_id.'/adjustments',true],
   ['events','/api/admin/payments/'.$payment->public_id.'/events',true],
   ['index','/api/admin/payments?q='.$payment->public_id.'&provider=sandbox&attempt_status=succeeded',false],
   ['index','/api/admin/payments?q='.$reservation->public_id.'&provider=sandbox&attempt_status=failed',false]
  ] as [$method,$uri,$detail]){
   $request=Request::create($uri,'GET');$request->headers->set('Accept','application/json');$app->instance('request',$request);$request->setUserResolver(fn()=>$actor);
   $controller=$app->make(App\Http\Controllers\Api\Admin\PaymentReadController::class);$response=$detail?$controller->$method($request,(string)$payment->public_id):$controller->$method($request);$body=json_decode($response->getContent(),true,512,JSON_THROW_ON_ERROR);
   if($response->getStatusCode()!==200||$response->headers->get('Cache-Control')!=='no-store, private'||$body['meta']['read_only']!==true||$body['meta']['adjustments_execute_provider']!==false)throw new RuntimeException('Read/cache contract rejected.');
   foreach(['provider_ref','idempotency_key','sanitized_payload','external_event_id','failure_message','failure_code','password','"metadata"','"reason"',$actor->email] as $private)if(str_contains($response->getContent(),$private))throw new RuntimeException('Private field exposed.');
   if($method==='index'&&!in_array((string)$payment->public_id,array_column($body['data'],'public_id'),true))throw new RuntimeException('Composed payment scope missing.');
   if($method==='show'&&($body['data']['public_id']!==$payment->public_id||$body['data']['amount']!==(string)$payment->amount||$body['data']['status']!=='paid'||$body['data']['reservation']['status']!=='completed'||$body['data']['canonical_consistent']!==true))throw new RuntimeException('Canonical/payment/reservation facts rejected.');
   if(in_array($method,['attempts','adjustments','events'],true)&&($body['meta']['payment_public_id']??null)!==$payment->public_id)throw new RuntimeException('Parent history binding missing.');
   if($method==='attempts')foreach($body['data'] as $row)if(!is_string($row['amount'])||!is_bool($row['binding_consistent'])||$row['binding_consistent']!==true)throw new RuntimeException('Exact attempt metadata rejected.');
   $checks[]=['actor_id'=>$id,'method'=>$method,'status'=>200,'rows'=>isset($body['meta']['pagination'])?count($body['data']):1,'total'=>$body['meta']['pagination']['total']??null];
  }
 }
 $actor=App\Models\User::with('roles')->findOrFail(1);$request=Request::create('/api/admin/payments/'.$payment->public_id.'/adjustment-context','GET');$request->setUserResolver(fn()=>$actor);
 $context=$app->make(App\Services\PaymentAdjustmentService::class)->context($request,$payment);
 if($context['request_only']!==true||$context['can_request']!==true||$context['payment_public_id']!==$payment->public_id||$context['remaining_amount']!==(string)$payment->amount||!preg_match('/^[a-f0-9]{64}$/',$context['revision']))throw new RuntimeException('Fresh root read context rejected.');
 $checks[]=['actor_id'=>1,'method'=>'adjustment-context','status'=>200,'request_only'=>true];
 $after=$fingerprints();$scheduleAfter=$schedules();$financeAfter=$finance();if($before!==$after||$scheduleBefore!==$scheduleAfter||$financeBefore!==$financeAfter)throw new RuntimeException('Read changed data.');
 echo json_encode(['checks'=>$checks,'payment_public_id'=>(string)$payment->public_id,'baseline'=>$before,'final'=>$after,'schedule_baseline'=>$scheduleBefore,'schedule_final'=>$scheduleAfter,'payment_history_before'=>$financeBefore,'payment_history_after'=>$financeAfter,'uid'=>posix_geteuid(),'mysql'=>true,'redis'=>true],JSON_THROW_ON_ERROR);
}finally{DB::rollBack();}
`;
const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 1000000 });
assert.equal(result.status, 0, 'Read-only payment verification failed.');
assert.match(result.stdout, /^\s*\{/, 'Read-only payment verification did not produce JSON: ' + result.stdout.slice(0, 2000));
const runtime = JSON.parse(result.stdout);
assert.deepEqual(runtime.baseline, story.baseline);assert.deepEqual(runtime.final, story.final);
assert.deepEqual(runtime.schedule_final, story.schedule_final);
const guest = [];
for (const suffix of ['', '/' + runtime.payment_public_id, '/' + runtime.payment_public_id + '/attempts', '/' + runtime.payment_public_id + '/adjustments', '/' + runtime.payment_public_id + '/events', '/' + runtime.payment_public_id + '/adjustment-context']) {
  const path = '/api/admin/payments' + suffix;
  const response = await fetch('http://localhost:8080' + path, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 401);await response.arrayBuffer();guest.push({ path, status: 401 });
}
const health = await fetch('http://localhost:8080/up', { redirect: 'error', signal: AbortSignal.timeout(10000) });assert.equal(health.status, 200);await health.arrayBuffer();
const inspect = spawnSync('docker', ['inspect', 'checkupino_app', 'checkupino_nginx', 'checkupino_db', 'checkupino_redis', 'checkupino_prod-admin-1', 'checkupino_content-content-parser-1', 'checkupino_scan-scan-check-1', 'checkupino_scan-scan-worker-1', 'checkupino_scan-scanner-1', 'checkupino_media-media-master-1', 'checkupino_media-media-volume-1', 'checkupino_media-media-filer-1', 'checkupino_media-media-s3-1'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
assert.equal(inspect.status, 0);const containers = JSON.parse(inspect.stdout);
const admin = containers.find(c => c.Name === '/checkupino_prod-admin-1');assert.equal(admin.Image, JSON.parse(readFileSync('docs/deployment/evidence/admin-payment-controls-static-2026-10-16.json','utf8')).image);assert.equal(admin.State.Health.Status, 'healthy');
assert.equal(containers.find(c => c.Name === '/checkupino_app').Image, 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
for (const name of ['checkupino_app', 'checkupino_nginx', 'checkupino_db', 'checkupino_redis']) assert.equal(containers.find(c => c.Name === '/' + name).State.Running, true);
for (const name of ['checkupino_scan-scanner-1', 'checkupino_scan-scan-worker-1', 'checkupino_scan-scan-check-1', 'checkupino_content-content-parser-1']) assert.equal(containers.find(c => c.Name === '/' + name).State.Running, false, 'This API-only recovery must not activate scanner/parser/worker/checker.');
const paths = ['frontend/src/modules/checkupino/payments/adjustments.ts','frontend/src/pages/Administration/PaymentAdjustmentEditor.tsx','frontend/src/test/PaymentAdjustments.test.tsx','app/Services/PaymentAdjustmentService.php','app/Http/Controllers/Api/Admin/PaymentAdjustmentController.php','tests/Feature/Api/AdminPaymentAdjustmentContractTest.php','scripts/media/verify-admin-payment-adjustment.ps1','frontend/src/modules/checkupino/payments/api.ts','frontend/src/pages/Administration/Payments.tsx','frontend/src/test/Payments.test.tsx','app/Http/Controllers/Api/Admin/PaymentReadController.php', 'routes/api.php', 'tests/Feature/Api/AdminPaymentReadContractTest.php', 'scripts/media/verify-admin-payment-read.ps1', 'scripts/media/verify-admin-payment-read-runtime.mjs'];
writeFileSync(evidencePath, JSON.stringify({ acceptance: 'passed', checked_at: new Date().toISOString(), ...runtime, guest, http_health: 200, containers: containers.map(c => ({ name: c.Name, image: c.Image, state: c.State.Status })), running_services: containers.filter(c => c.State.Running).length, admin_image: admin.Image, prior_immutable_artifacts: Object.keys(previous.evidence).length, retained_prior_noncontext_sources: 29, sources: Object.fromEntries(paths.map(path => [path, sha(path)])), scope: 'Fifteen admin/root UID33 MySQL read-only checks including root adjustment context, Redis/HTTP health, six actual guest HTTP401 refusals, preserved clinical/protected/schedule/full financial history. User recovered existing backend only; nine services run, parser/checker/worker/scanner remain stopped. Authenticated panel acceptance is in the separate browser/pointer proofs. No financial write, adjustment execution, schema/env/dependency or queue operation.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ acceptance: 'passed', mysql_read_checks: runtime.checks.length, guest_refusals: guest.length, running_services: containers.filter(c => c.State.Running).length, data_preserved: true }));
