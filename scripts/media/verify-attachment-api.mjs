import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// One ordinary cookie/CSRF API acceptance. Never replay uncertain successful writes.
// --verify-existing only reads the completed run; no login, upload or other POST.
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/attachment-api-live-2026-10-08.json', import.meta.url));
const verifyExisting = process.argv.includes('--verify-existing');
const scannerReady = process.argv.includes('--scanner-ready');
assert.ok(process.argv.slice(2).every(value => ['--verify-existing', '--scanner-ready'].includes(value)), 'Unknown attachment acceptance option.');
assert.ok(!scannerReady || verifyExisting, 'Scanner-ready mode is read-only and requires --verify-existing.');
assert.ok(verifyExisting || !existsSync(evidencePath), 'Existing run evidence must be reviewed; do not replay live writes.');
const prior = verifyExisting ? JSON.parse(readFileSync(evidencePath, 'utf8')) : null;
if (prior) assert.equal(prior.acceptance, 'passed');
const run = prior?.run ?? `checkupino-attachment-${Date.now()}`;
assert.match(run, /^checkupino-attachment-\d+$/);
const title = `Synthetic attachment acceptance ${run}`;
const bytes = 1048576;
const checks = [], wire = [], clients = [];
let baseline, finalState, failure, requestId, fileId, containers, health;
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
const save = () => writeFileSync(evidencePath, JSON.stringify({
  run, title, acceptance: failure ? 'failed' : finalState ? 'passed' : 'in_progress',
  baseline, final: finalState, request_public_id: requestId, file_public_id: fileId,
  checks, wire, containers, health, failure,
  limits: ['Cookie/CSRF API acceptance only; no File Manager/form UI or browser CORS acceptance.',
    'Synthetic PDF remains quarantined; no actual scan, worker, publication or clean verdict.',
    'No content-parser, large-file/multipart, quota or capacity acceptance.'],
}, null, 2) + '\n');
const record = (name, details = true) => { checks.push({ name, details }); console.log(name); save(); };
const snapshot = () => {
  const php = `<?php
require '/var/www/vendor/autoload.php'; $app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Illuminate\\Support\\Facades\\DB;
$policies = app(App\\Services\\UploadPolicySettings::class);
DB::statement('SET TRANSACTION READ ONLY'); DB::beginTransaction();
try {
 $reservation = App\\Models\\Reservation::with(['doctor.user.roles','user.roles','payment'])->findOrFail(8);
 $other = App\\Models\\Reservation::findOrFail(7);
 $requests = App\\Models\\ReservationMedicalRequest::withTrashed()->where('title','${title}')->get();
 $files = App\\Models\\ReservationFile::withTrashed()->whereIn('medical_request_id',$requests->modelKeys())->get();
 $integrity = [];
 foreach ($files as $file) { $copy = App\\Support\\VerifiedPrivateFile::open($file); $copy->close(); $integrity[$file->public_id] = true; }
 $protected = App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray();
 $fingerprint = fn($data) => hash('sha256',json_encode($data,JSON_THROW_ON_ERROR));
 $booking = [];
 foreach (['reservations','reservation_payment_summaries','payment_attempts','payment_provider_events','outbox_events'] as $table) {
   $booking[$table] = DB::table($table)->orderBy('id')->get()->toArray();
 }
 $events = App\\Models\\AuditEvent::whereIn('subject_public_id',array_merge($requests->pluck('public_id')->all(),$files->pluck('public_id')->all()))->orderBy('id')->get();
 echo json_encode([
  'checked_at'=>now('Asia/Tehran')->toIso8601String(), 'mysql_select'=>DB::selectOne('SELECT 1 AS connected')->connected,
  'redis_ping'=>(string)Illuminate\\Support\\Facades\\Redis::ping(), 'scanning_enabled'=>config('medical.scanner.enabled'),
  'private_driver'=>config('filesystems.disks.private.driver'),
  'attachment_schema_ready'=>Illuminate\\Support\\Facades\\Schema::hasColumns('reservation_medical_requests',['attachment_policy','attachment_policy_revision']),
  'fixture'=>['reservation_id'=>8,'public_id'=>$reservation->public_id,'status'=>$reservation->status->value,
   'patient_id'=>$reservation->user_id,'doctor_id'=>$reservation->doctor->user_id,'payment_status'=>$reservation->payment->status->value,
   'starts_at'=>$reservation->starts_at->toIso8601String(),'completed_at'=>$reservation->completed_at?->toIso8601String(),
   'other_reservation_public_id'=>$other->public_id,
   'accounts'=>collect([$reservation->doctor->user,$reservation->user,App\\Models\\User::with('roles')->findOrFail(3)])
     ->map(fn($user)=>['id'=>$user->id,'email'=>$user->email,'roles'=>$user->roles->pluck('name')->all()])->all()],
  'medical'=>$policies->describe('uploads.medical'), 'public_media'=>$policies->describe('uploads.public_media'),
  'protected_fingerprint'=>$fingerprint($protected),
  'settings_fingerprint'=>$fingerprint(App\\Models\\SettingValue::orderBy('id')->get()->toArray()),
  'booking_payment_outbox_fingerprint'=>$fingerprint($booking),
  'setting_audits_fingerprint'=>$fingerprint(App\\Models\\AuditEvent::whereIn('id',[5,6])->orderBy('id')->get()->toArray()),
  'counts'=>['requests'=>App\\Models\\ReservationMedicalRequest::withTrashed()->count(),'files'=>App\\Models\\ReservationFile::withTrashed()->count(),
   'reports'=>App\\Models\\ReservationReport::withTrashed()->count(),'jobs'=>DB::table('jobs')->count(),
   'settings'=>App\\Models\\SettingValue::count(),'definitions'=>App\\Models\\SettingDefinition::count()],
  'requests'=>$requests->map(fn($row)=>['public_id'=>$row->public_id,'reservation_id'=>$row->reservation_id,'requested_by'=>$row->requested_by,
    'status'=>$row->status->value,'attachment_policy'=>$row->attachment_policy,'attachment_policy_revision'=>$row->attachment_policy_revision,
    'retention_until'=>$row->retention_until?->toIso8601String(),'deleted_at'=>$row->deleted_at?->toIso8601String()])->all(),
  'files'=>$files->map(fn($row)=>['public_id'=>$row->public_id,'reservation_id'=>$row->reservation_id,'medical_request_id'=>$row->medicalRequest->public_id,
   'uploaded_by'=>$row->uploaded_by,'mime_type'=>$row->mime_type,'size_bytes'=>$row->size_bytes,'checksum_sha256'=>$row->checksum_sha256,
   'scan_status'=>$row->scan_status->value,'scanned_at'=>$row->scanned_at?->toIso8601String(),'retention_until'=>$row->retention_until?->toIso8601String(),
   'deleted_at'=>$row->deleted_at?->toIso8601String(),'private_integrity_verified'=>$integrity[$row->public_id]])->all(),
  'audits'=>$events->map(fn($row)=>['id'=>$row->id,'actor_id'=>$row->actor_user_id,'action'=>$row->action,'subject_public_id'=>$row->subject_public_id,
   'risk_level'=>$row->risk_level,'outcome'=>$row->outcome,'before'=>$row->before,'after'=>$row->after,'route'=>$row->route])->all(),
 ],JSON_THROW_ON_ERROR);
} finally { DB::rollBack(); }
`;
  const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], {
    input: php, encoding: 'utf8', windowsHide: true, timeout: 45000,
  });
  assert.equal(result.status, 0, 'Read-only synthetic fixture/integrity snapshot must succeed.');
  return JSON.parse(result.stdout);
};
const safe = state => ({ ...state, fixture: { ...state.fixture, accounts: state.fixture.accounts.map(({ id, roles }) => ({ id, roles })) } });
const unchanged = state => {
  assert.equal(state.mysql_select, 1); assert.ok(['1','PONG','+PONG'].includes(state.redis_ping));
  assert.equal(state.attachment_schema_ready, true); assert.equal(state.scanning_enabled, false); assert.equal(state.private_driver, 'local');
  for (const key of ['protected_fingerprint','settings_fingerprint','booking_payment_outbox_fingerprint','setting_audits_fingerprint']) assert.equal(state[key], baseline[key]);
  assert.deepEqual(state.medical, baseline.medical); assert.deepEqual(state.public_media, baseline.public_media);
  assert.equal(state.counts.jobs, 0); assert.equal(state.counts.reports, 0);
  assert.equal(state.counts.settings, 4); assert.equal(state.counts.definitions, 4);
};
const pdf = target => {
  let padding = Math.max(0, target - 650);
  for (let iteration = 0; iteration < 8; iteration++) {
    const content = 'BT /F1 12 Tf 72 720 Td (Checkupino synthetic fixture. No patient data.) Tj ET\n';
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}endstream`,
      `<< /Length ${padding} >>\nstream\n${' '.repeat(padding)}\nendstream`];
    let value = '%PDF-1.4\n% Synthetic fixture only\n'; const offsets = [0];
    objects.forEach((object, index) => { offsets.push(value.length); value += `${index+1} 0 obj\n${object}\nendobj\n`; });
    const xref = value.length;
    value += 'xref\n0 7\n0000000000 65535 f \n' + offsets.slice(1).map(offset => `${String(offset).padStart(10,'0')} 00000 n \n`).join('');
    value += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const result = Buffer.from(value, 'ascii');
    if (result.length === target) return result;
    padding += target - result.length;
  }
  throw new Error('Synthetic PDF exact-size construction failed.');
};
const client = account => {
  const cookies = new Map();
  const call = async (path, method = 'GET', body) => {
    const headers = { Accept: 'application/json', Origin: 'http://localhost:3000', Referer: 'http://localhost:3000/panel/' };
    if (cookies.size) headers.Cookie = [...cookies].map(([key,value])=>`${key}=${value}`).join('; ');
    const csrf = cookies.get('XSRF-TOKEN');
    if (method !== 'GET' && csrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(csrf);
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const start = performance.now();
    const response = await fetch('http://localhost:8080'+path, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(60000) });
    for (const cookie of response.headers.getSetCookie()) { const pair=cookie.split(';',1)[0]; const index=pair.indexOf('='); cookies.set(pair.slice(0,index),pair.slice(index+1)); }
    const data = await response.text();
    wire.push({ actor_id: account.id, method, path, status: response.status, has_csrf: method==='GET' ? null : !!csrf, elapsed_ms: Math.round(performance.now()-start) });
    let parsed; try { parsed=JSON.parse(data); } catch { parsed=null; }
    return { status: response.status, data: parsed };
  };
  const result = { call, id: account.id, loggedIn: false,
    login: async password => {
      assert.equal((await call('/sanctum/csrf-cookie')).status,204);
      assert.equal((await call('/login','POST',{email:account.email,password})).status,200);
      result.loggedIn=true;
      const me=await call('/api/auth/me'); assert.equal(me.status,200); assert.equal(me.data.data.id,account.id);
    },
    logout: async () => { if(result.loggedIn) { assert.equal((await call('/logout','POST',{})).status,200); result.loggedIn=false; assert.equal((await call('/api/auth/me')).status,401); } },
  }; clients.push(result); return result;
};
const uploadBody = (buffer, extra = {}) => {
  const form = new FormData(); form.append('file',new Blob([buffer],{type:'application/pdf'}),'checkupino-synthetic.pdf');
  form.append('label','Synthetic attachment acceptance');
  for(const [key,value] of Object.entries(extra)) form.append(key,value);
  return form;
};

try {
  const names=['checkupino_app','checkupino_nginx','checkupino_db','checkupino_redis','checkupino_prod-admin-1','checkupino_scan-scanner-1','checkupino_scan-scan-check-1',
    ...['master','volume','filer','s3'].map(name=>`checkupino_media-media-${name}-1`)];
  const inspected=spawnSync('docker',['inspect',...names],{encoding:'utf8',windowsHide:true,timeout:25000}); assert.equal(inspected.status,0);
  const runtimeRows=JSON.parse(inspected.stdout);
  containers=runtimeRows.map(row=>({name:row.Name.slice(1),status:row.State.Status,exit_code:row.State.ExitCode,restarts:row.RestartCount,image:row.Image}));
  for(const row of containers) assert.equal(row.status,!scannerReady && row.name.startsWith('checkupino_scan-')?'exited':'running');
  if(scannerReady) {
    const scanner=runtimeRows.find(row=>row.Name==='/checkupino_scan-scanner-1');
    const checker=runtimeRows.find(row=>row.Name==='/checkupino_scan-scan-check-1');
    assert.equal(scanner.Config.Image,'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186');
    assert.equal(scanner.State.Health?.Status,'healthy');
    assert.equal(scanner.State.OOMKilled,false);
    assert.equal(scanner.Config.User,'100:100');
    assert.equal(scanner.HostConfig.RestartPolicy.Name,'no');
    assert.equal(scanner.HostConfig.ReadonlyRootfs,true);
    assert.deepEqual(scanner.HostConfig.CapDrop,['ALL']);
    assert.equal(scanner.HostConfig.Privileged,false);
    assert.ok(scanner.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
    assert.equal(checker.Image,'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
    assert.equal(checker.Config.User,'33:33');
    assert.equal(checker.State.OOMKilled,false);
    assert.ok(checker.Mounts.some(row=>row.Name==='checkupino_scan_scan_socket' && row.Destination==='/run/medical-scan' && !row.RW));
  } else {
    assert.equal(containers.find(row=>row.name==='checkupino_scan-scanner-1').exit_code,17);
  }
  assert.ok(containers.filter(row=>row.name.startsWith('checkupino_scan-')).every(row=>row.restarts===0));
  health=[];
  for(const [url,status] of [['http://localhost:8080/up',200],['http://localhost:3000/healthz',200],['http://localhost:8080/api/auth/me',401]]) {
    const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(45000)}); assert.equal(response.status,status); await response.body?.cancel(); health.push({url,status});
  }
  const start=snapshot();
  if(verifyExisting) {
    baseline=prior.baseline; finalState=safe(start); requestId=prior.request_public_id; fileId=prior.file_public_id;
    unchanged(finalState); assert.deepEqual(finalState.requests,prior.final.requests); assert.deepEqual(finalState.files,prior.final.files); assert.deepEqual(finalState.audits,prior.final.audits);
    console.log('Read-only existing attachment acceptance, integrity, quarantine, history and runtime pass; no POST or upload.');
  } else {
    baseline=safe(start); unchanged(start);
    assert.deepEqual(start.counts,{requests:0,files:0,reports:0,jobs:0,settings:4,definitions:4});
    assert.equal(start.fixture.status,'confirmed'); assert.equal(start.fixture.payment_status,'paid'); assert.equal(start.fixture.completed_at,null);
    assert.equal(start.fixture.patient_id,4); assert.equal(start.fixture.doctor_id,5);
    assert.equal(start.medical.default_max_bytes,10485760); assert.equal(start.public_media.default_max_bytes,5242880);
    assert.ok(start.fixture.accounts.every(account=>![7,8].includes(account.id)));
    record('Recovered backend HTTP/MySQL/Redis, approved schema and untouched synthetic fixture baseline pass');
    const password=readFileSync('.env','utf8').match(/^DEMO_SEED_PASSWORD=(.*)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/,'$2'); assert.ok(password);
    const doctor=client(start.fixture.accounts.find(account=>account.id===5));
    const patient=client(start.fixture.accounts.find(account=>account.id===4));
    const unassigned=client(start.fixture.accounts.find(account=>account.id===3));
    for(const actor of [doctor,patient,unassigned]) await actor.login(password);
    const doctorPath=`/api/doctor/reservations/${start.fixture.public_id}/medical-requests`;
    const payload={request_type:'synthetic_document',title,instructions:'Synthetic fixture only. No patient data.',attachment_rules:{allowed_mime_types:['application/pdf'],max_bytes:bytes}};
    assert.equal((await patient.call(doctorPath,'POST',payload)).status,403);
    assert.equal((await unassigned.call(doctorPath,'POST',payload)).status,404);
    assert.equal((await doctor.call(doctorPath,'POST',{...payload,attachment_rules:{allowed_mime_types:['video/mp4'],max_bytes:bytes}})).status,422);
    const beforeCreate=snapshot(); unchanged(beforeCreate); assert.equal(beforeCreate.counts.requests,0);
    record('Patient/unassigned doctor creation and unsupported doctor MIME rules reject without persistence');
    const created=await doctor.call(doctorPath,'POST',payload); assert.equal(created.status,201);
    requestId=created.data.data.public_id; assert.match(requestId,/^[0-9a-hjkmnp-tv-z]{26}$/i); save();
    const rules=created.data.data.attachment_rules; assert.equal(rules.state,'available'); assert.deepEqual(rules.max_bytes_by_mime,{'application/pdf':bytes});
    const afterCreate=snapshot(); unchanged(afterCreate); assert.equal(afterCreate.counts.requests,1); assert.equal(afterCreate.counts.files,0);
    assert.equal(afterCreate.requests[0].status,'open'); assert.equal(afterCreate.requests[0].requested_by,5);
    assert.deepEqual(afterCreate.requests[0].attachment_policy.max_bytes_by_mime,{'application/pdf':bytes});
    assert.equal(afterCreate.audits.length,1); assert.equal(afterCreate.audits[0].action,'reservation_medical_request.created');
    assert.equal(afterCreate.audits[0].after.attachment_policy_revision,rules.issued_revision);
    record('Assigned doctor issues one immutable PDF-only 1 MiB request and minimal audit through ordinary CSRF API');
    const patientBase=`/api/reservations/${start.fixture.public_id}/medical-requests/${requestId}`;
    const uploadPath=patientBase+'/files';
    const listed=await patient.call(`/api/reservations/${start.fixture.public_id}/medical-requests`); assert.equal(listed.status,200);
    assert.ok(listed.data.data.some(row=>row.public_id===requestId && row.attachment_rules.revision===rules.revision));
    assert.equal((await unassigned.call(doctorPath+'/'+requestId)).status,404);
    assert.equal((await patient.call(`/api/reservations/${start.fixture.other_reservation_public_id}/medical-requests/${requestId}/files`,'POST',uploadBody(pdf(bytes)))).status,404);
    assert.equal((await unassigned.call(uploadPath,'POST',uploadBody(pdf(bytes)))).status,404);
    assert.equal((await patient.call(uploadPath,'POST',uploadBody(pdf(bytes),{scan_status:'clean'}))).status,422);
    assert.equal((await patient.call(uploadPath,'POST',uploadBody(pdf(bytes+1)))).status,422);
    const image=new FormData(); image.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7yEAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'synthetic.png');
    assert.equal((await patient.call(uploadPath,'POST',image)).status,422);
    const rejected=snapshot(); unchanged(rejected); assert.equal(rejected.counts.files,0); assert.equal(rejected.audits.length,1);
    record('Patient discovers rules; foreign role/reservation, forged clean state, PNG and 1 MiB plus one byte reject without file/audit/job');
    const contents=pdf(bytes); const uploaded=await patient.call(uploadPath,'POST',uploadBody(contents)); assert.equal(uploaded.status,201);
    fileId=uploaded.data.data.public_id; save(); assert.equal(uploaded.data.data.available,false); assert.equal(uploaded.data.data.size_bytes,bytes);
    for(const field of ['path','disk','scan_status','checksum_sha256','uploaded_by','original_filename','safe_filename']) assert.equal(uploaded.data.data[field],undefined);
    const accepted=snapshot(); unchanged(accepted); assert.equal(accepted.counts.files,1); assert.equal(accepted.files.length,1);
    const file=accepted.files[0]; assert.equal(file.public_id,fileId); assert.equal(file.scan_status,'quarantined'); assert.equal(file.scanned_at,null);
    assert.equal(file.size_bytes,bytes); assert.equal(file.checksum_sha256,sha(contents)); assert.equal(file.private_integrity_verified,true);
    assert.equal(file.uploaded_by,4); assert.equal(file.reservation_id,8); assert.equal(file.medical_request_id,requestId);
    assert.equal(file.retention_until,accepted.requests[0].retention_until); assert.equal(accepted.audits.length,2);
    assert.equal(accepted.audits[1].action,'reservation_medical_file.uploaded'); assert.equal(accepted.audits[1].actor_id,4);
    assert.equal(accepted.audits[1].after.attachment_policy_revision,rules.issued_revision);
    assert.equal(accepted.audits[1].after.effective_attachment_policy_revision,rules.revision);
    record('Exactly 1 MiB PDF persists once in private quarantine with matching canonical metadata/digest, policy revisions and audit');
    const detail=await doctor.call(doctorPath+'/'+requestId); assert.equal(detail.status,200); assert.deepEqual(detail.data.data.files,[]);
    assert.equal((await doctor.call(doctorPath+'/'+requestId+'/files/'+fileId+'/download')).status,422);
    assert.equal((await patient.call(patientBase+'/files/'+fileId+'/download')).status,404);
    assert.equal((await patient.call(patientBase+'/outcome')).status,404);
    record('Quarantined file is absent from doctor review list; doctor download and patient download/outcome remain blocked');
    for(const actor of clients) await actor.logout();
    assert.ok(wire.filter(row=>row.method==='POST').every(row=>row.has_csrf));
    finalState=safe(snapshot()); unchanged(finalState); assert.equal(finalState.counts.requests,1); assert.equal(finalState.counts.files,1); assert.equal(finalState.audits.length,2);
    record('Acknowledged logout, CSRF writes, retained booking/payment/outbox/settings/protected state and disabled scanning/zero jobs pass');
  }
} catch(error) {
  failure=error.message;
  console.error('Attachment API acceptance stopped: '+failure);
  process.exitCode=1;
} finally {
  if(!verifyExisting) {
    for(const actor of clients) { try { await actor.logout(); } catch { /* Keep original failure and never retry clinical writes. */ } }
    if(failure) { try { finalState=safe(snapshot()); } catch { /* Backend may be unavailable; retain checkpoints. */ } }
    save();
  }
}
