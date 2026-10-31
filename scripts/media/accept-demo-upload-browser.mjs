import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'No endpoint/account overrides accepted.');
if (existsSync('docs/deployment/evidence/demo-upload-browser-2026-10-11.json')) {
  const previous=JSON.parse(readFileSync('docs/deployment/evidence/demo-upload-browser-2026-10-11.json','utf8'));
  assert.ok(!previous.requests?.some(request=>request.method==='POST'&&request.path.includes('medical-requests')), 'A medical POST was already attempted; do not replay this writer.');
}
// Existing synthetic demo credentials stay in memory. Protected users never log in.
const password = readFileSync('.env', 'utf8').match(/^DEMO_SEED_PASSWORD=(.*)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
assert.ok(password, 'Configured demo password required.');
const snapshot = () => {
  const php = `<?php
require '/var/www/vendor/autoload.php'; $app=require '/var/www/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Illuminate\\Support\\Facades\\DB;
DB::statement('SET TRANSACTION READ ONLY'); DB::beginTransaction();
try {
 $r=App\\Models\\Reservation::with(['doctor.user.roles','user.roles'])->findOrFail(8);
 $m=$r->medicalRequests()->where('public_id','01m4hfgan168p6q5ftp528285f')->firstOrFail();
 $tables=['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events']; $hashes=[];
 foreach($tables as $table) $hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['protected']=hash('sha256',json_encode(App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));
 $hashes['existing_audits']=hash('sha256',json_encode(App\\Models\\AuditEvent::where('id','<=',9)->orderBy('id')->get()->toArray(),JSON_THROW_ON_ERROR));
 echo json_encode(['reservation'=>$r->public_id,'request'=>$m->public_id,'request_title'=>$m->title,'file'=>App\\Models\\ReservationFile::firstOrFail()->public_id,'request_status'=>$m->status->value,'scanning'=>config('medical.scanner.enabled'),'private_driver'=>config('filesystems.disks.private.driver'),
 'counts'=>['requests'=>DB::table('reservation_medical_requests')->count(),'files'=>DB::table('reservation_files')->count(),'reports'=>DB::table('reservation_reports')->count(),'jobs'=>DB::table('jobs')->count()],
 'original_file_hash'=>hash('sha256',json_encode(DB::table('reservation_files')->where('public_id','01M4DN9XK0Z7CKQ2GFBHSACA6H')->first(),JSON_THROW_ON_ERROR)), 'target_files'=>$m->files()->get(['public_id','scan_status','size_bytes'])->toArray(), 'accounts'=>collect([$r->user,$r->doctor->user,App\\Models\\User::with('roles')->findOrFail(3),App\\Models\\User::with('roles')->findOrFail(2),App\\Models\\User::with('roles')->findOrFail(1)])->map(fn($u)=>['id'=>$u->id,'email'=>$u->email,'roles'=>$u->roles->pluck('name')->all()])->all(),
 'hashes'=>$hashes],JSON_THROW_ON_ERROR);
} finally { DB::rollBack(); }
`;
  const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, 'Readonly synthetic fixture snapshot failed.');
  return JSON.parse(result.stdout);
};
const baseline = snapshot();
assert.equal(baseline.scanning, true); assert.equal(baseline.private_driver, 'local');
assert.deepEqual(baseline.counts, { requests: 2, files: 1, reports: 0, jobs: 0 });
assert.equal(baseline.request_status, 'open');
for (const actor of baseline.accounts) { assert.ok([1,2,3,4,5].includes(actor.id)); assert.match(actor.email, /@checkupino\.test$/); }
assert.match(baseline.request_title,/^Synthetic panel request /);
const producerProof = JSON.parse(readFileSync('docs/deployment/evidence/demo-producer-runtime-2026-10-11.json','utf8'));
assert.equal(producerProof.acceptance,'passed'); assert.deepEqual(baseline.hashes,producerProof.runtime.hashes); assert.deepEqual(baseline.target_files,[]);
const fixtureResult=spawnSync('docker',['exec','-i','--user','33:33','checkupino_app','php'],{input:'<?php require "vendor/autoload.php"; echo base64_encode(Tests\\Fixtures\\SyntheticMedicalFiles::pdf());',encoding:'utf8',windowsHide:true,timeout:20000});
assert.equal(fixtureResult.status,0);const fixture=fixtureResult.stdout.trim();assert.match(fixture,/^[A-Za-z0-9+/]+=*$/);
const fixtureBytes=Buffer.from(fixture,'base64');assert.ok(fixtureBytes.length>0&&fixtureBytes.length<=524288);
const uploadPath='/api/reservations/'+baseline.reservation+'/medical-requests/'+baseline.request+'/files';
let uploadRequests=0,receipt=null;
const profile = mkdtempSync(join(tmpdir(), 'checkupino-medical-browser-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--incognito', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-sync', '--window-size=1440,1000', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const copy = Object.fromEntries(['en','fa'].map(lang => [lang, JSON.parse(readFileSync(`frontend/src/locales/${lang}.json`, 'utf8'))]));
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/demo-upload-browser-2026-10-11.json', import.meta.url));
const pending = new Map(), network = new Map(), requests = [], responses = [], exceptions = [], external = [], checks = [], blocked = [];
let ws, sequence = 0, phase = 'setup', failure = null, finalState = null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: '+method)); }, 30000);
  pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
const wait = async (expression, label) => { const deadline = Date.now()+35000; while(Date.now()<deadline) { if(await evaluate(`Boolean(${expression})`)) return; await delay(100); } throw new Error('Browser timeout: '+label); };
const navigate = path => send('Page.navigate', { url: 'http://localhost:3000'+path });
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const setValue = (selector, value) => evaluate(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const api = path => evaluate(`fetch('http://localhost:8080'+${JSON.stringify(path)},{credentials:'include',headers:{Accept:'application/json'}}).then(async r=>({status:r.status,data:await r.json()}))`);
const record = name => { checks.push(name); console.log(JSON.stringify({ check: name, passed: true })); };
const text = () => evaluate(`document.querySelector('.page-content')?.textContent || ''`);
const locale = async lang => {
  if(await evaluate(`document.documentElement.lang!==${JSON.stringify(lang)}`)) { await click('.header-item:has(.language) > button'); await evaluate(`Array.from(document.querySelectorAll('.language .dropdown-item')).find(x=>x.textContent.trim()===${JSON.stringify(lang==='en'?'English':'فارسی')}).click()`); }
  await wait(`document.documentElement.lang===${JSON.stringify(lang)}`, 'locale');
  assert.equal(await evaluate('document.documentElement.dir'), lang==='fa'?'rtl':'ltr');
};
const login = async (id, landing) => {
  const actor = baseline.accounts.find(a=>a.id===id); assert.ok(actor && ![7,8].includes(id)); phase='actor-'+id;
  await navigate('/panel/login'); await wait(`document.querySelector('#email')`, 'login form');
  await setValue('#email',actor.email); await setValue('#password-input',password); await evaluate(`document.querySelector('form').requestSubmit()`);
  const location = landing === '/panel/' ? '/^\\/panel\\/?$/.test(location.pathname)' : `location.pathname===${JSON.stringify(landing)}`;
  await wait(`${location} && document.querySelector('.topbar-user')`, 'login landing');
  assert.equal((await api('/api/auth/me')).data.data.id,id);
};
const logout = async () => {
  const count = responses.filter(r=>r.path==='/logout'&&r.status===200).length;
  await click('.topbar-user > button'); await wait(`document.querySelector('[data-key="t-logout"]')`, 'logout');
  await evaluate(`document.querySelector('[data-key="t-logout"]').closest('button').click()`);
  await wait(`location.pathname==='/panel/login'&&document.querySelector('#email')`, 'logout landing');
  const until=Date.now()+30000; while(responses.filter(r=>r.path==='/logout'&&r.status===200).length===count){assert.ok(Date.now()<until,'Logout acknowledgement missing.');await delay(100);}
  assert.equal(await evaluate(`!!document.querySelector('.file-manager-sidebar')`),false);
};
const owned = '/panel/my/reservations/'+baseline.reservation+'/medical';
const assigned = '/panel/doctor/reservations/'+baseline.reservation+'/medical';
try {
  const activePort=join(profile,'DevToolsActivePort'); for(let i=0;i<100&&!existsSync(activePort);i++)await delay(100);
  assert.ok(existsSync(activePort),'Isolated Chrome did not start.');
  const port=Number(readFileSync(activePort,'utf8').split('\n')[0]);
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json(); ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);}
    else if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.text);
    else if(message.method==='Network.requestWillBeSent'){
      const r=message.params.request,url=new URL(r.url);
      if(url.origin==='http://localhost:8080'){const item={phase,method:r.method,path:url.pathname};requests.push(item);network.set(message.params.requestId,item);}
      else if(/^https?:$/.test(url.protocol)&&url.origin!=='http://localhost:3000')external.push(url.origin);
    }else if(message.method==='Network.responseReceived'){const item=network.get(message.params.requestId);if(item)responses.push({...item,status:message.params.response.status,request_id:message.params.requestId});}
    else if(message.method==='Fetch.requestPaused')void(async()=>{
      const {requestId,request}=message.params;const url=new URL(request.url);
      const permitted=url.origin==='http://localhost:3000'&&request.method==='GET'||url.origin==='http://localhost:8080'&&(request.method==='GET'||request.method==='OPTIONS'||request.method==='POST'&&(['/login','/logout'].includes(url.pathname)||(url.pathname===uploadPath&&uploadRequests++===0)));
      if(permitted)await send('Fetch.continueRequest',{requestId});else {blocked.push({method:request.method,path:url.pathname});await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
    })().catch(()=>{failure='Browser request guard failed';});
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});

  await login(4,'/panel/book');await navigate(owned);await wait('document.querySelector(".file-manager-sidebar")','patient medical page');
  await locale('en');
  await evaluate('Array.from(document.querySelectorAll(".file-manager-menu button")).find(b=>b.textContent.trim()==='+JSON.stringify(baseline.request_title)+').click()');
  await wait('document.querySelector(".file-manager-content").textContent.includes('+JSON.stringify(baseline.request_title)+')','exact selected request');
  const list=await api('/api/reservations/'+baseline.reservation+'/medical-requests');
  const selected=list.data.data.find(r=>r.public_id===baseline.request);
  assert.equal(list.status,200);assert.equal(selected.status,'open');assert.equal(selected.attachment_rules.max_bytes_by_mime['application/pdf'],524288);assert.deepEqual(selected.attachment_rules.allowed_mime_types,['application/pdf']);
  assert.deepEqual(selected.upload_progress,{received_count:0,awaiting_checks_count:0});
  assert.equal(selected.attachment_rules.issued_revision,'dfff2af83387765d0c11d4cd296af23881f1303aee76ab9dd9196f942bb5cde4');
  await evaluate('Array.from(document.querySelectorAll(".file-manager-content button")).find(b=>b.textContent.trim()==='+JSON.stringify(copy.en['medical.uploadFile'])+').click()');
  await wait('document.querySelector("#medical-upload-file")','bounded upload modal');
  assert.ok(await evaluate('document.querySelector(".modal-content").textContent.includes("524,288")'));
  await evaluate('(()=>{const bytes=Uint8Array.from(atob('+JSON.stringify(fixture)+'),c=>c.charCodeAt(0));const input=document.querySelector("#medical-upload-file");const transfer=new DataTransfer();transfer.items.add(new File([bytes],"checkupino-synthetic-demo.pdf",{type:"application/pdf"}));input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await setValue('#medical-upload-label','Synthetic demo PDF');
  record('Fresh exact PDF policy, empty selected receipts and synthetic memory-only file verified before POST');
  phase='single-upload';
  await evaluate('document.querySelector(".modal-content form").requestSubmit()');
  await wait('!document.querySelector(".modal-content")&&document.querySelector(".file-manager-content")?.textContent.includes('+JSON.stringify(copy.en['medical.uploadReceived'])+')','ordinary upload acknowledgement');
  const response=responses.find(r=>r.path===uploadPath&&r.method==='POST');assert.ok(response);assert.equal(response.status,201);
  const responseBody=await send('Network.getResponseBody',{requestId:response.request_id});
  receipt=JSON.parse(responseBody.base64Encoded?Buffer.from(responseBody.body,'base64').toString():responseBody.body).data;
  assert.match(receipt.public_id,/^[0-9A-HJKMNP-TV-Z]{26}$/i);assert.notEqual(receipt.public_id.toUpperCase(),baseline.file.toUpperCase());
  assert.equal(receipt.available,false);assert.equal(receipt.mime_type,'application/pdf');assert.equal(receipt.size_bytes,fixtureBytes.length);
  assert.equal(uploadRequests,1);assert.equal(requests.filter(r=>r.method==='POST'&&r.path===uploadPath).length,1);
  await send('Page.reload');await wait('document.querySelector(".file-manager-sidebar")','receipt reload');
  const persisted=await api('/api/reservations/'+baseline.reservation+'/medical-requests');
  assert.deepEqual(persisted.data.data.find(r=>r.public_id===baseline.request).upload_progress,{received_count:1,awaiting_checks_count:1});
  record('One ordinary browser upload201, unavailable receipt and persisted receipt/awaiting-check counts');
  await locale('fa');assert.equal(await evaluate('document.documentElement.dir'),'rtl');record('Fresh patient read and Farsi remain available after upload');
  await logout();
  await login(5,'/panel/doctor/reservations');
  const doctor=await api('/api/doctor/reservations/'+baseline.reservation+'/medical-requests/'+baseline.request);
  assert.equal(doctor.status,200);assert.deepEqual(doctor.data.data.files,[]);assert.deepEqual(doctor.data.data.reports,[]);
  record('Queued upload remains unavailable to assigned doctor until actual checks');await logout();
  assert.equal(exceptions.length,0);assert.equal(external.length,0);assert.equal(blocked.length,0);
  finalState=snapshot();assert.deepEqual(finalState.counts,{requests:2,files:2,reports:0,jobs:1});assert.equal(finalState.scanning,true);
  assert.deepEqual(finalState.target_files,[{public_id:receipt.public_id,scan_status:'quarantined',size_bytes:fixtureBytes.length}]);
  assert.equal(finalState.original_file_hash,baseline.original_file_hash);
  for(const key of Object.keys(baseline.hashes)) if(!['reservation_files','jobs'].includes(key))assert.equal(finalState.hashes[key],baseline.hashes[key],'Unexpected mutation: '+key);
  assert.equal(failure,null);record('Exact one new quarantine/one dedicated job; requests, original audits, protected, settings, booking, payment and outbox preserved');

}catch(error){failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure}));}
finally{
  if(failure && ws?.readyState===WebSocket.OPEN){try{if(await evaluate(`!!document.querySelector('.topbar-user')`))await logout();}catch{checks.push('Failure cleanup could not acknowledge auth logout; isolated browser will close');}}
  writeFileSync(evidencePath,JSON.stringify({checked_at:new Date().toISOString(),acceptance:failure?'failed':'passed',phase,failure,checks,requests,responses,exceptions,external,blocked,receipt,synthetic_bytes:fixtureBytes.length,synthetic_sha256:createHash('sha256').update(fixtureBytes).digest('hex'),request_id:baseline.request,reservation_id:baseline.reservation,baseline:{counts:baseline.counts,hashes:baseline.hashes,original_file_hash:baseline.original_file_hash},final:finalState?{counts:finalState.counts,hashes:finalState.hashes,original_file_hash:finalState.original_file_hash}:null,scope:'One ordinary patient browser upload on the accepted synthetic request; no worker processing/review/report/booking mutation. Never replay after a POST or changed checkpoint.'},null,2)+'\n');
  if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}for(const item of pending.values())clearTimeout(item.timer);browser.kill();
  for(let i=0;i<50;i++){try{assert.equal(realpathSync(dirname(profile)),realpathSync(tmpdir()));assert.equal(realpathSync(profile),resolve(profile));assert.match(basename(profile),/^checkupino-medical-browser-[\w-]+$/);rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
}

