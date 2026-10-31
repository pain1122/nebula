import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
assert.equal(process.argv.length,2,'No endpoint/account overrides accepted.');
const path=name=>fileURLToPath(new URL('../../docs/deployment/evidence/'+name,import.meta.url));
const postedPath=path('medical-request-browser-retry-2026-10-10.json');
const posted=JSON.parse(readFileSync(postedPath,'utf8'));
const readonlyPath=path('medical-request-readonly-2026-10-10.json');
const readonly=JSON.parse(readFileSync(readonlyPath,'utf8'));
const staticPath=path('medical-request-static-2026-10-10.json');
const assets=JSON.parse(readFileSync(staticPath,'utf8'));
const excludedPath=path('medical-request-browser-2026-10-10.json');
const excluded=JSON.parse(readFileSync(excludedPath,'utf8'));
// Complete the recorded ordinary delivery through read-only checks. Never login or POST here.
assert.equal(excluded.clinical_write_started,false);
assert.deepEqual(excluded.baseline.hashes,excluded.final.hashes);
assert.deepEqual(excluded.baseline.audit_hashes,excluded.final.audit_hashes);
assert.equal(posted.acceptance,'failed');
assert.equal(posted.failure,'Medical GET preflight.\n\n1 !== 0\n');
assert.equal(posted.clinical_write_started,true);
assert.equal(posted.checks.length,12);
assert.match(posted.run,/^checkupino-medical-request-\d+$/);
const syntheticTitle='Synthetic panel request '+posted.run;
assert.equal(readonly.acceptance,'passed');assert.equal(readonly.checks.length,9);
assert.deepEqual(readonly.baseline.hashes,readonly.final.hashes);
for(const [table,hash]of Object.entries(readonly.final.hashes))assert.equal(posted.final.hashes[table],hash);
assert.deepEqual(readonly.final.counts,posted.final.counts);
assert.equal(assets.acceptance,'passed');assert.equal(assets.assets.length,21);
assert.deepEqual(posted.exceptions,[]);assert.deepEqual(posted.external,[]);assert.deepEqual(posted.blocked,[]);
const medicalWrites=posted.requests.filter(r=>!['GET','OPTIONS'].includes(r.method)&&!['/login','/logout'].includes(r.path));
assert.equal(medicalWrites.length,1);assert.equal(medicalWrites[0].method,'POST');assert.equal(medicalWrites[0].phase,'doctor-request-controls');
const preflights=posted.requests.filter(r=>r.method==='OPTIONS'&&r.path.includes('medical-requests'));
assert.equal(preflights.length,1);assert.equal(preflights[0].phase,'doctor-request-controls');assert.equal(preflights[0].path,medicalWrites[0].path);
assert.equal(posted.responses.filter(r=>r.method==='OPTIONS'&&r.path===medicalWrites[0].path&&r.status===204).length,1);
assert.equal(posted.responses.filter(r=>r.method==='POST'&&r.path===medicalWrites[0].path&&r.status===201).length,1);
const snapshot = () => {
  const php = `<?php
require '/var/www/vendor/autoload.php'; $app=require '/var/www/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Illuminate\\Support\\Facades\\DB;
DB::statement('SET TRANSACTION READ ONLY'); DB::beginTransaction();
try {
 $r=App\\Models\\Reservation::with(['doctor.user.roles','user.roles'])->findOrFail(8);
 $m=$r->medicalRequests()->firstOrFail();
 $originalFile=$m->files()->firstOrFail(); $verified=App\\Support\\VerifiedPrivateFile::open($originalFile); $verified->close();
 $tables=['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events']; $hashes=[];
 foreach($tables as $table) $hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['protected']=hash('sha256',json_encode(App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));
 $hashes['existing_request']=hash('sha256',json_encode(DB::table('reservation_medical_requests')->where('id',$m->getKey())->first(),JSON_THROW_ON_ERROR));
 $auditHashes=[]; foreach(DB::table('audit_events')->orderBy('id')->get() as $audit) $auditHashes[$audit->id]=hash('sha256',json_encode($audit,JSON_THROW_ON_ERROR));
 $new=App\\Models\\ReservationMedicalRequest::where('title','${syntheticTitle}')->first();
 if($new) App\\Services\\MedicalAttachmentPolicy::validateSnapshot($new->attachment_policy,$new->attachment_policy_revision);
 $newAudits=$new?App\\Models\\AuditEvent::where('subject_public_id',$new->public_id)->orderBy('id')->get()->map(fn($a)=>['id'=>$a->id,'action'=>$a->action,'actor'=>$a->actor_user_id,'subject'=>$a->subject_public_id,'risk'=>$a->risk_level,'revision'=>$a->after['attachment_policy_revision']??null,'keys'=>array_keys($a->after??[])])->all():[];
 $hashes['existing_audits']=hash('sha256',json_encode(App\\Models\\AuditEvent::whereIn('id',[5,6,7,8])->orderBy('id')->get()->toArray(),JSON_THROW_ON_ERROR));
 echo json_encode(['reservation'=>$r->public_id,'request'=>$m->public_id,'request_status'=>$m->status->value,'scanning'=>config('medical.scanner.enabled'),'private_driver'=>config('filesystems.disks.private.driver'),
 'counts'=>['requests'=>DB::table('reservation_medical_requests')->count(),'files'=>DB::table('reservation_files')->count(),'reports'=>DB::table('reservation_reports')->count(),'jobs'=>DB::table('jobs')->count()],
 'accounts'=>collect([$r->user,$r->doctor->user,App\\Models\\User::with('roles')->findOrFail(3),App\\Models\\User::with('roles')->findOrFail(2),App\\Models\\User::with('roles')->findOrFail(1)])->map(fn($u)=>['id'=>$u->id,'email'=>$u->email,'roles'=>$u->roles->pluck('name')->all()])->all(),
 'hashes'=>$hashes,'audit_hashes'=>$auditHashes,
 'new_request'=>$new?['public_id'=>$new->public_id,'reservation_id'=>$new->reservation_id,'requested_by'=>$new->requested_by,'status'=>$new->status->value,'request_type'=>$new->request_type,'policy'=>$new->attachment_policy,'revision'=>$new->attachment_policy_revision]:null,
 'new_audits'=>$newAudits],JSON_THROW_ON_ERROR);
} finally { DB::rollBack(); }
`;
  const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, 'Readonly synthetic fixture snapshot failed.');
  return JSON.parse(result.stdout);
};

const live=snapshot();
assert.equal(live.scanning,false);assert.equal(live.private_driver,'local');
assert.deepEqual(live.counts,{requests:2,files:1,reports:0,jobs:0});
assert.deepEqual(live.hashes,posted.final.hashes);
assert.deepEqual(live.audit_hashes,posted.final.audit_hashes);
for(const [table,hash]of Object.entries(posted.baseline.hashes))if(table!=='reservation_medical_requests')assert.equal(live.hashes[table],hash);
for(const [id,hash]of Object.entries(posted.baseline.audit_hashes))assert.equal(live.audit_hashes[id],hash);
assert.equal(Object.keys(live.audit_hashes).length,Object.keys(posted.baseline.audit_hashes).length+1);
assert.deepEqual(live.new_request,posted.final.new_request);
assert.equal(live.new_request.public_id,posted.issued_request);assert.equal(live.new_request.reservation_id,8);assert.equal(live.new_request.requested_by,5);
assert.equal(live.new_request.status,'open');assert.equal(live.new_request.request_type,'document');
assert.deepEqual(live.new_request.policy.allowed_mime_types,['application/pdf']);assert.deepEqual(live.new_request.policy.max_bytes_by_mime,{'application/pdf':524288});
assert.equal(live.new_audits.length,1);const audit=live.new_audits[0];
assert.equal(audit.action,'reservation_medical_request.created');assert.equal(audit.actor,5);assert.equal(audit.subject,posted.issued_request);assert.equal(audit.risk,'critical');
assert.equal(audit.revision,live.new_request.revision);
assert.ok(audit.keys.every(k=>['request_public_id','reservation_public_id','status','attachment_policy_revision','due_at','reviewed_at','closed_at','retention_until'].includes(k)));
const evidence={checked_at:new Date().toISOString(),acceptance:'passed',run:posted.run,image:assets.image,issued_request:posted.issued_request,
  assets_checked:assets.assets.length,actual_write_browser_groups:posted.checks.length,actual_readonly_browser_groups:readonly.checks.length,
  corrected_assertion:'One expected POST CORS preflight204 was incorrectly counted by the earlier GET-only assertion; recorded delivery was not repeated.',
  accepted_counts:live.counts,hashes:live.hashes,audit_hashes:live.audit_hashes,request:live.new_request,audit,
  original_file_integrity:true,issued_policy_integrity:true,original_history_protected_fingerprints_preserved:true,
  scanning:false,private_driver:'local',reports:0,jobs:0,
  evidence_sha256:Object.fromEntries([postedPath,readonlyPath,staticPath,excludedPath].map(p=>[p.split(/[\\/]/).pop(),createHash('sha256').update(readFileSync(p)).digest('hex')])),
  scope:'Actual rendered one synthetic request/one audit plus served assets and current read-only browser/integrity/history acceptance; no upload, worker, scanning, review, report or booking completion.'
};
writeFileSync(path('medical-request-deployed-2026-10-10.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({acceptance:'passed',image:assets.image,assets:21,write_browser_groups:12,readonly_browser_groups:9,issued_request:posted.issued_request,counts:live.counts}));
