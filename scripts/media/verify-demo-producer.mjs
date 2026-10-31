import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

assert.equal(process.argv.length, 2, 'No producer/container/account overrides accepted.');
const image = 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746';
const run = (args, input) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, timeout: 45000 });
  assert.equal(result.status, 0, 'Read-only producer verification failed. No recovery was attempted.');
  return result.stdout;
};
const connected = JSON.parse(readFileSync('docs/deployment/evidence/demo-worker-connected-2026-10-11.json', 'utf8'));
assert.equal(connected.acceptance, 'passed'); assert.equal(connected.stage, 'idle dedicated worker');
const mainScanEntries = readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => line.startsWith('MEDICAL_SCAN_ENABLED='));
assert.ok(mainScanEntries.length <= 1 && mainScanEntries.every(line => /^MEDICAL_SCAN_ENABLED=['"]?false['"]?\s*$/.test(line)), 'Main-env rollback must remain disabled.');
assert.ok(readFileSync('config/medical.php', 'utf8').includes("'enabled' => env('MEDICAL_SCAN_ENABLED', false)"), 'Absent main-env entry must default to disabled.');
const app = JSON.parse(run(['inspect', 'checkupino_app']))[0];
const worker = JSON.parse(run(['inspect', 'checkupino_scan-scan-worker-1']))[0];
assert.equal(app.Image, image); assert.equal(app.State.Running, true);
assert.equal(worker.Image, image); assert.equal(worker.State.Running, true);
assert.equal(worker.Config.User, '33:33'); assert.equal(worker.HostConfig.ReadonlyRootfs, true);
assert.equal(worker.HostConfig.Memory, 268435456); assert.equal(worker.HostConfig.MemorySwap, 268435456);
assert.equal(worker.HostConfig.NanoCpus, 500000000); assert.equal(worker.HostConfig.PidsLimit, 32);
assert.equal(worker.HostConfig.RestartPolicy.Name, 'no');
assert.ok(worker.Config.Cmd.at(-1).endsWith('exec sleep infinity'));
for (const container of [app, worker]) {
  for (const [name, target] of [['checkupino_scan_scan_socket','/run/medical-scan'],['checkupino_content_socket','/run/medical-content']]) assert.ok(container.Mounts.some(mount => mount.Name === name && mount.Destination === target && mount.RW === false));
}
const php = String.raw`<?php
require 'vendor/autoload.php';$app=require 'bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(posix_geteuid()!==33 || $app->configurationIsCached() || config('medical.scanner.enabled')!==true || config('filesystems.disks.private.driver')!=='local' || config('database.default')!=='mysql') throw new RuntimeException('Producer configuration rejected.');
use Illuminate\Support\Facades\DB;
DB::statement('START TRANSACTION READ ONLY');
try {
 $r=App\Models\Reservation::findOrFail(8);$request=App\Models\ReservationMedicalRequest::where('public_id','01m4hfgan168p6q5ftp528285f')->firstOrFail();
 if($r->user_id!==4 || $r->doctor->user_id!==5 || $request->reservation_id!==8 || $request->status!==App\Enums\ReservationMedicalRequestStatus::Open) throw new RuntimeException('Synthetic target rejected.');
 $counts=['requests'=>DB::table('reservation_medical_requests')->count(),'files'=>DB::table('reservation_files')->count(),'reports'=>DB::table('reservation_reports')->count(),'jobs'=>DB::table('jobs')->count()];
 if($counts!==['requests'=>2,'files'=>1,'reports'=>0,'jobs'=>0]) throw new RuntimeException('Pre-upload checkpoint required.');
 $hashes=[];foreach(['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events'] as $table) $hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['protected']=hash('sha256',json_encode(App\Models\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));
 $hashes['existing_audits']=hash('sha256',json_encode(App\Models\AuditEvent::where('id','<=',9)->orderBy('id')->get()->toArray(),JSON_THROW_ON_ERROR));
 $bytes=Tests\Fixtures\SyntheticMedicalFiles::pdf();$stream=fopen('php://temp','w+b');fwrite($stream,$bytes);rewind($stream);
 try{$scan=app(App\Services\ClamdScanner::class)->scan($stream);rewind($stream);$content=app(App\Services\MedicalContentValidator::class)->validate($stream,'application/pdf');}finally{fclose($stream);}
 if($scan->status!==App\Enums\ReservationFileScanStatus::Clean || $scan->checksumSha256!==hash('sha256',$bytes)) throw new RuntimeException('Fresh scanner/parser acceptance failed.');
 $queue=config('queue.connections.medical-scan');if($queue['driver']!=='database' || $queue['queue']!=='medical-scan' || $queue['table']!=='jobs' || $queue['retry_after']<=120 || $queue['after_commit']!==false) throw new RuntimeException('Dedicated queue rejected.');
 echo json_encode(['acceptance'=>'passed','dispatch_enabled'=>true,'private_driver'=>'local','counts'=>$counts,'hashes'=>$hashes,'scanner'=>$scan->auditFacts(),'content_policy_revision'=>$content['content_policy_revision'],'uid'=>33,'clinical_writes'=>false,'job_consumption'=>false],JSON_THROW_ON_ERROR);
}finally{DB::statement('ROLLBACK');}
`;
const runtime = JSON.parse(run(['exec','-i','--user','33:33','checkupino_app','php'],php));
assert.equal(runtime.acceptance,'passed');
const baseline=JSON.parse(readFileSync('docs/deployment/evidence/medical-outcome-browser-2026-10-11.json','utf8'));
assert.equal(baseline.acceptance,'passed'); assert.deepEqual(runtime.hashes,baseline.final.hashes);
let healthy=false;
for(let attempt=0;attempt<10;attempt++) {
  try { const response=await fetch('http://localhost:8080/',{signal:AbortSignal.timeout(3000)}); if(response.status===200){healthy=true;break;} } catch {}
  await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(healthy,'Backend HTTP is not ready.');
const guest=await fetch('http://localhost:8080/api/auth/me',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});
assert.equal(guest.status,401);
writeFileSync('docs/deployment/evidence/demo-producer-runtime-2026-10-11.json',JSON.stringify({checked_at:new Date().toISOString(),acceptance:'passed',image,runtime,http:200,guest:401,main_env_dispatch_disabled:true,worker_idle:true,scope:'Read-only producer/socket/scanner/parser/clinical fingerprints; no upload, job processing or report acceptance.'},null,2)+'\n');
console.log(JSON.stringify({acceptance:'passed',dispatch_enabled:true,worker_idle:true,counts:runtime.counts,clinical_writes:false}));
