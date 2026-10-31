import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'No endpoint/account overrides accepted.');
assert.ok(!existsSync('docs/deployment/evidence/admin-schedule-controls-ready-browser-2026-10-15.json'),'Evidence exists; inspect it instead of overwriting.');

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
 echo json_encode(['request_title'=>App\\Models\\ReservationMedicalRequest::where('public_id','01m4hfgan168p6q5ftp528285f')->value('title'),'reservation'=>$r->public_id,'status'=>$r->status->value,'completed_at'=>$r->completed_at?->toISOString(),'audits'=>$auditRecords,'outbox'=>$outboxRecords,'starts_at'=>$r->starts_at->toISOString(),'now'=>now()->toISOString(),'can_complete'=>app(App\\Services\\ReservationLifecycleService::class)->canComplete($r),'hashes'=>$hashes,'accounts'=>collect([$r->user,$r->doctor->user,App\\Models\\User::with('roles')->findOrFail(3),App\\Models\\User::with('roles')->findOrFail(2),App\\Models\\User::with('roles')->findOrFail(1)])->map(fn($u)=>['id'=>$u->id,'public_id'=>$u->public_id,'email'=>$u->email,'roles'=>$u->roles->pluck('name')->all()])->all()],JSON_THROW_ON_ERROR);
}finally{DB::rollBack();}
`;
 const result=spawnSync('docker',['exec','-i','--user','www-data','checkupino_app','php'],{input:php,encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(result.status,0,'Read-only fixture inspection failed.');return JSON.parse(result.stdout);
};
const baseline=snapshot();assert.equal(baseline.status,'completed');assert.equal(baseline.can_complete,false);
const previous=JSON.parse(readFileSync('docs/deployment/evidence/demo-appointment-completed-final-2026-10-11.json','utf8'));assert.equal(previous.acceptance,'passed');assert.deepEqual(baseline.hashes,previous.final.hashes);
for(const actor of baseline.accounts){assert.ok([1,2,3,4,5].includes(actor.id));assert.match(actor.email,/@checkupino\.test$/);}
assert.ok(baseline.accounts.find(a => a.id === 2)?.roles.includes('admin'));
assert.ok(baseline.accounts.find(a => a.id === 1)?.roles.includes('root-admin'));
const staticProof = JSON.parse(readFileSync('docs/deployment/evidence/admin-schedule-controls-ready-static-2026-10-15.json','utf8'));
assert.equal(staticProof.acceptance,'passed');
assert.equal(JSON.parse(spawnSync('docker',['inspect','--format','{{json .Image}}','checkupino_prod-admin-1'],{encoding:'utf8',windowsHide:true,timeout:10000}).stdout),staticProof.image);
const profile = mkdtempSync(join(tmpdir(), 'checkupino-admin-medical-questionnaire-browser-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--incognito', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-sync', '--window-size=1440,1000', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const copy = Object.fromEntries(['en','fa'].map(lang => [lang, JSON.parse(readFileSync(`frontend/src/locales/${lang}.json`, 'utf8'))]));
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/admin-schedule-controls-ready-browser-2026-10-15.json', import.meta.url));
const pending = new Map(), network = new Map(), requests = [], responses = [], exceptions = [], external = [], checks = [], blocked = [];
let ws, sequence = 0, phase = 'setup', failure = null, finalState = null;
const verificationRun=Date.now();
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
const api = path => evaluate(`fetch('http://localhost:8080'+${JSON.stringify(path)},{credentials:'include',headers:{Accept:'application/json'}}).then(async r=>({status:r.status,cache:r.headers.get('Cache-Control'),data:await r.json()}))`);
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
      if (url.origin==='http://localhost:8080' && url.pathname.endsWith('/download')) permitted=false;
      if(permitted)await send('Fetch.continueRequest',{requestId});else {blocked.push({method:request.method,path:url.pathname});await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
    })().catch(()=>{failure='Browser request guard failed';});
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});







  const waitList = () => wait('document.querySelector(".page-content table tbody tr a[href^=\'/panel/reservations/8?\']")', 'target reservation row');
  const byText = (label) => 'Array.from(document.querySelectorAll(".page-content button")).find(b => b.textContent.trim()==='+JSON.stringify(label)+'&&!b.disabled)';
  const clickText = label => evaluate(byText(label)+'.click()');
  for (const id of [2,1]) {
    await login(id,'/panel/'); await locale('en');
    const link='a[href="/panel/reservations"]';
    await wait('document.querySelector('+JSON.stringify(link)+')','admin navigation');
    await click(link); await wait('location.pathname==="/panel/reservations"','admin list navigation');
    await navigate('/panel/reservations?q=8'); await waitList();
    const result=await api('/api/admin/reservations?q=8&doctor_id=2&user_id=4&workplace_id=3&checkup_id=5&status=completed&payment_status=paid&from=2026-10-11&to=2026-10-11');
    assert.equal(result.status,200);assert.equal(result.data.data.length,1);assert.equal(result.data.data[0].id,8);
    assert.equal(result.data.data[0].booked_amount,7000000);assert.equal(result.data.data[0].doctor.id,2);assert.equal(result.data.data[0].doctor.user_id,5);
    assert.equal(result.data.data[0].patient.id,4);
    const upcoming=await api('/api/admin/reservations?period=upcoming');
    assert.equal(upcoming.status,200);assert.ok(upcoming.data.meta.generated_at);
    assert.ok(upcoming.data.data.every(r=>['pending','confirmed'].includes(r.status)&&Date.parse(r.starts_at)>=Date.parse(upcoming.data.meta.generated_at)));
    assert.equal((await api('/api/admin/reservations?from=2026-10-13&to=2026-10-11')).status,422);
    record('Admin '+id+' reservation filters/clock/snapshot plus medical clinical reads and questionnaire ownership/history contracts');

    // Dedicated administrative reads; all clinical mutations and downloads remain blocked.
    const medPath='/panel/medical-requests?doctor_id=2&user_id=4';
    await navigate(medPath);
    await wait('Array.from(document.querySelectorAll(".page-content a")).some(a=>a.getAttribute("href")?.startsWith("/panel/medical-requests/01m4hfgan168p6q5ftp528285f?"))','medical request list');
    assert.ok((await text()).includes(copy.en['adminManage.progressHint']));
    const med=await api('/api/admin/medical-requests?doctor_id=2&user_id=4&reservation_id=8');
    assert.equal(med.status,200);assert.equal(med.data.data.length,2);
    const completed=med.data.data.find(row=>row.public_id==='01m4hfgan168p6q5ftp528285f');
    const original=med.data.data.find(row=>row.public_id==='01m4dn9fq2d38xxrh4wtkyf6s4');
    assert.equal(completed.eligible_count,1);assert.equal(completed.published_count,2);
    assert.equal(original.awaiting_checks_count,1);assert.equal(original.eligible_count,0);
    assert.equal((await api('/api/admin/medical-requests?doctor_id[]=2')).status,422);
    const history=await api('/api/admin/medical-requests/'+completed.public_id);
    assert.match(history.cache,/no-store/);
    assert.equal(history.status,200);assert.equal(history.data.data.files.length,1);assert.equal(history.data.data.reports.length,2);
    assert.ok(history.data.data.reports.every(row=>row.body_format==='plain_text'&&row.status==='published'&&!row.can_manage));
    assert.ok(!JSON.stringify(history.data.data).includes('checksum_sha256'));
    const defs=await api('/api/admin/questionnaires');assert.equal(defs.status,200);
    const def=defs.data.data.find(row=>row.slug==='demo-heart-health-screen');assert.ok(def&&def.version===1);
    const saved=await api('/api/admin/questionnaire-submissions?user_id=4&questionnaire_id='+def.id+'&version=1&owner_type=account&score_min=2&score_max=2');
    assert.equal(saved.status,200);assert.equal(saved.data.data.length,1);
    const receipt=saved.data.data[0];assert.equal(receipt.user_id,4);assert.equal(receipt.questionnaire_version,1);
    assert.ok(!('answers' in receipt)&&!('guest_token_hash' in receipt));
    const savedDetail=await api('/api/admin/questionnaire-submissions/by-public-id/'+receipt.public_id);
    assert.match(savedDetail.cache,/no-store/);
    assert.equal(savedDetail.status,200);assert.equal(savedDetail.data.data.answers_available,true);assert.equal(savedDetail.data.data.answers.length,3);
    assert.equal((await api('/api/admin/questionnaire-submissions?score_min=3&score_max=2')).status,422);
    for (const lang of ['en','fa']) {
      await locale(lang);
      await navigate('/panel/medical-requests/'+completed.public_id);
      await wait('Array.from(document.querySelectorAll(".page-content a")).some(a=>a.textContent.trim()==='+JSON.stringify(copy[lang]['medical.download'])+')','eligible download link');
      for(const report of history.data.data.reports)assert.ok((await text()).includes(report.body));
      assert.ok((await text()).includes(copy[lang]['adminManage.authorship']));
      assert.equal(await evaluate('Array.from(document.querySelectorAll(".page-content button")).some(b=>b.textContent.trim()==='+JSON.stringify(copy[lang]['medical.confirmPublication'])+')'),false);
      await send('Page.reload');await wait('Array.from(document.querySelectorAll(".page-content a")).some(a=>a.textContent.trim()==='+JSON.stringify(copy[lang]['medical.download'])+')','clinical refresh');
      await navigate('/panel/questionnaires/'+def.id);
      await wait('document.querySelectorAll("[data-questionnaire-rich-text] .ck-editor__editable[contenteditable=true]").length===4','governed editor');
      assert.ok((await text()).includes(copy[lang]['adminManage.addQuestion']));
      await clickText(copy[lang]['adminManage.archive']);
      await wait('document.querySelector("dialog[open]")','reason confirmation');
      assert.equal(await evaluate('document.querySelector("dialog button[type=submit]").disabled'),true);
      await evaluate('Array.from(document.querySelectorAll("dialog button")).find(b=>b.textContent.trim()==='+JSON.stringify(copy[lang]['adminManage.close'])+').click()');
      await wait('!document.querySelector("dialog[open]")','cancel confirmation');
      await navigate('/panel/questionnaire-submissions/'+receipt.public_id);
      await wait('document.querySelectorAll("[data-questionnaire-answer]").length===3','saved answers');
      assert.equal(await evaluate('document.querySelectorAll("[data-questionnaire-answer]").length'),3);
      assert.ok((await text()).includes(copy[lang]['adminManage.snapshotNotice']));
      await send('Page.reload');await wait('document.querySelectorAll("[data-questionnaire-answer]").length===3','submission refresh');
      if(id===2){
        const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
        const path=fileURLToPath(new URL('../../docs/deployment/evidence/admin-activity-panel-retained-'+lang+'-'+verificationRun+'-2026-10-13.png',import.meta.url));
        assert.ok(!existsSync(path));writeFileSync(path,Buffer.from(screenshot.data,'base64'),{flag:'wx'});
      }
    }
    await locale('en');await navigate('/panel/reservations?q=8');await waitList();

    for(const lang of ['en','fa']) {
      await locale(lang); await waitList();const body=await text();
      assert.ok(body.includes(copy[lang]['adminReservations.bookedAmount']));
      assert.ok(body.includes(copy[lang]['adminReservations.filter.doctor_id']));
      assert.ok(body.includes(copy[lang]['adminReservations.quick.upcoming']));
      const refreshCount=responses.filter(r=>r.path==='/api/admin/reservations'&&r.status===200).length;
      await clickText(copy[lang]['adminReservations.refresh']);
      const refreshDeadline=Date.now()+30000;
      while(responses.filter(r=>r.path==='/api/admin/reservations'&&r.status===200).length===refreshCount){assert.ok(Date.now()<refreshDeadline,'List refresh acknowledgement missing');await delay(100);}
      await wait('!'+byText(copy[lang]['adminReservations.refresh'])+'?.disabled','refresh completed');await waitList();
      await evaluate('document.querySelector(".page-content a[href^=\'/panel/reservations/8?\']").focus()');
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await wait('location.pathname==="/panel/reservations/8"&&document.querySelector(".page-content dl")','numeric detail via keyboard');
      assert.ok((await text()).includes(baseline.reservation));
      assert.equal(await evaluate('document.querySelectorAll(".page-content section.card[aria-labelledby]").length'),6);
      for (const key of ['appointment','payment','patient','doctor','workplace','timeline']) {
        assert.equal(await evaluate('document.querySelector('+JSON.stringify('#reservation-'+key)+').textContent.trim()'),copy[lang]['adminReservations.box.'+key]);
      }
      if(id===2){
        const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
        const imagePath=fileURLToPath(new URL('../../docs/deployment/evidence/admin-activity-panel-retained-'+lang+'-'+verificationRun+'-2026-10-13.png',import.meta.url));
        if(!existsSync(imagePath))writeFileSync(imagePath,Buffer.from(image.data,'base64'),{flag:'wx'});
      }
      assert.ok((await text()).includes(copy[lang]['adminReservations.completedAt']));
      assert.equal(await evaluate('!!document.querySelector(".page-content a[href=\'/panel/reservations?doctor_id=2\']")'),true);
      await send('Page.reload');await wait('document.querySelector(".page-content dl")','detail refresh');
      assert.ok((await text()).includes(baseline.reservation));
      await click('.page-content a[href^="/panel/reservations?page="]');await waitList();
      assert.equal(await evaluate('new URLSearchParams(location.search).get("q")'),'8');
      record('Admin '+id+' '+lang+' reservation/medical/questionnaire reads, confirmation cancellation, ENFA/keyboard/refresh');
    }
    await locale('en');
    await clickText(copy.en['adminReservations.quick.completed']); await waitList();
    assert.equal(await evaluate('new URLSearchParams(location.search).get("status")'),'completed');
    await clickText(copy.en['adminReservations.quick.upcoming']);
    await wait('new URLSearchParams(location.search).get("period")==="upcoming"&&!document.querySelector(".page-content table")','upcoming excludes completed target');
    assert.equal(await evaluate('new URLSearchParams(location.search).has("status")'),false);
    await clickText(copy.en['adminReservations.reset']);await wait('!new URLSearchParams(location.search).has("period")','reset');
    await navigate('/panel/reservations?q=8&doctor_id=2&user_id=4');await waitList();
    await send('Page.reload');await waitList();assert.equal(await evaluate('new URLSearchParams(location.search).get("user_id")'),'4');
    await locale('fa');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
    assert.equal(await evaluate('document.documentElement.dir'),'rtl');
    await send('Emulation.clearDeviceMetricsOverride');
    record('Admin '+id+' quick presets/reset/composed refresh/mobile RTL');
    await navigate('/panel/reservations/not-a-number');
    await wait('document.querySelector(".page-content [role=alert]")','malformed detail refusal');
    assert.ok((await text()).includes(copy.fa['adminReservations.invalidId']));
    await logout();
  }
  for(const [id,landing] of [[4,'/panel/book'],[5,'/panel/doctor/reservations']]) {
    await login(id,landing);await navigate('/panel/reservations/8');
    await wait('location.pathname==='+JSON.stringify(landing),'non-admin route refusal');
    assert.equal((await api('/api/admin/reservations')).status,403);
    assert.equal((await api('/api/admin/reservations/8')).status,403);
    for(const [panel, endpoint] of [
      ['/panel/medical-requests','/api/admin/medical-requests'],
      ['/panel/questionnaires','/api/admin/questionnaires'],
      ['/panel/questionnaire-submissions','/api/admin/questionnaire-submissions'],
    ]){
      await navigate(panel);await wait('location.pathname==='+JSON.stringify(landing),'administration route refusal');
      assert.equal((await api(endpoint)).status,403);
      assert.equal(await evaluate('Array.from(document.querySelectorAll("a")).some(a=>a.getAttribute("href")==='+JSON.stringify(panel)+')'),false);
    }
    assert.equal(await evaluate('!!document.querySelector("a[href=\'/panel/reservations\']")'),false);
    record('Actor '+id+' admin navigation/deep-link and API refusal');await logout();
  }
  finalState=snapshot();assert.deepEqual(finalState.hashes,baseline.hashes);
  assert.equal(exceptions.length,0);assert.equal(external.length,0);assert.equal(blocked.length,0);
  assert.ok(requests.every(r=>['GET','OPTIONS'].includes(r.method)||['/login','/logout'].includes(r.path)));
  record('All accepted clinical/payment/questionnaire/audit/outbox/protected fingerprints unchanged; no job or business write');
}catch(error){failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure}));}
finally{
 if(failure&&ws?.readyState===WebSocket.OPEN){try{if(await evaluate("!!document.querySelector('.topbar-user')"))await logout();}catch{}}
 try{finalState??=snapshot();assert.deepEqual(finalState.hashes,baseline.hashes);}catch{failure??='Final immutable fingerprints failed';process.exitCode=1;}
 const target=failure?evidencePath.replace('.json','-failed-'+Date.now()+'.json'):evidencePath;
 if(failure)process.exitCode=1;
 writeFileSync(target,JSON.stringify({checked_at:new Date().toISOString(),acceptance:failure?'failed':'passed',image:staticProof.image,phase,failure,checks,requests,responses,exceptions,external,blocked,baseline,final:finalState,scope: "Retained eleven role/clinical/reservation read and refusal groups on the schedule candidate. GET/OPTIONS and login/logout only, no business writes/downloads; original completed/protected fingerprints preserved."},null,2)+'\n',{flag:'wx'});
 if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}for(const item of pending.values())clearTimeout(item.timer);browser.kill();
 for(let i=0;i<50;i++){try{assert.equal(realpathSync(dirname(profile)),realpathSync(tmpdir()));assert.equal(realpathSync(profile),resolve(profile));assert.match(basename(profile),/^checkupino-admin-medical-questionnaire-browser-[\w-]+$/);rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
}
