import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'No endpoint/account overrides accepted.');
assert.ok(!existsSync('docs/deployment/evidence/demo-appointment-completed-final-2026-10-11.json'),'Evidence exists; inspect it instead of overwriting.');

// Existing synthetic demo credentials stay in memory. Protected users never log in.
const password = readFileSync('.env', 'utf8').match(/^DEMO_SEED_PASSWORD=(.*)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
assert.ok(password, 'Configured demo password required.');
const snapshot = () => {
 const php = `<?php
require '/var/www/vendor/autoload.php';$app=require '/var/www/bootstrap/app.php';$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Illuminate\\Support\\Facades\\DB;
DB::statement('SET TRANSACTION READ ONLY');DB::beginTransaction();
try {
 $r=App\\Models\\Reservation::with(['user.roles','doctor.user.roles','payment.successfulAttempt'])->findOrFail(8);
 $tables=['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events','audit_events','questionnaire_submissions','leads'];$hashes=[];
 foreach($tables as $table)$hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $stable=$r->getAttributes();unset($stable['status'],$stable['completed_at'],$stable['updated_at']);$hashes['target_stable']=hash('sha256',json_encode($stable,JSON_THROW_ON_ERROR));
 $hashes['other_reservations']=hash('sha256',json_encode(DB::table('reservations')->where('id','!=',8)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $auditRecords=DB::table('audit_events')->orderBy('id')->get()->map(fn($a)=>['id'=>$a->id,'actor_user_id'=>$a->actor_user_id,'action'=>$a->action,'subject_public_id'=>$a->subject_public_id,'sha256'=>hash('sha256',json_encode($a,JSON_THROW_ON_ERROR))]);
 $outboxRecords=DB::table('outbox_events')->orderBy('id')->get()->map(fn($o)=>['id'=>$o->id,'event_type'=>$o->event_type,'subject_public_id'=>$o->subject_public_id,'payload'=>json_decode($o->payload,true,512,JSON_THROW_ON_ERROR),'sha256'=>hash('sha256',json_encode($o,JSON_THROW_ON_ERROR))]);
 $hashes['protected']=hash('sha256',json_encode(App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));
 echo json_encode(['reservation'=>$r->public_id,'status'=>$r->status->value,'completed_at'=>$r->completed_at?->toISOString(),'audits'=>$auditRecords,'outbox'=>$outboxRecords,'starts_at'=>$r->starts_at->toISOString(),'now'=>now()->toISOString(),'can_complete'=>app(App\\Services\\ReservationLifecycleService::class)->canComplete($r),'hashes'=>$hashes,'accounts'=>collect([$r->user,$r->doctor->user,App\\Models\\User::with('roles')->findOrFail(3)])->map(fn($u)=>['id'=>$u->id,'public_id'=>$u->public_id,'email'=>$u->email])->all()],JSON_THROW_ON_ERROR);
}finally{DB::rollBack();}
`;
 const result=spawnSync('docker',['exec','-i','--user','www-data','checkupino_app','php'],{input:php,encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(result.status,0,'Read-only fixture inspection failed.');return JSON.parse(result.stdout);
};
const excluded=JSON.parse(readFileSync('docs/deployment/evidence/demo-appointment-completed-2026-10-11.json','utf8'));assert.equal(excluded.acceptance,'failed');assert.equal(excluded.delivered,false);assert.equal(excluded.requests.filter(r=>!['GET','OPTIONS'].includes(r.method)&&!['/login','/logout'].includes(r.path)).length,0);
const baseline=snapshot();
assert.deepEqual(baseline.hashes,excluded.baseline.hashes,'Failed preflight must preserve every fingerprint.');
assert.equal(baseline.status,'confirmed');assert.equal(baseline.can_complete,true,'Fresh server eligibility required.');
assert.ok(Date.parse(baseline.now)>=Date.parse(baseline.starts_at));
const previous=JSON.parse(readFileSync('docs/deployment/evidence/demo-appointment-refusal-2026-10-11.json','utf8'));assert.equal(previous.acceptance,'passed');for(const key of Object.keys(previous.final.hashes))assert.equal(baseline.hashes[key],previous.final.hashes[key],'Unchanged accepted history required: '+key);
for(const actor of baseline.accounts){assert.ok([3,4,5].includes(actor.id));assert.match(actor.email,/@checkupino\.test$/);}
const profile = mkdtempSync(join(tmpdir(), 'checkupino-medical-browser-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--incognito', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-sync', '--window-size=1440,1000', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const copy = Object.fromEntries(['en','fa'].map(lang => [lang, JSON.parse(readFileSync(`frontend/src/locales/${lang}.json`, 'utf8'))]));
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/demo-appointment-completed-final-2026-10-11.json', import.meta.url));
const pending = new Map(), network = new Map(), requests = [], responses = [], exceptions = [], external = [], checks = [], blocked = [];
let ws, sequence = 0, phase = 'setup', failure = null, finalState = null, allowCompletion=false, delivered=false;
writeFileSync(evidencePath,JSON.stringify({acceptance:'started',checked_at:new Date().toISOString(),baseline,scope:'One ordinary reservation8 completion; never replay after start.'},null,2)+'\n',{flag:'wx'});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: '+method)); }, 30000);
  pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
const wait = async (expression, label) => { const deadline = Date.now()+35000; while(Date.now()<deadline) { if(await evaluate(`Boolean(${expression})`)) return; await delay(100); } throw new Error('Browser timeout: '+label); };
const navigate = path => send('Page.navigate', { url: 'http://localhost:3000'+path });
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const setValue = (selector, value) => evaluate(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const api = path => evaluate(`fetch('http://localhost:8080'+${JSON.stringify(path)},{credentials:'include',headers:{Accept:'application/json'}}).then(async r=>({status:r.status,data:await r.json()}))`);
const record = name => { checks.push(name); console.log(JSON.stringify({ check: name, passed: true })); };
const text = () => evaluate(`document.querySelector('.page-content')?.textContent || ''`);
const locale = async lang => {
  if(await evaluate('document.documentElement.lang!=='+JSON.stringify(lang))){
    await click('.header-item:has(.language) > button');
    await evaluate('Array.from(document.querySelectorAll(".language .dropdown-item")).find(x=>x.textContent.trim()==='+JSON.stringify(lang==='en'?'English':'\u0641\u0627\u0631\u0633\u06cc')+').click()');
  }
  await wait('document.documentElement.lang==='+JSON.stringify(lang),'locale');
  assert.equal(await evaluate('document.documentElement.dir'),lang==='fa'?'rtl':'ltr');
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
      let permitted=url.origin==='http://localhost:3000'&&request.method==='GET'||url.origin==='http://localhost:8080'&&(request.method==='GET'||request.method==='OPTIONS'||request.method==='POST'&&['/login','/logout'].includes(url.pathname));
      if(!permitted&&allowCompletion&&!delivered&&phase==='completion'&&url.origin==='http://localhost:8080'&&request.method==='POST'&&url.pathname==='/api/doctor/reservations/8/complete'){
        assert.ok(!request.postData,'Completion must send no trusted body fields.');delivered=true;allowCompletion=false;permitted=true;
      }
      if(permitted)await send('Fetch.continueRequest',{requestId});else {blocked.push({method:request.method,path:url.pathname});await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
    })().catch(()=>{failure='Browser request guard failed';});
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});





  await login(5,'/panel/doctor/reservations');await locale('en');
  const anchorSelector='a[href*="'+baseline.reservation+'"]';
  const row='Array.from(document.querySelectorAll(".page-content tr")).find(r=>r.querySelector('+JSON.stringify(anchorSelector)+'))';
  const action=()=>row+'?.querySelector("button")';
  await wait(action('en')+'&&!'+action('en')+'?.disabled','eligible assigned row action');
  assert.equal(await evaluate(action('en')+'.textContent.trim()'),copy.en['booking.completeAppointment']);
  await locale('fa');assert.equal(await evaluate(action('fa')+'.textContent.trim()'),copy.fa['booking.completeAppointment']);record('Eligible doctor action EN/FA');
  await locale('en');await evaluate(action('en')+'.click()');
  const confirm='Array.from(document.querySelectorAll(".modal-content button")).find(b=>b.textContent.trim()==='+JSON.stringify(copy.en['booking.confirmCompletion'])+')';
  await wait(confirm+'&&!'+confirm+'.disabled','fresh eligible confirmation');
  assert.ok((await evaluate('document.querySelector(".modal-content").textContent')).includes(copy.en['booking.completeConfirm']));
  assert.ok(requests.some(r=>r.method==='GET'&&r.path==='/api/doctor/reservations/8'));record('Existing modal and fresh detail before explicit confirmation');
  phase='completion';allowCompletion=true;await evaluate(confirm+'.click()');
  await wait('!document.querySelector(".modal-content")&&document.querySelector(".page-content")?.textContent.includes('+JSON.stringify(copy.en['booking.appointmentCompleted'])+')','ordinary completed acknowledgement');
  assert.equal(delivered,true);await wait(row+'?.textContent.includes('+JSON.stringify(copy.en['booking.state.completed'])+')','refreshed completed doctor row');
  const receipt=await api('/api/doctor/reservations/8');assert.equal(receipt.status,200);assert.equal(receipt.data.data.status,'completed');assert.equal(receipt.data.data.can_complete,false);assert.equal(receipt.data.data.payment.status,'paid');
  record('One ordinary completed/paid receipt and refreshed doctor list');
  await send('Page.reload');await wait('document.querySelector(".page-content table")','doctor refresh');
  await locale('fa');assert.ok((await evaluate(row+'.textContent')).includes(copy.fa['booking.state.completed']));record('Doctor completed EN/FA and refresh');
  await logout();await login(4,'/panel/book');await navigate('/panel/my/reservations');await wait('document.querySelector(".page-content table")','patient reservations');
  for(const lang of ['en','fa']){await locale(lang);assert.ok((await evaluate(row+'.textContent')).includes(copy[lang]['booking.state.completed']));assert.equal(await evaluate(row+'.querySelectorAll("button").length'),0);record('Patient completed/paid display '+lang);}
  await send('Page.reload');await wait('document.querySelector(".page-content table")','patient refresh');record('Patient completed refresh');await logout();
  await login(3,'/panel/doctor/reservations');assert.equal((await api('/api/doctor/reservations/8')).status,404);record('Unassigned doctor denied completed reservation');await logout();
  finalState=snapshot();assert.equal(finalState.status,'completed');assert.equal(finalState.can_complete,false);assert.ok(Date.parse(finalState.completed_at)>=Date.parse(finalState.starts_at));
  for(const key of Object.keys(baseline.hashes))if(!['reservations','audit_events','outbox_events'].includes(key))assert.equal(finalState.hashes[key],baseline.hashes[key],'Unrelated history changed: '+key);
  const newAudits=finalState.audits.filter(a=>!baseline.audits.some(old=>old.id===a.id));assert.equal(newAudits.length,1);assert.equal(newAudits[0].action,'reservation.completed');assert.equal(newAudits[0].actor_user_id,5);assert.equal(newAudits[0].subject_public_id,baseline.reservation);
  for(const old of baseline.audits)assert.deepEqual(finalState.audits.find(a=>a.id===old.id),old);
  const newOutbox=finalState.outbox.filter(o=>!baseline.outbox.some(old=>old.id===o.id));assert.equal(newOutbox.length,2);assert.deepEqual(newOutbox.map(o=>o.event_type).sort(),['rating.requested','reservation.completed']);
  for(const old of baseline.outbox)assert.deepEqual(finalState.outbox.find(o=>o.id===old.id),old);
  for(const item of newOutbox){assert.equal(item.subject_public_id,baseline.reservation);assert.equal(item.payload.reservation_public_id,baseline.reservation);assert.equal(item.payload.occurred_at,finalState.completed_at);}
  assert.equal(newOutbox.find(o=>o.event_type==='reservation.completed').payload.actor_public_id,baseline.accounts.find(a=>a.id===5).public_id);
  assert.equal(newOutbox.find(o=>o.event_type==='rating.requested').payload.patient_public_id,baseline.accounts.find(a=>a.id===4).public_id);
  assert.equal(exceptions.length,0);assert.equal(external.length,0);assert.equal(blocked.length,0);
  assert.equal(requests.filter(r=>r.method==='POST'&&r.path==='/api/doctor/reservations/8/complete').length,1);
  assert.ok(responses.some(r=>r.method==='POST'&&r.path==='/api/doctor/reservations/8/complete'&&r.status===200));
  assert.ok(requests.filter(r=>r.phase==='completion'&&r.method==='GET'&&r.path==='/api/doctor/reservations/8').length>=1);
  record('One audit/two lifecycle intents; payment/medical/questionnaire/original/protected/unrelated fingerprints preserved; no job consumed');
}catch(error){failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure}));}
finally{
 if(failure&&ws?.readyState===WebSocket.OPEN){try{if(await evaluate("!!document.querySelector('.topbar-user')"))await logout();}catch{}}
 writeFileSync(evidencePath,JSON.stringify({checked_at:new Date().toISOString(),acceptance:failure?'failed':'passed',phase,failure,checks,requests,responses,exceptions,external,blocked,delivered,baseline,final:finalState,scope:'One actual ordinary assigned-doctor reservation8 completion with fresh explicit confirmation; immutable audit/outbox/payment/medical/questionnaire/protected checks and EN/FA role/refresh. No scan, scheduler, upload or notification consumption. Never replay.'},null,2)+'\n');
 if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}for(const item of pending.values())clearTimeout(item.timer);browser.kill();
 for(let i=0;i<50;i++){try{assert.equal(realpathSync(dirname(profile)),realpathSync(tmpdir()));assert.equal(realpathSync(profile),resolve(profile));assert.match(basename(profile),/^checkupino-medical-browser-[\w-]+$/);rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
}





