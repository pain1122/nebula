import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'No endpoint/account overrides accepted.');
assert.ok(!existsSync('docs/deployment/evidence/demo-questionnaire-browser-2026-10-11.json'),'This medical writer has already started; inspect state, do not replay.');

// Existing synthetic demo credentials stay in memory. Protected users never log in.
const password = readFileSync('.env', 'utf8').match(/^DEMO_SEED_PASSWORD=(.*)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
assert.ok(password, 'Configured demo password required.');
const snapshot = (submissionLimit = null) => {
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
 $submissionLimit=${submissionLimit??'null'};$submissionLimit??=(int)DB::table('questionnaire_submissions')->max('id');
 $q=App\\Models\\Questionnaire::where('slug','demo-heart-health-screen')->where('status','published')->with(['questions'=>fn($x)=>$x->orderBy('sort_order')->orderBy('id')->with(['choices'=>fn($y)=>$y->orderBy('sort_order')->orderBy('id')]),'recommendations'=>fn($x)=>$x->orderBy('priority')->orderBy('min_score')->orderBy('max_score')->orderBy('id')])->sole();
 $answers=[];$expectedScore=0;foreach($q->questions as $index=>$question){$choice=$question->choices->get($index===0?1:0);if(!$choice)throw new RuntimeException('Fixture choice missing.');$answers[]=['question_id'=>$question->id,'choice_id'=>$choice->id];$expectedScore+=(int)$choice->score;}
 $recommendation=$q->recommendations->first(fn($x)=>$expectedScore>=(int)$x->min_score&&$expectedScore<=(int)$x->max_score);
 $tables=['questionnaires','questionnaire_questions','questionnaire_choices','questionnaire_recommendations','leads','reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events']; $hashes=[];
 foreach($tables as $table) $hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['existing_submissions']=hash('sha256',json_encode(DB::table('questionnaire_submissions')->where('id','<=',$submissionLimit)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['all_audits']=hash('sha256',json_encode(DB::table('audit_events')->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['protected']=hash('sha256',json_encode(App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));
 $hashes['pipeline_audits']=hash('sha256',json_encode(App\\Models\\AuditEvent::where('id','<=',11)->orderBy('id')->get()->toArray(),JSON_THROW_ON_ERROR));$hashes['original_request']=hash('sha256',json_encode(DB::table('reservation_medical_requests')->where('public_id','01m4dn9fq2d38xxrh4wtkyf6s4')->first(),JSON_THROW_ON_ERROR));$hashes['existing_audits']=hash('sha256',json_encode(App\\Models\\AuditEvent::where('id','<=',9)->orderBy('id')->get()->toArray(),JSON_THROW_ON_ERROR));
 echo json_encode(['questionnaire'=>['id'=>$q->id,'slug'=>$q->slug,'version'=>$q->version,'questions'=>$q->questions->count(),'answers'=>$answers,'expected_score'=>$expectedScore,'recommendation'=>$recommendation?['title'=>$recommendation->title,'body_html'=>$recommendation->body_html]:null], 'submission_limit'=>$submissionLimit,'submission_count'=>DB::table('questionnaire_submissions')->count(),'new_submissions'=>DB::table('questionnaire_submissions')->where('id','>',$submissionLimit)->orderBy('id')->get(['public_id','questionnaire_id','questionnaire_version','user_id','guest_token_hash','guest_phone','answers_json','total_score','result_title','result_body_html','submitter_name','submitter_phone'])->all(),'reservation'=>$r->public_id,'request'=>$m->public_id,'request_title'=>$m->title,'file'=>App\\Models\\ReservationFile::firstOrFail()->public_id,'request_status'=>$m->status->value,'scanning'=>config('medical.scanner.enabled'),'private_driver'=>config('filesystems.disks.private.driver'),
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
assert.deepEqual(baseline.counts, { requests: 2, files: 2, reports: 2, jobs: 0 });
assert.equal(baseline.request_status, 'completed');
for (const actor of baseline.accounts) { assert.ok([1,2,3,4,5].includes(actor.id)); assert.match(actor.email, /@checkupino\.test$/); }
assert.match(baseline.request_title,/^Synthetic panel request /);
const delivery=JSON.parse(readFileSync('docs/deployment/evidence/demo-medical-job-delivery-2026-10-11.json','utf8'));
const upload=JSON.parse(readFileSync('docs/deployment/evidence/demo-upload-accepted-2026-10-11.json','utf8'));
assert.equal(delivery.acceptance,'passed');assert.equal(upload.acceptance,'passed');assert.equal(delivery.runtime.file,baseline.receipt.public_id);assert.equal(baseline.receipt.available,true);assert.equal(baseline.checksum,upload.synthetic_sha256);
assert.equal(baseline.new_audits.length,15);assert.ok(baseline.new_audits.every(a=>[4,5].includes(a.actor_user_id)));
const completed=JSON.parse(readFileSync('docs/deployment/evidence/demo-medical-final-readonly-2026-10-11.json','utf8'));assert.equal(completed.acceptance,'passed');
for(const [key,value] of Object.entries(completed.final.hashes))assert.equal(baseline.hashes[key],value,'Medical completion changed: '+key);
assert.equal(baseline.questionnaire.version,1);assert.equal(baseline.questionnaire.questions,3);assert.equal(baseline.questionnaire.slug,'demo-heart-health-screen');assert.equal(baseline.submission_count,0);
let submittedReceipt=null;
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
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/demo-questionnaire-browser-2026-10-11.json', import.meta.url));
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
const owned = '/panel/my/reservations/'+baseline.reservation+'/medical';
const assigned = '/panel/doctor/reservations/'+baseline.reservation+'/medical';
writeFileSync(evidencePath,JSON.stringify({acceptance:'started',checked_at:new Date().toISOString(),scope:'One ordinary questionnaire submission; never replay.'})+'\n');
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
    const cookies=(await send('Network.getCookies',{urls:['http://localhost:8080'+path]})).cookies;
    const response=await fetch('http://localhost:8080'+path,{headers:{Cookie:cookies.map(c=>c.name+'='+c.value).join('; '),Referer:'http://localhost:3000/',Origin:'http://localhost:3000',Accept:'application/pdf'}});
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('access-control-allow-origin'),'http://localhost:3000');assert.equal(bytes.length,upload.synthetic_bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),upload.synthetic_sha256);
    record((doctor?'Doctor':'Patient')+' ordinary session HTTP download (rendered anchor verified; native download tooling excluded) with exact synthetic bytes/digest and origin-only referrer');
  };

  await navigate('/panel/my/questionnaire');await wait('location.pathname==="/panel/login"&&document.querySelector("#email")','guest login guard');record('Questionnaire requires the ordinary panel login');
  for(const id of [3,2,1]){
    await login(id,id===3?'/panel/doctor/reservations':'/panel/');
    assert.equal(await evaluate('!!document.querySelector("a[href=\\"/panel/my/questionnaire\\"]")'),false);
    await navigate('/panel/my/questionnaire');await wait('location.pathname!=="/panel/my/questionnaire"','non-patient denial');assert.equal(await evaluate('!!document.querySelector("#questionnaire-name")'),false);record('Patient questionnaire denied to synthetic role account '+id);await logout();
  }
  await login(4,'/panel/book');await wait('document.querySelector("a[href=\\"/panel/my/questionnaire\\"]")','patient sidebar entry');
  await click('a[href="/panel/my/questionnaire"]');await wait('document.querySelector("#questionnaire-name")','published questionnaire');
  for(const lang of ['en','fa']){
    await locale(lang);assert.equal(await evaluate('document.querySelector("label[for=questionnaire-name]").textContent'),copy[lang]['questionnaire.name']);
    assert.ok((await text()).includes(copy[lang]['questionnaire.demo.title']));assert.equal(await evaluate('document.querySelectorAll(".page-content input[type=radio]").length'),9);
    await evaluate('document.querySelector(".page-content form").requestSubmit()');await delay(200);assert.equal(requests.filter(r=>r.path.endsWith('/submit')).length,0);record('Questionnaire '+lang+' retained vertical form, fixed translated fixture and required-field refusal');
  }
  await setValue('#questionnaire-name','Synthetic questionnaire patient');await setValue('#questionnaire-phone','09120000000');
  for(const answer of baseline.questionnaire.answers)await click('#questionnaire-choice-'+answer.choice_id);
  phase='questionnaire-submit';allowedWrite={method:'POST',path:'/api/questionnaires/demo-heart-health-screen/submit',body:{submitter_name:'Synthetic questionnaire patient',submitter_phone:'09120000000',answers:baseline.questionnaire.answers}};
  await evaluate('document.querySelector(".page-content form").requestSubmit()');
  await wait('document.querySelector(".page-content output")','ordinary questionnaire receipt');
  const receiptResponse=responses.find(r=>r.phase===phase&&r.method==='POST'&&r.path===allowedWrite.path);assert.ok(receiptResponse&&receiptResponse.status===200);
  const raw=await send('Network.getResponseBody',{requestId:receiptResponse.request_id});submittedReceipt=JSON.parse(raw.body);assert.equal(raw.base64Encoded,false);
  assert.equal(submittedReceipt.total_score,baseline.questionnaire.expected_score);assert.deepEqual(submittedReceipt.recommendation,baseline.questionnaire.recommendation);
  assert.equal(requests.filter(r=>r.method==='POST'&&r.path===allowedWrite.path).length,1);assert.ok(requests.some(r=>r.phase===phase&&r.method==='GET'&&r.path==='/api/questionnaires/demo-heart-health-screen'));allowedWrite=null;
  for(const lang of ['en','fa']){await locale(lang);const shown=await text();assert.ok(shown.includes(copy[lang]['questionnaire.submitted']));assert.ok(shown.includes(submittedReceipt.submission_id));assert.ok(shown.includes(copy[lang]['questionnaire.demo.routineTitle']));record('Patient '+lang+' displays ordinary server score/recommendation and submission ID');}
  await logout();assert.equal(exceptions.length,0);assert.equal(external.length,0);assert.equal(blocked.length,0);
  finalState=snapshot(baseline.submission_limit);assert.equal(finalState.submission_count,baseline.submission_count+1);assert.equal(finalState.new_submissions.length,1);
  const stored=finalState.new_submissions[0];assert.equal(stored.public_id,submittedReceipt.submission_id);assert.equal(stored.user_id,4);assert.equal(stored.guest_token_hash,null);assert.equal(stored.guest_phone,null);assert.equal(stored.questionnaire_id,baseline.questionnaire.id);assert.equal(stored.questionnaire_version,1);assert.equal(stored.total_score,submittedReceipt.total_score);assert.equal(stored.result_title,submittedReceipt.recommendation.title);assert.equal(stored.result_body_html,submittedReceipt.recommendation.body_html);
  assert.deepEqual(JSON.parse(stored.answers_json).map(a=>({question_id:a.question_id,choice_id:a.choice_id})),baseline.questionnaire.answers);
  for(const [key,value] of Object.entries(baseline.hashes))assert.equal(finalState.hashes[key],value,'Unrelated record changed: '+key);
  assert.deepEqual(finalState.counts,baseline.counts);record('One persisted patient-owned questionnaire snapshot; no guest lead, medical/queue/audit/protected/settings/booking/payment/outbox mutation');

}catch(error){failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure}));}
finally{
  if(failure && ws?.readyState===WebSocket.OPEN){try{if(await evaluate(`!!document.querySelector('.topbar-user')`))await logout();}catch{checks.push('Failure cleanup could not acknowledge auth logout; isolated browser will close');}}
  writeFileSync(evidencePath,JSON.stringify({submitted_receipt:submittedReceipt,questionnaire:baseline.questionnaire,submission_baseline_count:baseline.submission_count,stored_submission:finalState?.new_submissions?.[0]??null,checked_at:new Date().toISOString(),acceptance:failure?'failed':'passed',phase,failure,checks,requests,responses,exceptions,external,blocked,first_report:firstReport,second_report:secondReport,baseline:{counts:baseline.counts,hashes:baseline.hashes},final:finalState?{counts:finalState.counts,hashes:finalState.hashes,request_status:finalState.request_status,new_audits:finalState.new_audits}:null,scope:'One ordinary actual patient4 questionnaire submission; role/ENFA/refusal/fresh-definition/server-score/persisted ownership/no-guest-lead and preserved medical/payment/audit history. No builder/schema/booking prerequisite or direct result writes. Never replay.'},null,2)+'\n');

  if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}for(const item of pending.values())clearTimeout(item.timer);browser.kill();
  for(let i=0;i<50;i++){try{assert.equal(realpathSync(dirname(profile)),realpathSync(tmpdir()));assert.equal(realpathSync(profile),resolve(profile));assert.match(basename(profile),/^checkupino-medical-browser-[\w-]+$/);rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
}
