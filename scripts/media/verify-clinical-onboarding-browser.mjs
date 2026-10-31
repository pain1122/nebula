import { runClinicalOnboardingBrowser } from './clinical-onboarding-browser-cases.mjs';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'No endpoint/account overrides accepted.');
assert.ok(!existsSync('docs/deployment/evidence/clinical-onboarding-browser-2026-10-18.json'),'Evidence exists; inspect it instead of overwriting.');

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
 $catalog=[];foreach(['checkups','checkup_categories','doctor_workplace_checkup','doctor_visit_slots','specialties','doctor_profiles','doctor_specialty','doctor_workplaces','doctor_working_windows','doctor_working_window_breaks','marketplace_hospitals','reservation_schedule_changes'] as $table)$catalog[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $stable=$r->getAttributes();unset($stable['status'],$stable['completed_at'],$stable['updated_at']);$hashes['target_stable']=hash('sha256',json_encode($stable,JSON_THROW_ON_ERROR));
 $hashes['other_reservations']=hash('sha256',json_encode(DB::table('reservations')->where('id','!=',8)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $auditRecords=DB::table('audit_events')->orderBy('id')->get()->map(fn($a)=>['id'=>$a->id,'actor_user_id'=>$a->actor_user_id,'action'=>$a->action,'subject_public_id'=>$a->subject_public_id,'sha256'=>hash('sha256',json_encode($a,JSON_THROW_ON_ERROR))]);
 $outboxRecords=DB::table('outbox_events')->orderBy('id')->get()->map(fn($o)=>['id'=>$o->id,'event_type'=>$o->event_type,'subject_public_id'=>$o->subject_public_id,'payload'=>json_decode($o->payload,true,512,JSON_THROW_ON_ERROR),'sha256'=>hash('sha256',json_encode($o,JSON_THROW_ON_ERROR))]);
 $hashes['protected']=hash('sha256',json_encode(App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));
 echo json_encode(['finance_hashes'=>collect(['payment_provider_events','payment_adjustments'])->mapWithKeys(fn($table)=>[$table=>hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR))])->all(),'catalog_hashes'=>$catalog,'request_title'=>App\\Models\\ReservationMedicalRequest::where('public_id','01m4hfgan168p6q5ftp528285f')->value('title'),'reservation'=>$r->public_id,'status'=>$r->status->value,'completed_at'=>$r->completed_at?->toISOString(),'audits'=>$auditRecords,'outbox'=>$outboxRecords,'starts_at'=>$r->starts_at->toISOString(),'now'=>now()->toISOString(),'can_complete'=>app(App\\Services\\ReservationLifecycleService::class)->canComplete($r),'hashes'=>$hashes,'accounts'=>collect([$r->user,$r->doctor->user,App\\Models\\User::with('roles')->findOrFail(3),App\\Models\\User::with('roles')->findOrFail(2),App\\Models\\User::with('roles')->findOrFail(1)])->map(fn($u)=>['id'=>$u->id,'public_id'=>$u->public_id,'email'=>$u->email,'roles'=>$u->roles->pluck('name')->all()])->all()],JSON_THROW_ON_ERROR);
}finally{DB::rollBack();}
`;
 const result=spawnSync('docker',['exec','-i','--user','www-data','checkupino_app','php'],{input:php,encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(result.status,0,'Read-only fixture inspection failed.');return JSON.parse(result.stdout);
};
const baseline=snapshot();assert.equal(baseline.status,'completed');assert.equal(baseline.can_complete,false);
for(const [key,value] of Object.entries(JSON.parse(readFileSync('docs/deployment/evidence/admin-catalog-read-runtime-2026-10-14.json','utf8')).catalog_final))assert.equal(baseline.catalog_hashes[key],value);
const previous=JSON.parse(readFileSync('docs/deployment/evidence/demo-appointment-completed-final-2026-10-11.json','utf8'));assert.equal(previous.acceptance,'passed');
const currentCheckpoint=JSON.parse(readFileSync('docs/deployment/evidence/clinical-experience-pre-browser-2026-10-17.json','utf8'));
assert.equal(currentCheckpoint.historical_audit_records_preserved,true);assert.equal(currentCheckpoint.historical_outbox_records_preserved,true);
for(const key of ['protected','reservation_reports','setting_values','target_stable'])assert.equal(currentCheckpoint.historical_whole_table_matches[key],true);
assert.deepEqual(baseline.hashes,currentCheckpoint.snapshot.hashes);assert.deepEqual(baseline.catalog_hashes,currentCheckpoint.snapshot.catalog_hashes);assert.deepEqual(baseline.finance_hashes,currentCheckpoint.snapshot.finance_hashes);
for(const actor of baseline.accounts){assert.ok([1,2,3,4,5].includes(actor.id));assert.match(actor.email,/@checkupino\.test$/);}
assert.ok(baseline.accounts.find(a => a.id === 2)?.roles.includes('admin'));
assert.ok(baseline.accounts.find(a => a.id === 1)?.roles.includes('root-admin'));
const staticProof = JSON.parse(readFileSync('docs/deployment/evidence/clinical-onboarding-static-2026-10-18.json','utf8'));
assert.equal(staticProof.acceptance,'passed');
assert.equal(JSON.parse(spawnSync('docker',['inspect','--format','{{json .Image}}','checkupino_prod-admin-1'],{encoding:'utf8',windowsHide:true,timeout:10000}).stdout),staticProof.image);
const profile = mkdtempSync(join(tmpdir(), 'checkupino-admin-medical-questionnaire-browser-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--incognito', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-sync', '--window-size=1440,1000', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const copy = Object.fromEntries(['en','fa'].map(lang => [lang, JSON.parse(readFileSync(`frontend/src/locales/${lang}.json`, 'utf8'))]));
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/clinical-onboarding-browser-2026-10-18.json', import.meta.url));
const pending = new Map(), network = new Map(), requests = [], responses = [], exceptions = [], external = [], checks = [], blocked = [], networkFailures=[];
let ws, sequence = 0, phase = 'setup', failure = null, finalState = null;
const runStamp=Date.now(),screenshots=[],geometryChecks=[],releaseVisits=[],apiChecks=[],calendarLabels=[],historyEvents=[];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: '+method)); }, 30000);
  pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
const wait = async (expression, label) => { const deadline = Date.now()+35000; while(Date.now()<deadline) { if(await evaluate(`Boolean(${expression})`)) return; await delay(100); } throw new Error('Browser timeout: '+label); };
const navigate = path => send('Page.navigate', { url: 'http://localhost:3000'+path });
const pointerExpression = async expression => {
  let point=null,previous=null;
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){
    // Full-page role fallbacks remount the retained default customizer asynchronously.
    // Dismiss it through its ordinary close button before probing the requested target.
    if(!expression.includes('offcanvas')&&await evaluate('!!document.querySelector(".offcanvas")'))await clearCustomizer();
    const candidate=await evaluate(`(()=>{const e=${expression};if(!e||e.disabled)return null;e.scrollIntoView({block:'center',inline:'nearest'});for(const r of e.getClientRects()){if(r.width<=0||r.height<=0)continue;const y=r.y+r.height/2;for(const x of [r.x+r.width/2,r.x+Math.min(8,r.width/4),r.right-Math.min(8,r.width/4)]){const hit=document.elementFromPoint(x,y);if(hit&&e.contains(hit))return {x,y};}}return null;})()`);
    if(candidate&&previous&&Math.abs(candidate.x-previous.x)<0.1&&Math.abs(candidate.y-previous.y)<0.1){point=candidate;break;}
    previous=candidate;await delay(100);
  }
  if(!point){
    const diagnostic=await evaluate(`(()=>{const e=${expression};const r=e?.getBoundingClientRect(),hit=r?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2):null;return {exists:!!e,target:e?{tag:e.tagName,class:e.className,disabled:e.disabled}:null,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,hit:hit?{tag:hit.tagName,class:hit.className}:null,headerButtons:Array.from(document.querySelectorAll('#page-topbar button')).map(b=>({aria:b.getAttribute('aria-label'),class:b.className})),canvases:document.querySelectorAll('.offcanvas').length,backdrops:document.querySelectorAll('.offcanvas-backdrop').length,overflow:document.body.style.overflow};})()`);
    console.log(JSON.stringify({pointer_diagnostic:diagnostic}));
  }
  assert.ok(point,'Pointer target unavailable, moving or obscured: '+expression);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
};
const click = selector => pointerExpression('document.querySelector('+JSON.stringify(selector)+')');
const clickText = label => pointerExpression('Array.from(document.querySelectorAll(".page-content button,dialog[open] button,.modal.show button")).find(b=>b.textContent.trim()==='+JSON.stringify(label)+'&&!b.disabled)');
const clearCustomizer = async () => {
  await wait('document.querySelector(".offcanvas.show .btn-close")', 'customizer opening transition');
  await click('.offcanvas.show .btn-close');
  await wait('!document.querySelector(".offcanvas")&&!document.querySelector(".offcanvas-backdrop")&&document.body.style.overflow!=="hidden"', 'customizer fully closed');
};
const noOverlay = async () => assert.equal(await evaluate('Array.from(document.querySelectorAll(".offcanvas-backdrop,.modal-backdrop,.vertical-overlay,.layout-rightside-col .overlay")).filter(e=>!(document.querySelector("dialog[open] [data-general-setting-preview],dialog[open] [data-payment-adjustment-preview]")&&e.matches("[data-overlay=dialog] > .modal-backdrop"))&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=="hidden"&&getComputedStyle(e).display!=="none"&&Number(getComputedStyle(e).opacity)>0).length'),0);
const screenshot = async (kind,lang,allowOverlay=false,section=null) => {
  if(!allowOverlay)await noOverlay();await evaluate('document.fonts.ready.then(()=>{window.scrollTo({top:0,left:0,behavior:"instant"});return true})');
  await wait('scrollX===0&&scrollY===0&&document.querySelector("#page-topbar").getBoundingClientRect().top===0','capture scroll origin');await delay(500);
  if(section){assert.ok(['#doctor-practice','[data-dashboard-section=appointments]'].includes(section));await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(section)+');window.scrollTo({top:e.getBoundingClientRect().top+scrollY-90,left:0,behavior:"instant"});})()');await delay(400);}
  const viewport=await evaluate('({width:innerWidth,height:innerHeight})');
  const shot=await send('Page.captureScreenshot',section?{format:'png',captureBeyondViewport:false}:{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width:viewport.width,height:viewport.height,scale:1}});
  assert.ok(Buffer.from(shot.data,'base64').length>8000,'Capture must contain a rendered screen, not an empty clipped area.');
  const relative='../../docs/deployment/evidence/clinical-onboarding-browser-'+kind+'-'+lang+'-'+runStamp+'-2026-10-18.png';
  writeFileSync(fileURLToPath(new URL(relative,import.meta.url)),Buffer.from(shot.data,'base64'),{flag:'wx'});screenshots.push(relative.replace('../../',''));
};
const calendarScreenshot=async(kind,lang)=>{
 await noOverlay();await evaluate('(()=>{const e=document.querySelector("[data-dashboard-section=appointments]");window.scrollTo({top:e.getBoundingClientRect().top+scrollY-90,left:0,behavior:"instant"});return true})()');await delay(400);
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const relative='../../docs/deployment/evidence/clinical-onboarding-browser-'+kind+'-'+lang+'-'+runStamp+'-2026-10-18.png';writeFileSync(fileURLToPath(new URL(relative,import.meta.url)),Buffer.from(shot.data,'base64'),{flag:'wx'});screenshots.push(relative.replace('../../',''));
};
const setValue = (selector, value) => evaluate(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const api = path => evaluate(`fetch('http://localhost:8080'+${JSON.stringify(path)},{credentials:'include',headers:{Accept:'application/json'}}).then(async r=>({status:r.status,cache:r.headers.get('Cache-Control'),data:await r.json()}))`);
const record = name => { checks.push(name); console.log(JSON.stringify({ check: name, passed: true })); };
const text = () => evaluate(`document.querySelector('.page-content')?.textContent || ''`);
const locale = async lang => {
  if(await evaluate('document.documentElement.lang!=='+JSON.stringify(lang))){
    const current=await evaluate('document.documentElement.lang');
    await pointerExpression('Array.from(document.querySelectorAll("#page-topbar button")).find(b=>b.getAttribute("aria-label")==='+JSON.stringify(copy[current]['product.language.choose'])+')');
    await pointerExpression('Array.from(document.querySelectorAll(".language .dropdown-item")).find(x=>x.textContent.trim()==='+JSON.stringify(lang==='en'?'English':'\u0641\u0627\u0631\u0633\u06cc')+')');
  }
  await wait('document.documentElement.lang==='+JSON.stringify(lang),'locale');
  assert.equal(await evaluate('document.documentElement.dir'),lang==='fa'?'rtl':'ltr');
};
const measuredMirror = async label => {
  const samples={};
  for(const lang of ['en','fa']){
    await locale(lang);await delay(400);
    samples[lang]=await evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};const selectors=['.main-content','#page-topbar','.app-menu','.footer','.page-content .card'];return {width:document.documentElement.clientWidth,windowWidth:innerWidth,root:{...document.documentElement.dataset},boxes:selectors.map(s=>({selector:s,...rect(document.querySelector(s))})),breadcrumb:document.querySelector('.breadcrumb-item.active')?getComputedStyle(document.querySelector('.breadcrumb-item.active'),'::before').content:null,logoTransform:getComputedStyle(document.querySelector('.navbar-brand-box img')).transform,cards:Array.from(document.querySelectorAll('.page-content .card')).map(rect),scrollWidth:document.documentElement.scrollWidth}})()`);
    assert.ok(samples[lang].cards.every(r=>r.left>=-1&&r.right<=samples[lang].width+1),'Detail cards outside viewport '+label+' '+lang);
    assert.ok(samples[lang].scrollWidth<=samples[lang].width+1,'Page overflow '+label+' '+lang);
    assert.equal(samples[lang].logoTransform,'none','Brand must remain unmirrored');
    await pointerExpression('Array.from(document.querySelectorAll("#page-topbar button")).find(b=>b.getAttribute("aria-label")==='+JSON.stringify(copy[lang]['product.language.choose'])+')');
    await wait('document.querySelector(".language.show")','language menu shown');await delay(150);
    const menu=await evaluate(`(()=>{const e=document.querySelector('.language.show'),r=e.getBoundingClientRect();return {left:r.left,right:r.right,placement:e.dataset.popperPlacement,flags:Array.from(e.querySelectorAll('.dropdown-item')).map(item=>{const i=item.querySelector('img').getBoundingClientRect(),t=item.querySelector('span').getBoundingClientRect();return {flagLeft:i.left,flagRight:i.right,textLeft:t.left,textRight:t.right}})}})()`);
    assert.ok(menu.left>=-1&&menu.right<=samples[lang].width+1,'Language menu overflow');
    assert.ok(menu.flags.every(f=>lang==='fa'?f.flagLeft>=f.textRight+1:f.flagRight<=f.textLeft-1),'Flag/label spacing must mirror');
    samples[lang].languageMenu=menu;
    await pointerExpression('Array.from(document.querySelectorAll("#page-topbar button")).find(b=>b.getAttribute("aria-label")==='+JSON.stringify(copy[lang]['product.language.choose'])+')');
    await noOverlay();
  }
  geometryChecks.push({label,mirror:true,samples});
  for(let i=0;i<samples.en.boxes.length;i++){
    const a=samples.en.boxes[i],b=samples.fa.boxes[i];
    assert.ok(Math.abs(a.width-b.width)<1.5,'Mirror width '+label+' '+a.selector);
    assert.ok(Math.abs(samples.en.width-a.right-b.left)<1.5,'Mirror horizontal origin '+label+' '+a.selector+' '+JSON.stringify({a,b,width:samples.en.width}));
  }
  if(samples.en.breadcrumb!==null||samples.fa.breadcrumb!==null)assert.notEqual(samples.en.breadcrumb,samples.fa.breadcrumb,'Breadcrumb arrow must reverse');else assert.equal(samples.en.breadcrumb,samples.fa.breadcrumb,'Home has no breadcrumb in either locale');
  record(label+' mirrored shell/cards/logo and actual language menu flag spacing; home breadcrumb absent in both locales');
};
const customize = async ids => {
  await click('.customizer-setting > div');await wait('document.querySelector(".offcanvas.show .btn-close")','customizer ready');
  for(const id of ids){await click('label[for="'+id+'"]');await delay(150);}
  await clearCustomizer();await delay(400);await noOverlay();
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
  const activePort=join(profile,'DevToolsActivePort');let port=null;
  for(let i=0;i<100&&port===null;i++){
    try{const value=Number(readFileSync(activePort,'utf8').split('\n')[0]);if(Number.isInteger(value)&&value>0&&value<=65535)port=value;}
    catch(error){if(!['ENOENT','EBUSY'].includes(error.code))throw error;}
    if(port===null)await delay(100);
  }
  assert.ok(port,'Isolated Chrome did not publish a readable port within the startup bound.');
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json(); ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);}
    else if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.text);
    else if(message.method==='Runtime.bindingCalled'&&message.params.name==='checkupinoRestoreProbe'){
      try{const event=JSON.parse(message.params.payload);if(['pageshow','pagehide'].includes(event.type)&&typeof event.persisted==='boolean'&&typeof event.rootPresent==='boolean'&&typeof event.rootHidden==='boolean')historyEvents.push({...event,phase});else failure='Invalid history probe event';}catch{failure='Invalid history probe event';}
    }
    else if(message.method==='Network.requestWillBeSent'){
      const r=message.params.request,url=new URL(r.url);
      if(url.origin==='http://localhost:8080'){const item={phase,method:r.method,path:url.pathname,query:url.search};requests.push(item);network.set(message.params.requestId,item);}
      else if(/^https?:$/.test(url.protocol)&&url.origin!=='http://localhost:3000')external.push(url.origin);
    }else if(message.method==='Network.responseReceived'){const item=network.get(message.params.requestId);if(item)responses.push({...item,status:message.params.response.status,request_id:message.params.requestId});}
    else if(message.method==='Network.loadingFailed'){const item=network.get(message.params.requestId);if(item)networkFailures.push({...item,canceled:message.params.canceled===true,error:message.params.errorText});}
    else if(message.method==='Fetch.requestPaused')void(async()=>{
      const {requestId,request}=message.params;const url=new URL(request.url);
      let permitted=url.origin==='http://localhost:3000'&&request.method==='GET'||url.origin==='http://localhost:8080'&&(request.method==='GET'||request.method==='OPTIONS'||request.method==='POST'&&['/login','/logout'].includes(url.pathname));
      if (url.origin==='http://localhost:8080' && url.pathname.endsWith('/download')) permitted=false;
      if(permitted)await send('Fetch.continueRequest',{requestId});else {blocked.push({method:request.method,path:url.pathname});await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
    })().catch(()=>{failure='Browser request guard failed';});
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await send('Runtime.addBinding',{name:'checkupinoRestoreProbe'});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'for(const type of ["pagehide","pageshow"])addEventListener(type,e=>{if(e.persisted){const root=document.getElementById("root");window.checkupinoRestoreProbe(JSON.stringify({type,persisted:e.persisted,path:location.pathname,rootPresent:!!root,rootHidden:root?.hidden===true}));}});'});











  const closeNavigationOverlay=async()=>{
    if(await evaluate('!!document.querySelector(".offcanvas")'))await clearCustomizer();
    if(await evaluate('!!document.querySelector(".layout-rightside-col.d-block .overlay")')){
      await click('.layout-rightside-col.d-block .overlay');
      await wait('!document.querySelector(".layout-rightside-col.d-block .overlay")','home drawer dismissed');
    }
    await noOverlay();
  };
  const nativeSelect=async(selector,steps)=>{
    await click(selector);
    for(let i=0;i<steps;i++){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});}
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  };





  await runClinicalOnboardingBrowser({send,evaluate,wait,navigate,login,logout,locale,copy,record,screenshot,clickText,click,api,nativeSelect,closeNavigationOverlay,baseline,setValue,pointerExpression,setPhase:value=>{phase=value;}});
  finalState=snapshot();assert.deepEqual(finalState.hashes,baseline.hashes);assert.deepEqual(finalState.catalog_hashes,baseline.catalog_hashes);assert.deepEqual(finalState.finance_hashes,baseline.finance_hashes);
  assert.equal(exceptions.length,0);assert.equal(external.length,0);assert.equal(blocked.length,0);
  assert.ok(responses.every(r=>r.status<500),'Unexpected server error during integrated navigation');
  assert.ok(networkFailures.every(r=>r.canceled),'Unexpected failed API transport during integrated navigation');
  assert.ok(requests.every(r=>['GET','OPTIONS'].includes(r.method)||['/login','/logout'].includes(r.path)));
  record('All accepted clinical/payment/questionnaire/audit/outbox/protected fingerprints unchanged; no job or business write');
}catch(error){failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure}));try{console.log(JSON.stringify({dom_diagnostic:await evaluate('({path:location.pathname,editors:Array.from(document.querySelectorAll("[data-questionnaire-rich-text]")).map(e=>({id:e.dataset.questionnaireRichText,alert:e.querySelector("[role=alert]")?.textContent,editable:e.querySelector("[contenteditable]")?.outerHTML.slice(0,250)})),count:document.querySelectorAll(".ck-editor__editable").length})')}));}catch{}}
finally{
 if(failure&&ws?.readyState===WebSocket.OPEN){try{if(await evaluate('!!document.querySelector("dialog[open]")')){const lang=await evaluate('document.documentElement.lang');await clickText(copy[lang]['adminManage.close']);await wait('!document.querySelector("dialog[open]")','failure closes preview');}if(await evaluate("!!document.querySelector('.topbar-user')")){if(await evaluate('!!document.querySelector(".offcanvas")'))await clearCustomizer();await logout();}}catch{}}
 try{finalState??=snapshot();assert.deepEqual(finalState.hashes,baseline.hashes);assert.deepEqual(finalState.catalog_hashes,baseline.catalog_hashes);assert.deepEqual(finalState.finance_hashes,baseline.finance_hashes);}catch{failure??='Final immutable fingerprints failed';process.exitCode=1;}
 const target=failure?evidencePath.replace('.json','-failed-'+Date.now()+'.json'):evidencePath;
 if(failure)process.exitCode=1;
 writeFileSync(target,JSON.stringify({checked_at:new Date().toISOString(),acceptance:failure?'failed':'passed',image:staticProof.image,phase,failure,checks,requests,responses,exceptions,external,blocked,networkFailures,baseline,final:finalState,screenshots,geometryChecks,releaseVisits,apiChecks,calendarLabels,historyEvents,scope: "Approved doctor/patient/hospital creation routes, existing hospital detail/card edit and doctor multi-location/service-price controls; admin/root/doctor/patient ENFA desktop/mobile, ordinary login/logout and GET only. All forms/modal drafts canceled; no onboarding, schedule, credential, password, download, scanner or queue write."},null,2)+'\n',{flag:'wx'});
 if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}for(const item of pending.values())clearTimeout(item.timer);browser.kill();
 for(let i=0;i<50;i++){try{assert.equal(realpathSync(dirname(profile)),realpathSync(tmpdir()));assert.equal(realpathSync(profile),resolve(profile));assert.match(basename(profile),/^checkupino-admin-medical-questionnaire-browser-[\w-]+$/);rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
}


