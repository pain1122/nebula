import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'No endpoint/account overrides accepted.');
assert.ok(!existsSync('docs/deployment/evidence/demo-outcome-completed-browser-2026-10-11.json'),'This medical writer has already started; inspect state, do not replay.');

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
 $target=$m->files()->sole();$ownerRequest=Illuminate\\Http\\Request::create('/internal/read-only-receipt');$ownerRequest->setUserResolver(fn()=>$r->user);
 $receipt=(new App\\Http\\Resources\\ReservationMedicalFileResource($target))->resolve($ownerRequest);
 App\\Support\\VerifiedPrivateFile::open($target);
 $uploadAudit=App\\Models\\AuditEvent::where('subject_public_id',$target->public_id)->where('action','reservation_medical_file.uploaded')->sole();
 if($target->uploaded_by!==4 || $target->reservation_id!==8 || $target->scan_status!==App\\Enums\\ReservationFileScanStatus::Clean || $target->scanned_at===null || $uploadAudit->actor_user_id!==4)throw new RuntimeException('Committed synthetic upload binding rejected.');
 $tables=['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events']; $hashes=[];
 foreach($tables as $table) $hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['protected']=hash('sha256',json_encode(App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));
 $hashes['pipeline_audits']=hash('sha256',json_encode(App\\Models\\AuditEvent::where('id','<=',11)->orderBy('id')->get()->toArray(),JSON_THROW_ON_ERROR));$hashes['original_request']=hash('sha256',json_encode(DB::table('reservation_medical_requests')->where('public_id','01m4dn9fq2d38xxrh4wtkyf6s4')->first(),JSON_THROW_ON_ERROR));$hashes['existing_audits']=hash('sha256',json_encode(App\\Models\\AuditEvent::where('id','<=',9)->orderBy('id')->get()->toArray(),JSON_THROW_ON_ERROR));
 echo json_encode(['reservation'=>$r->public_id,'request'=>$m->public_id,'request_title'=>$m->title,'file'=>App\\Models\\ReservationFile::firstOrFail()->public_id,'request_status'=>$m->status->value,'scanning'=>config('medical.scanner.enabled'),'private_driver'=>config('filesystems.disks.private.driver'),
 'counts'=>['requests'=>DB::table('reservation_medical_requests')->count(),'files'=>DB::table('reservation_files')->count(),'reports'=>DB::table('reservation_reports')->count(),'jobs'=>DB::table('jobs')->count()],
 'reports'=>$m->reports()->orderBy('id')->get(['public_id','status','supersedes_report_id'])->toArray(),'new_audits'=>App\\Models\\AuditEvent::where('id','>',11)->orderBy('id')->get(['id','actor_user_id','action','subject_public_id'])->toArray(),'receipt'=>$receipt,'checksum'=>$target->checksum_sha256,'upload_audit_id'=>$uploadAudit->id,'original_file_hash'=>hash('sha256',json_encode(DB::table('reservation_files')->where('public_id','01M4DN9XK0Z7CKQ2GFBHSACA6H')->first(),JSON_THROW_ON_ERROR)), 'target_files'=>$m->files()->get(['public_id','scan_status','size_bytes'])->toArray(), 'accounts'=>collect([$r->user,$r->doctor->user,App\\Models\\User::with('roles')->findOrFail(3),App\\Models\\User::with('roles')->findOrFail(2),App\\Models\\User::with('roles')->findOrFail(1)])->map(fn($u)=>['id'=>$u->id,'email'=>$u->email,'roles'=>$u->roles->pluck('name')->all()])->all(),
 'hashes'=>$hashes],JSON_THROW_ON_ERROR);
} finally { DB::rollBack(); }
`;
  const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, 'Readonly synthetic fixture snapshot failed.');
  return JSON.parse(result.stdout);
};
const baseline = snapshot();
assert.equal(baseline.scanning, true); assert.equal(baseline.private_driver, 'local');
assert.deepEqual(baseline.counts, { requests: 2, files: 2, reports: 0, jobs: 0 });
assert.equal(baseline.request_status, 'open');
for (const actor of baseline.accounts) { assert.ok([1,2,3,4,5].includes(actor.id)); assert.match(actor.email, /@checkupino\.test$/); }
assert.match(baseline.request_title,/^Synthetic panel request /);
const delivery=JSON.parse(readFileSync('docs/deployment/evidence/demo-medical-job-delivery-2026-10-11.json','utf8'));
const upload=JSON.parse(readFileSync('docs/deployment/evidence/demo-upload-accepted-2026-10-11.json','utf8'));
assert.equal(delivery.acceptance,'passed');assert.equal(upload.acceptance,'passed');assert.equal(delivery.runtime.file,baseline.receipt.public_id);assert.equal(baseline.receipt.available,true);assert.equal(baseline.checksum,upload.synthetic_sha256);
assert.equal(baseline.new_audits.length,2);assert.ok(baseline.new_audits.every(a=>a.actor_user_id===5&&a.action==='reservation_medical_file.accessed'&&a.subject_public_id===baseline.receipt.public_id));
const doctorPath='/api/doctor/reservations/'+baseline.reservation+'/medical-requests/'+baseline.request;
const patientPath='/api/reservations/'+baseline.reservation+'/medical-requests/'+baseline.request;
const initialBody='Synthetic demo initial draft.';
const finalBody='Synthetic demo report.\nValidated synthetic PDF received.\nDemo outcome only; no real patient information.';
const amendmentBody='Synthetic demo amendment.\nThe previously published demo outcome is retained in history.';
let allowedWrite=null,firstReport=null,secondReport=null;
const sentPhases=new Set();
const profile = mkdtempSync(join(tmpdir(), 'checkupino-medical-browser-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--incognito', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-sync', '--window-size=1440,1000', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const copy = Object.fromEntries(['en','fa'].map(lang => [lang, JSON.parse(readFileSync(`frontend/src/locales/${lang}.json`, 'utf8'))]));
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/demo-outcome-completed-browser-2026-10-11.json', import.meta.url));
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
      let permitted=url.origin==='http://localhost:3000'&&request.method==='GET'||url.origin==='http://localhost:8080'&&(request.method==='GET'||request.method==='OPTIONS'||request.method==='POST'&&['/login','/logout'].includes(url.pathname));
      if(!permitted&&url.origin==='http://localhost:8080'&&allowedWrite&&request.method===allowedWrite.method&&url.pathname===allowedWrite.path&&!sentPhases.has(phase)){
        const body=request.postData?JSON.parse(request.postData):null;
        assert.deepEqual(body,allowedWrite.body);sentPhases.add(phase);permitted=true;
      }
      if(permitted)await send('Fetch.continueRequest',{requestId});else {blocked.push({method:request.method,path:url.pathname});await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
    })().catch(()=>{failure='Browser request guard failed';});
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});



  const buttonExpression=key=>'Array.from(document.querySelectorAll(".page-content button")).find(b=>b.textContent.trim()==='+JSON.stringify(copy.en['medical.'+key])+'&&!b.disabled)';
  const press=async key=>{await wait(buttonExpression(key),'enabled '+key);await evaluate(buttonExpression(key)+'.click()');};
  const select=async doctor=>{await navigate(doctor?assigned:owned);await wait('document.querySelector(".file-manager-sidebar")','medical page');await locale('en');await evaluate('Array.from(document.querySelectorAll(".file-manager-menu button")).find(b=>b.textContent.trim()==='+JSON.stringify(baseline.request_title)+').click()');await wait('document.querySelector(".file-manager-content")?.textContent.includes('+JSON.stringify(baseline.request_title)+')','selected request');};
  const setBody=async body=>{await wait('document.querySelector("#medical-report-body")','report textarea');await evaluate('(()=>{const field=document.querySelector("#medical-report-body");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(field,'+JSON.stringify(body)+');field.dispatchEvent(new Event("input",{bubbles:true}));field.dispatchEvent(new Event("change",{bubbles:true}));})()');};
  const submit=async()=>{await evaluate('document.querySelector(".modal-content form").requestSubmit()');await wait('!document.querySelector(".modal-content")','ordinary action acknowledged');assert.ok(sentPhases.has(phase),'Expected single ordinary write not sent');const response=responses.find(r=>r.phase===phase&&r.method===allowedWrite.method&&r.path===allowedWrite.path);assert.ok(response&&[200,201].includes(response.status),'Ordinary write receipt missing');assert.ok(requests.some(r=>r.phase===phase&&r.method==='GET'&&r.path===doctorPath),'Fresh detail preflight missing');allowedWrite=null;};
  const freshDetail=async()=>{const r=await api(doctorPath);assert.equal(r.status,200);return r.data.data;};
  const download=async doctor=>{
    const path=(doctor?doctorPath:patientPath)+'/files/'+baseline.receipt.public_id+'/download';
    await wait('document.querySelector(".file-manager-content a[href*=download]")','eligible download anchor');
    assert.equal(await evaluate('document.querySelector(".file-manager-content a[href*=download]").href'),'http://localhost:8080'+path);
    assert.equal(await evaluate('document.querySelector(".file-manager-content a[href*=download]").rel'),'noopener');
    assert.equal(await evaluate('document.querySelector(".file-manager-content a[href*=download]").referrerPolicy'),'origin');
    const directory=join(profile,'downloads');mkdirSync(directory,{recursive:true});const existing=new Set(readdirSync(directory));
    await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
    const navigation=await send('Page.navigate',{url:'http://localhost:8080'+path,referrer:'http://localhost:3000/',referrerPolicy:'origin'});
    assert.ok(navigation.isDownload||navigation.errorText==='net::ERR_ABORTED','Expected a browser download navigation.');
    let name;const until=Date.now()+20000;while(Date.now()<until){name=readdirSync(directory).find(value=>!existing.has(value)&&!value.endsWith('.crdownload'));if(name)break;await delay(100);}
    assert.ok(name,'Browser download did not complete.');const bytes=readFileSync(join(directory,name));assert.equal(bytes.length,upload.synthetic_bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),upload.synthetic_sha256);
    record((doctor?'Doctor':'Patient')+' actual browser navigation download with exact synthetic bytes/digest and origin-only referrer');
  };

  await login(5,'/panel/doctor/reservations');await select(true);
  await download(true);
  phase='review';allowedWrite={method:'POST',path:doctorPath+'/review',body:null};
  await press('startReview');await wait('document.querySelector(".modal-content form")','review confirmation');await submit();
  assert.equal((await freshDetail()).medical_request.status,'in_review');record('Assigned doctor starts ordinary audited review after a fresh read');

  phase='draft';allowedWrite={method:'POST',path:doctorPath+'/reports',body:{body:initialBody}};
  await press('newDraft');await setBody(initialBody);await submit();
  let detail=await freshDetail();assert.equal(detail.reports.length,1);firstReport=detail.reports[0];assert.equal(firstReport.status,'draft');assert.equal(firstReport.body,initialBody);record('Ordinary plain-text draft created through retained modal');
  await logout();await login(4,'/panel/book');await select(false);
  assert.equal((await api(patientPath+'/outcome')).status,404);assert.ok(!(await text()).includes(initialBody));record('Patient cannot discover draft before publication');await logout();

  await login(5,'/panel/doctor/reservations');await select(true);await press('reports');
  phase='edit';allowedWrite={method:'PUT',path:doctorPath+'/reports/'+firstReport.public_id,body:{body:finalBody}};
  await press('editDraft');await setBody(finalBody);await submit();detail=await freshDetail();assert.equal(detail.reports[0].body,finalBody);

  phase='publish';allowedWrite={method:'POST',path:doctorPath+'/reports/'+firstReport.public_id+'/publish',body:null};
  await press('publishReport');await wait('document.querySelector(".modal-content pre")?.textContent==='+JSON.stringify(finalBody),'exact publication preview');assert.ok(await evaluate('document.querySelector(".modal-content").textContent.includes('+JSON.stringify(copy.en['medical.publishConfirm'])+')'));await submit();
  detail=await freshDetail();assert.equal(detail.medical_request.status,'completed');firstReport=detail.reports[0];assert.equal(firstReport.status,'published');assert.equal(firstReport.body,finalBody);assert.ok(firstReport.published_at);record('Draft edited then explicitly confirmed immutable publication; medical request completed by ordinary service');

  phase='amend';allowedWrite={method:'POST',path:doctorPath+'/reports',body:{body:amendmentBody,supersedes_report_id:firstReport.public_id}};
  await press('amendReport');await setBody(amendmentBody);await submit();detail=await freshDetail();secondReport=detail.reports.find(r=>r.status==='draft');assert.ok(secondReport);assert.equal(secondReport.supersedes_report_public_id,firstReport.public_id);
  await logout();await login(4,'/panel/book');await select(false);
  const beforePublish=await api(patientPath+'/outcome');assert.equal(beforePublish.status,200);assert.equal(beforePublish.data.data.latest_report.public_id,firstReport.public_id);assert.equal(beforePublish.data.data.report_history.length,1);assert.ok(!JSON.stringify(beforePublish.data).includes(amendmentBody));record('Unpublished amendment remains hidden; patient still sees immutable prior outcome');await logout();

  await login(5,'/panel/doctor/reservations');await select(true);await press('reports');
  phase='amend-publish';allowedWrite={method:'POST',path:doctorPath+'/reports/'+secondReport.public_id+'/publish',body:null};
  await press('publishReport');await wait('document.querySelector(".modal-content pre")?.textContent==='+JSON.stringify(amendmentBody),'exact amendment preview');await submit();detail=await freshDetail();assert.equal(detail.reports.length,2);assert.ok(detail.reports.every(r=>r.status==='published'));assert.equal(detail.reports.find(r=>r.public_id===firstReport.public_id).body,finalBody);
  await wait('!Array.from(document.querySelectorAll(".file-manager-detail-content button")).some(b=>['+JSON.stringify(copy.en['medical.editDraft'])+','+JSON.stringify(copy.en['medical.publishReport'])+'].includes(b.textContent.trim()))','immutable published controls');record('Amendment published as new history; both published reports have no edit/publish controls');await logout();

  await login(4,'/panel/book');await select(false);
  const outcome=await api(patientPath+'/outcome');assert.equal(outcome.status,200);assert.equal(outcome.data.data.latest_report.public_id,secondReport.public_id);assert.equal(outcome.data.data.report_history.length,2);assert.ok(outcome.data.data.report_history.every(r=>r.status==='published'&&r.body_format==='plain_text'));assert.deepEqual(outcome.data.data.files.map(f=>f.public_id),[baseline.receipt.public_id]);
  await download(false);await press('reports');
  for(const lang of ['en','fa']){await locale(lang);await wait('document.querySelector(".file-manager-detail-content")','published history');const shown=await text();assert.ok(shown.includes(finalBody));assert.ok(shown.includes(amendmentBody));record('Patient '+lang+' actual latest published outcome and retained two-report history');}
  await send('Page.reload');await wait('document.querySelector(".file-manager-sidebar")','published outcome refresh');record('Published outcome survives browser refresh');await logout();

  await login(3,'/panel/doctor/reservations');assert.equal((await api(doctorPath)).status,404);assert.equal((await api(doctorPath+'/files/'+baseline.receipt.public_id+'/download')).status,404);record('Unassigned doctor cannot read the new clean file or published reports');await logout();
  assert.equal(exceptions.length,0);assert.equal(external.length,0);assert.equal(blocked.length,0);assert.equal(sentPhases.size,6);
  for(const mutation of requests.filter(r=>!['GET','OPTIONS'].includes(r.method)&&!['/login','/logout'].includes(r.path)))assert.ok(['review','draft','edit','publish','amend','amend-publish'].includes(mutation.phase));
  finalState=snapshot();assert.deepEqual(finalState.counts,{requests:2,files:2,reports:2,jobs:0});assert.equal(finalState.request_status,'completed');assert.equal(finalState.original_file_hash,baseline.original_file_hash);
  for(const key of Object.keys(baseline.hashes))if(!['reservation_medical_requests','reservation_reports'].includes(key))assert.equal(finalState.hashes[key],baseline.hashes[key],'Unrelated mutation: '+key);
  assert.equal(finalState.new_audits.length,baseline.new_audits.length+8);assert.ok(finalState.new_audits.every(a=>[4,5].includes(a.actor_user_id)&&['reservation_medical_request.review_started','reservation_report.draft_saved','reservation_report.published','reservation_medical_file.accessed'].includes(a.action)));
  assert.equal(failure,null);record('Six scoped ordinary writes/eight normal audits; original quarantine, upload/scan history, protected accounts, settings, booking, payment and outbox unchanged');

}catch(error){failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure}));}
finally{
  if(failure && ws?.readyState===WebSocket.OPEN){try{if(await evaluate(`!!document.querySelector('.topbar-user')`))await logout();}catch{checks.push('Failure cleanup could not acknowledge auth logout; isolated browser will close');}}
  writeFileSync(evidencePath,JSON.stringify({checked_at:new Date().toISOString(),acceptance:failure?'failed':'passed',phase,failure,checks,requests,responses,exceptions,external,blocked,first_report:firstReport,second_report:secondReport,baseline:{counts:baseline.counts,hashes:baseline.hashes},final:finalState?{counts:finalState.counts,hashes:finalState.hashes,request_status:finalState.request_status,new_audits:finalState.new_audits}:null,scope:'Ordinary actual synthetic doctor review/download/draft/edit/confirmed publish/amendment and patient outcome/history/download. No direct status writes, original-file processing or reservation completion. Never replay after any write.'},null,2)+'\n');

  if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}for(const item of pending.values())clearTimeout(item.timer);browser.kill();
  for(let i=0;i<50;i++){try{assert.equal(realpathSync(dirname(profile)),realpathSync(tmpdir()));assert.equal(realpathSync(profile),resolve(profile));assert.match(basename(profile),/^checkupino-medical-browser-[\w-]+$/);rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
}



