import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'No endpoint/account overrides accepted.');
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
 $m=$r->medicalRequests()->firstOrFail();
 $tables=['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events']; $hashes=[];
 foreach($tables as $table) $hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['protected']=hash('sha256',json_encode(App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));
 $hashes['existing_audits']=hash('sha256',json_encode(App\\Models\\AuditEvent::whereIn('id',[5,6,7,8])->orderBy('id')->get()->toArray(),JSON_THROW_ON_ERROR));
 echo json_encode(['reservation'=>$r->public_id,'request'=>$m->public_id,'request_title'=>$m->title,'request_status'=>$m->status->value,'scanning'=>config('medical.scanner.enabled'),'private_driver'=>config('filesystems.disks.private.driver'),
 'counts'=>['requests'=>DB::table('reservation_medical_requests')->count(),'files'=>DB::table('reservation_files')->count(),'reports'=>DB::table('reservation_reports')->count(),'jobs'=>DB::table('jobs')->count()],
 'accounts'=>collect([$r->user,$r->doctor->user,App\\Models\\User::with('roles')->findOrFail(3),App\\Models\\User::with('roles')->findOrFail(2),App\\Models\\User::with('roles')->findOrFail(1)])->map(fn($u)=>['id'=>$u->id,'email'=>$u->email,'roles'=>$u->roles->pluck('name')->all()])->all(),
 'hashes'=>$hashes],JSON_THROW_ON_ERROR);
} finally { DB::rollBack(); }
`;
  const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, 'Readonly synthetic fixture snapshot failed.');
  return JSON.parse(result.stdout);
};
const baseline = snapshot();
assert.equal(baseline.scanning, false); assert.equal(baseline.private_driver, 'local');
assert.deepEqual(baseline.counts, { requests: 2, files: 1, reports: 0, jobs: 0 });
assert.equal(baseline.request_status, 'open');
for (const actor of baseline.accounts) { assert.ok([1,2,3,4,5].includes(actor.id)); assert.match(actor.email, /@checkupino\.test$/); }
assert.match(baseline.request_title,/^Synthetic attachment acceptance checkupino-attachment-\d+$/);
const profile = mkdtempSync(join(tmpdir(), 'checkupino-medical-browser-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--incognito', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-sync', '--window-size=1440,1000', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const copy = Object.fromEntries(['en','fa'].map(lang => [lang, JSON.parse(readFileSync(`frontend/src/locales/${lang}.json`, 'utf8'))]));
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/patient-upload-browser-2026-10-11.json', import.meta.url));
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
    }else if(message.method==='Network.responseReceived'){const item=network.get(message.params.requestId);if(item)responses.push({...item,status:message.params.response.status});}
    else if(message.method==='Fetch.requestPaused')void(async()=>{
      const {requestId,request}=message.params;const url=new URL(request.url);
      const permitted=url.origin==='http://localhost:3000'&&request.method==='GET'||url.origin==='http://localhost:8080'&&(request.method==='GET'||request.method==='OPTIONS'||request.method==='POST'&&['/login','/logout'].includes(url.pathname));
      if(permitted)await send('Fetch.continueRequest',{requestId});else {blocked.push({method:request.method,path:url.pathname});await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
    })().catch(()=>{failure='Browser request guard failed';});
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await navigate(owned);await wait(`location.pathname==='/panel/login'&&document.querySelector('#email')`,'guest denial');record('Guest medical deep link redirects to login');
  await login(4,'/panel/book');await navigate('/panel/my/reservations');await wait(`document.querySelector('a[href=${JSON.stringify(owned)}]')`,'patient table entry');await click(`a[href=${JSON.stringify(owned)}]`);
  await wait(`document.querySelector('.file-manager-sidebar')`,'patient medical request');
  await evaluate(`Array.from(document.querySelectorAll('.file-manager-menu button')).find(b=>b.textContent.trim()===${JSON.stringify(baseline.request_title)}).click()`);
  for(const lang of ['en','fa']){await locale(lang);const content=await text();for(const key of ['title','attachmentRules','outcomePending'])assert.ok(content.includes(copy[lang]['medical.'+key]));assert.ok(content.includes('application/pdf'));assert.ok(content.includes(new Intl.NumberFormat(lang).format(1048576)));}
  const patientList = await api('/api/reservations/'+baseline.reservation+'/medical-requests');
  assert.equal(patientList.status,200);
  assert.equal(patientList.data.data.find(r=>r.public_id===baseline.request).upload_progress.received_count,1);
  assert.equal(patientList.data.data.find(r=>r.public_id===baseline.request).upload_progress.awaiting_checks_count,1);
  for(const lang of ['en','fa']){
    await locale(lang);
    assert.ok((await text()).includes(copy[lang]['medical.receivedCount'].replace('{{amount}}',new Intl.NumberFormat(lang).format(1))));
    assert.ok((await text()).includes(copy[lang]['medical.awaitingChecksCount'].replace('{{amount}}',new Intl.NumberFormat(lang).format(1))));
    await evaluate('Array.from(document.querySelectorAll(".file-manager-content button")).find(b=>b.textContent.trim()==='+JSON.stringify(copy[lang]['medical.uploadFile'])+').click()');
    await wait('document.querySelector("#medical-upload-file")','upload modal');
    assert.equal(await evaluate('document.querySelector("#medical-upload-file").accept'),'application/pdf,.pdf');
    assert.ok(await evaluate('document.querySelector(".modal-content").textContent.includes('+JSON.stringify(copy[lang]['medical.uploadPdfLimit'].replace('{{bytes}}',new Intl.NumberFormat(lang).format(1048576)))+')'));
    await evaluate('(()=>{const input=document.querySelector("#medical-upload-file");const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(1048577)],"synthetic-oversize.pdf",{type:"application/pdf"}));input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));})()');
    await evaluate('document.querySelector(".modal-content form").requestSubmit()');
    await wait('document.querySelector(".modal-content").textContent.includes('+JSON.stringify(copy[lang]['medical.invalidUpload'])+')','oversize refusal');
    assert.equal(requests.filter(r=>r.method==='POST'&&r.path.includes('medical-requests')).length,0);
    await evaluate('Array.from(document.querySelectorAll(".modal-body button")).find(b=>b.textContent.trim()==='+JSON.stringify(copy[lang]['medical.close'])+').click()');
    await wait('!document.querySelector(".modal-content")','upload modal close');
    record('Patient '+lang+' actual receipt/pending counts, upload modal/exact limit and oversize refusal without medical POST');
  }
  assert.equal(await evaluate(`document.querySelectorAll('.file-manager-content tbody tr').length`),0);record('Owner patient entry: actual open request/exact1MiB PDF rules/pending outcome, EN-FA/flag direction; no quarantine exposure');
  await send('Page.reload');await wait(`document.querySelector('.file-manager-sidebar')`,'patient refresh');record('Patient medical deep-link refresh and locale persistence');
  assert.equal((await api(`/api/reservations/${baseline.reservation}/medical-requests/${baseline.request}/outcome`)).status,404);assert.equal((await api(`/api/doctor/reservations/${baseline.reservation}/medical-requests`)).status,403);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')===${JSON.stringify(copy.fa['medical.requests'])}).click()`);
  await wait(`document.querySelector('.file-manager-sidebar.menubar-show')`,'mobile sidebar');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.file-manager-sidebar')).visibility`),'visible');
  await evaluate(`document.querySelector('.file-manager-sidebar button').click()`);assert.equal(await evaluate(`!!document.querySelector('.menubar-show')`),false);
  await send('Emulation.clearDeviceMetricsOverride');record('Retained mobile sidebar open/close works; patient publication and doctor API gates reject');await logout();
  await login(5,'/panel/doctor/reservations');await wait(`document.querySelector('a[href=${JSON.stringify(assigned)}]')`,'assigned doctor table entry');await click(`a[href=${JSON.stringify(assigned)}]`);await wait(`document.querySelector('.page-content').textContent.includes(${JSON.stringify(copy.fa['medical.noEligibleFiles'])})`,'assigned doctor detail');
  const doctorList=await api('/api/doctor/reservations/'+baseline.reservation+'/medical-requests');assert.equal(doctorList.status,200);assert.ok(doctorList.data.data.every(r=>!Object.hasOwn(r,'upload_progress')));assert.equal(await evaluate('Array.from(document.querySelectorAll(".file-manager-content button")).some(b=>b.textContent.trim()==='+JSON.stringify(copy.fa['medical.uploadFile'])+')'),false);
  const detail=await api(`/api/doctor/reservations/${baseline.reservation}/medical-requests/${baseline.request}`);assert.equal(detail.status,200);assert.deepEqual(detail.data.data.files,[]);assert.deepEqual(detail.data.data.reports,[]);
  await locale('en');assert.ok((await text()).includes(copy.en['medical.noEligibleFiles']));await locale('fa');await send('Page.reload');await wait(`document.querySelector('.file-manager-sidebar')`,'doctor refresh');record('Assigned doctor entry/read/EN-FA/refresh: open request, no eligible files or invented reports');await logout();
  await login(3,'/panel/doctor/reservations');await navigate(assigned);await wait(`document.querySelector('[role="alert"]')`,'unassigned doctor rejection');assert.equal(await evaluate(`!!document.querySelector('.file-manager-sidebar')`),false);assert.equal((await api(`/api/doctor/reservations/${baseline.reservation}/medical-requests`)).status,404);record('Unassigned doctor actual404 has no request/file/report content');await logout();
  for(const id of [2,1]){await login(id,'/panel/');await navigate(owned);await wait(`/^\\/panel\\/?$/.test(location.pathname)&&document.querySelector('.topbar-user')`,'admin role denial');await navigate(assigned);await wait(`/^\\/panel\\/?$/.test(location.pathname)&&document.querySelector('.topbar-user')`,'admin doctor-route denial');assert.equal((await api(`/api/doctor/reservations/${baseline.reservation}/medical-requests`)).status,403);record((id===1?'Root':'Admin')+' medical routes denied and doctor API403');await logout();}
  assert.equal(exceptions.length,0,'Uncaught browser exception.');assert.equal(external.length,0,'External page request.');assert.equal(blocked.length,0,'Unexpected write/external request blocked.');
  assert.equal(requests.filter(r=>!['GET','OPTIONS'].includes(r.method)&&!['/login','/logout'].includes(r.path)).length,0,'Read-only scope violated.');
  assert.equal(requests.filter(r=>r.method==='OPTIONS'&&r.path.includes('medical-requests')).length,0,'Medical GET preflight.');
  const keys=await evaluate('Object.keys(localStorage).concat(Object.keys(sessionStorage))');assert.ok(!keys.some(k=>/token|password|authuser/i.test(k)),'Credential browser storage.');
  finalState=snapshot();assert.deepEqual(finalState.hashes,baseline.hashes);assert.deepEqual(finalState.counts,baseline.counts);assert.equal(finalState.scanning,false);assert.equal(failure,null);record('No medical writes, stored credentials, external HTTP, read preflights or exceptions; history/protected/integrity-state fingerprints preserved');
}catch(error){failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure}));}
finally{
  if(failure && ws?.readyState===WebSocket.OPEN){try{if(await evaluate(`!!document.querySelector('.topbar-user')`))await logout();}catch{checks.push('Failure cleanup could not acknowledge auth logout; isolated browser will close');}}
  writeFileSync(evidencePath,JSON.stringify({checked_at:new Date().toISOString(),acceptance:failure?'failed':'passed',phase,failure,checks,requests,responses,exceptions,external,blocked,baseline:{counts:baseline.counts,hashes:baseline.hashes},final:finalState?{counts:finalState.counts,hashes:finalState.hashes}:null,scope:'Actual served patient upload/progress controls and refusal-only browser/API acceptance on synthetic existing reservation; only ordinary auth login/logout writes. No upload/scan/review/report mutation, worker or clinical completion. Report presentation remains isolated source evidence.'},null,2)+'\n');
  if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}for(const item of pending.values())clearTimeout(item.timer);browser.kill();
  for(let i=0;i<50;i++){try{assert.equal(realpathSync(dirname(profile)),realpathSync(tmpdir()));assert.equal(realpathSync(profile),resolve(profile));assert.match(basename(profile),/^checkupino-medical-browser-[\w-]+$/);rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
}
