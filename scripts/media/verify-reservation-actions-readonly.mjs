import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'Read-only reservation actions accept no overrides.');
assert.equal(realpathSync(process.cwd()), realpathSync(fileURLToPath(new URL('../../', import.meta.url))));
const inspected = spawnSync('docker', ['inspect', '--format', '{{.Image}}', 'checkupino_app'], {
  encoding: 'utf8', windowsHide: true, timeout: 10000,
});
assert.equal(inspected.status, 0);
assert.equal(inspected.stdout.trim(), 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
const php = String.raw`<?php
require 'vendor/autoload.php'; $app=require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(posix_geteuid()!==33 || config('database.default')!=='mysql') throw new RuntimeException('Fixed read-only context required.');
Illuminate\Support\Facades\DB::statement('SET TRANSACTION READ ONLY');
Illuminate\Support\Facades\DB::beginTransaction();
try {
 $hashes=static function(): array {
  $result=[];
  foreach(['reservations','reservation_payment_summaries','payment_attempts','reservation_schedule_changes','reservation_medical_requests','reservation_files','reservation_reports','audit_events','outbox_events','jobs','questionnaire_submissions','setting_values'] as $table)
   $result[$table]=hash('sha256',json_encode(Illuminate\Support\Facades\DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
  return $result;
 };
 $before=$hashes();$controller=app(App\Http\Controllers\Api\AdminReservationController::class);
 $r=App\Models\Reservation::with('doctor.user')->findOrFail(8);
 if($r->status!==App\Models\ReservationStatus::Completed || $r->user_id!==4 || $r->doctor->user_id!==5) throw new RuntimeException('Accepted completed fixture changed.');
 $checks=0;
 foreach([2=>'admin',1=>'root-admin'] as $id=>$role) {
  $actor=App\Models\User::with('roles')->findOrFail($id);
  if(!$actor->hasRole($role)) throw new RuntimeException('Fixed synthetic actor role changed.');
  $request=Illuminate\Http\Request::create('/api/admin/reservations/8','GET');$request->setUserResolver(fn()=>$actor);
  $response=$controller->show($request,$r->fresh());$data=$response->getData(true)['data'];
  if($data['id']!==8 || $data['actions']['can_reschedule']!==false || $data['actions']['allowed_statuses']!==[]
   || !preg_match('/\A[a-f0-9]{64}\z/',$data['actions']['revision']) || $data['patient']['email']!==null
   || !str_contains($response->headers->get('Cache-Control'),'no-store')
   || isset($data['payment']['successful_attempt_id']) || isset($data['schedule_changes'])) throw new RuntimeException('Safe terminal detail contract failed.');
  $start=now('Asia/Tehran')->toDateString();$end=now('Asia/Tehran')->addDays(7)->toDateString();
  $slotRequest=Illuminate\Http\Request::create('/api/admin/reservations/8/reschedule-slots','GET',['from'=>$start,'to'=>$end]);
  $slotRequest->setUserResolver(fn()=>$actor);
  try { $controller->rescheduleSlots($slotRequest,$r->fresh(),app(App\Services\AdminReservationActionService::class));throw new RuntimeException('Completed slot read must refuse.'); }
  catch(Illuminate\Validation\ValidationException $exception) {
   if(($exception->errors()['reservation']??null)!==['reschedule_unavailable']) throw new RuntimeException('Unexpected terminal refusal.');
  }
  $checks++;
 }
 if($before!==$hashes()) throw new RuntimeException('Read-only data fingerprint changed.');
 echo json_encode(['acceptance'=>'passed','scope'=>'UID33 read-only MySQL controller/service contract; not HTTP middleware or live mutation acceptance',
  'role_checks'=>$checks,'completed_action_guard'=>true,'safe_revision_and_detail'=>true,'data_fingerprints_preserved'=>true,
  'positive_live_slot_query_accepted'=>false,'jobs'=>Illuminate\Support\Facades\DB::table('jobs')->count()],JSON_THROW_ON_ERROR);
} finally { Illuminate\Support\Facades\DB::rollBack(); }
`;
const result = spawnSync('docker', ['exec', '-i', '--user', '33:33', 'checkupino_app', 'php'], {
  input: php, encoding: 'utf8', windowsHide: true, timeout: 30000,
});
assert.equal(result.status, 0, 'Read-only reservation action contract failed; inspect locally without exposing raw output.');
const proof = JSON.parse(result.stdout);
assert.equal(proof.acceptance, 'passed');
assert.equal(proof.role_checks, 2);
assert.equal(proof.jobs, 0);
console.log(JSON.stringify(proof, null, 2));
