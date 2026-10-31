import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'No endpoint/account overrides accepted.');
assert.ok(!existsSync('docs/deployment/evidence/panel-release-pointer-2026-10-17.json'),'Evidence exists; inspect it instead of overwriting.');

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
const previous=JSON.parse(readFileSync('docs/deployment/evidence/demo-appointment-completed-final-2026-10-11.json','utf8'));assert.equal(previous.acceptance,'passed');assert.deepEqual(baseline.hashes,previous.final.hashes);
for(const actor of baseline.accounts){assert.ok([1,2,3,4,5].includes(actor.id));assert.match(actor.email,/@checkupino\.test$/);}
assert.ok(baseline.accounts.find(a => a.id === 2)?.roles.includes('admin'));
assert.ok(baseline.accounts.find(a => a.id === 1)?.roles.includes('root-admin'));
const staticProof = JSON.parse(readFileSync('docs/deployment/evidence/panel-release-ready-static-2026-10-17.json','utf8'));
assert.equal(staticProof.acceptance,'passed');
assert.equal(JSON.parse(spawnSync('docker',['inspect','--format','{{json .Image}}','checkupino_prod-admin-1'],{encoding:'utf8',windowsHide:true,timeout:10000}).stdout),staticProof.image);
const profile = mkdtempSync(join(tmpdir(), 'checkupino-admin-medical-questionnaire-browser-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--incognito', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-sync', '--window-size=1440,1000', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const copy = Object.fromEntries(['en','fa'].map(lang => [lang, JSON.parse(readFileSync(`frontend/src/locales/${lang}.json`, 'utf8'))]));
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/panel-release-pointer-2026-10-17.json', import.meta.url));
const pending = new Map(), network = new Map(), requests = [], responses = [], exceptions = [], external = [], checks = [], blocked = [], networkFailures=[];
let ws, sequence = 0, phase = 'setup', failure = null, finalState = null;
const runStamp=Date.now(),screenshots=[],geometryChecks=[],releaseVisits=[],apiChecks=[],calendarLabels=[];
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
const clickText = label => pointerExpression('Array.from(document.querySelectorAll(".page-content button,dialog[open] button")).find(b=>b.textContent.trim()==='+JSON.stringify(label)+'&&!b.disabled)');
const clearCustomizer = async () => {
  await wait('document.querySelector(".offcanvas.show .btn-close")', 'customizer opening transition');
  await click('.offcanvas.show .btn-close');
  await wait('!document.querySelector(".offcanvas")&&!document.querySelector(".offcanvas-backdrop")&&document.body.style.overflow!=="hidden"', 'customizer fully closed');
};
const noOverlay = async () => assert.equal(await evaluate('Array.from(document.querySelectorAll(".offcanvas-backdrop,.modal-backdrop,.vertical-overlay,.layout-rightside-col .overlay")).filter(e=>!(document.querySelector("dialog[open] [data-general-setting-preview],dialog[open] [data-payment-adjustment-preview]")&&e.matches("[data-overlay=dialog] > .modal-backdrop"))&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=="hidden"&&getComputedStyle(e).display!=="none"&&Number(getComputedStyle(e).opacity)>0).length'),0);
const screenshot = async (kind,lang) => {
  await noOverlay();await evaluate('document.fonts.ready.then(()=>{window.scrollTo({top:0,left:0,behavior:"instant"});return true})');
  await wait('scrollX===0&&scrollY===0&&document.querySelector("#page-topbar").getBoundingClientRect().top===0','capture scroll origin');await delay(500);
  const viewport=await evaluate('({width:innerWidth,height:innerHeight})');
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width:viewport.width,height:viewport.height,scale:1}});
  const relative='../../docs/deployment/evidence/panel-release-pointer-'+kind+'-'+lang+'-'+runStamp+'-2026-10-17.png';
  writeFileSync(fileURLToPath(new URL(relative,import.meta.url)),Buffer.from(shot.data,'base64'),{flag:'wx'});screenshots.push(relative.replace('../../',''));
};
const calendarScreenshot=async(kind,lang)=>{
 await noOverlay();await evaluate('(()=>{const e=document.querySelector("[data-dashboard-section=appointments]");window.scrollTo({top:e.getBoundingClientRect().top+scrollY-90,left:0,behavior:"instant"});return true})()');await delay(400);
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const relative='../../docs/deployment/evidence/panel-release-pointer-'+kind+'-'+lang+'-'+runStamp+'-2026-10-17.png';writeFileSync(fileURLToPath(new URL(relative,import.meta.url)),Buffer.from(shot.data,'base64'),{flag:'wx'});screenshots.push(relative.replace('../../',''));
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




  const requestCheck=async(path,status=200)=>{
    const response=await api(path);assert.equal(response.status,status,'HTTP contract '+path);
    apiChecks.push({actor:phase,path,status});return response;
  };
  const viewportCheck=async(label)=>{
    await closeNavigationOverlay();await evaluate('document.fonts.ready');await delay(100);
    const g=await evaluate('(()=>{const r=document.querySelector(".main-content").getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,main:{left:r.left,right:r.right},cards:Array.from(document.querySelectorAll(".page-content .card")).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}}),dir:document.documentElement.dir,locale:document.documentElement.lang};})()');
    assert.ok(g.scrollWidth<=g.width+1,'Viewport overflow '+label+' '+JSON.stringify(g));
    assert.ok(g.main.left>=-1&&g.main.right<=g.width+1,'Main content outside viewport '+label);
    assert.ok(g.cards.every(r=>r.left>=-1&&r.right<=g.width+1),'Card outside viewport '+label);
    assert.equal(g.dir,g.locale==='fa'?'rtl':'ltr');return g;
  };
  const visit=async(def,anchor=null)=>{
    const start=Date.now(),offset=responses.length;
    if(anchor)await pointerExpression(anchor);else await navigate(def.path);
    const path=new URL(def.path,'http://localhost:3000').pathname;
    await wait('location.pathname==='+JSON.stringify(path)+'&&document.querySelector('+JSON.stringify(def.selector)+')',def.name+' rendered');
    const until=Date.now()+25000;
    while(def.api&&!responses.slice(offset).some(r=>r.path===def.api&&r.status===200)){
      assert.ok(Date.now()<until,'Completed page read missing '+def.name);await delay(100);
    }
    await wait('!Array.from(document.querySelectorAll(".page-content output")).some(e=>e.textContent.trim()==='+JSON.stringify(copy[await evaluate('document.documentElement.lang')]['adminReservations.loading'])+')',def.name+' finished loading');
    const errors=await evaluate('Array.from(document.querySelectorAll(".page-content .alert-danger,.page-content [role=alert]")).map(e=>e.textContent.trim())');
    assert.deepEqual(errors,[],def.name+' page error');
    const geometry=await viewportCheck(def.name);
    releaseVisits.push({actor:phase,name:def.name,path,ready_ms:Date.now()-start,geometry});
    record(phase+' '+def.name+' completed read/render and viewport');
  };
  const reservation={name:'reservation list',path:'/panel/reservations',selector:'.page-content tbody tr',api:'/api/admin/reservations'};
  const reservationDetail={name:'reservation boxes',path:'/panel/reservations/8',selector:'#reservation-appointment',api:'/api/admin/reservations/8'};
  const medical={name:'medical requests',path:'/panel/medical-requests',selector:'.page-content tbody tr',api:'/api/admin/medical-requests'};
  const medId='01m4hfgan168p6q5ftp528285f';
  const medDetail={name:'medical detail',path:'/panel/medical-requests/'+medId,selector:'.page-content a[href*="/download"]',api:'/api/admin/medical-requests/'+medId};
  const questionnaires={name:'questionnaires',path:'/panel/questionnaires',selector:'.page-content tbody tr',api:'/api/admin/questionnaires'};
  const submissions={name:'saved questionnaire submissions',path:'/panel/questionnaire-submissions',selector:'.page-content tbody tr',api:'/api/admin/questionnaire-submissions'};
  const profileDef={name:'own profile',path:'/panel/profile',selector:'#profile-overview-identity',api:'/api/panel-profile'};
  const collections=[
    reservation,medical,questionnaires,submissions,
    {name:'doctor directory',path:'/panel/doctors',selector:'#userList tbody tr',api:'/api/admin/users'},
    {name:'patient directory',path:'/panel/patients',selector:'#userList tbody tr',api:'/api/admin/users'},
    {name:'activity',path:'/panel/activity',selector:'[data-activity-period]',api:'/api/admin/activity'},
    ...[['checkups','checkups'],['checkup-categories','categories'],['specialties','specialties']].map(([path,name])=>({name,path:'/panel/'+path,selector:'[data-catalog-generated]',api:'/api/admin/'+path})),
    {name:'schedules',path:'/panel/schedules',selector:'[data-schedule-kind=workplaces] [data-schedule-generated]',api:'/api/admin/schedules/workplaces'},
    {name:'payments',path:'/panel/payments',selector:'[data-payment-kind=payments] [data-payment-generated]',api:'/api/admin/payments'}
  ];
  const goBack=async(def)=>{
    const label=copy[await evaluate('document.documentElement.lang')]['adminManage.back'];
    const exp='Array.from(document.querySelectorAll(".page-content a")).find(a=>a.textContent.trim()==='+JSON.stringify(label)+')';
    if(await evaluate('!!('+exp+')'))await visit(def,exp);else await visit(def);
  };
  const drill=async(parent,detail)=>{
    const exp='Array.from(document.querySelectorAll(".page-content a")).find(a=>a.pathname==='+JSON.stringify(new URL(detail.path,'http://localhost:3000').pathname)+')';
    await visit(detail,exp);
    const lang=await evaluate('document.documentElement.lang');
    if(detail.name==='visual questionnaire boxes/editor'){await wait('document.querySelector(".ck-editor__editable")','visual editor runtime');assert.ok(!(await text()).includes('(HTML source)'));await screenshot('questionnaire-'+phase,lang);}
    if(detail.name==='saved answer boxes'){assert.equal(await evaluate('document.querySelectorAll("[data-questionnaire-answer]").length'),3);await screenshot('answers-'+phase,lang);}
    await goBack(parent);
  };
  const controls=async(lang,width)=>{
    await visit({name:'root general settings',path:'/panel/settings/general',selector:'[data-general-setting=hold]',api:'/api/admin/settings/general'});
    await setValue('#general-hold','61');await pointerExpression('document.querySelector("[data-general-setting=hold] button.btn-primary")');
    await wait('document.querySelector("dialog[open] [data-general-setting-preview]")','general settings guarded preview');
    assert.equal(await evaluate('document.querySelector("dialog button[type=submit]").disabled'),true);
    await screenshot('root-settings-cancel-'+width,lang);await clickText(copy[lang]['adminManage.close']);await wait('!document.querySelector("dialog")','settings cancel');
    const payment=JSON.parse(readFileSync('docs/deployment/evidence/panel-release-ready-runtime-2026-10-17.json','utf8')).payment_public_id;
    await visit({name:'root payment history',path:'/panel/payments/'+payment,selector:'[data-payment-boxes]',api:'/api/admin/payments/'+payment});
    await click('[data-payment-adjustment-open]');await wait('document.querySelector("dialog[open] [data-payment-adjustment-preview]")','root request preview');
    assert.equal(await evaluate('document.querySelector("dialog button[type=submit]").disabled'),true);
    await screenshot('root-refund-cancel-'+width,lang);await clickText(copy[lang]['adminManage.close']);await wait('!document.querySelector("dialog")','refund cancel');
    record(phase+' root settings/refund fresh previews require reason/confirmation/password; canceled without saving');
  };
  await login(1,'/panel/');await closeNavigationOverlay();
  const defs=await requestCheck('/api/admin/questionnaires');const def=defs.data.data.find(x=>x.slug==='demo-heart-health-screen');assert.equal(def.version,1);
  const saved=await requestCheck('/api/admin/questionnaire-submissions?user_id=4&questionnaire_id='+def.id+'&version=1&owner_type=account&score_min=2&score_max=2');assert.equal(saved.data.data.length,1);
  const receipt=saved.data.data[0];assert.equal(receipt.user_id,4);assert.equal(receipt.questionnaire_version,1);
  const qDetail={name:'visual questionnaire boxes/editor',path:'/panel/questionnaires/'+def.id,selector:'#questionnaire-definition',api:'/api/admin/questionnaires/'+def.id};
  const sDetail={name:'saved answer boxes',path:'/panel/questionnaire-submissions/'+receipt.public_id,selector:'[data-questionnaire-answer]',api:'/api/admin/questionnaire-submissions/by-public-id/'+receipt.public_id};
  const payment=JSON.parse(readFileSync('docs/deployment/evidence/panel-release-ready-runtime-2026-10-17.json','utf8')).payment_public_id;
  const extras=[
    [reservation,reservationDetail],[medical,medDetail],[questionnaires,qDetail],[submissions,sDetail],
    [collections.find(x=>x.name==='schedules'),{name:'schedule rule/slot boxes',path:'/panel/schedules/workplaces/3',selector:'[data-schedule-kind=slots] [data-schedule-generated]',api:'/api/admin/schedules/workplaces/3'}],
    [collections.find(x=>x.name==='payments'),{name:'payment boxes/histories',path:'/panel/payments/'+payment,selector:'[data-payment-boxes]',api:'/api/admin/payments/'+payment}]
  ];
  await logout();
  const medicalView=async(id,lang,width)=>{
    const prefix=id===4?'my':'doctor';const path='/panel/'+prefix+'/reservations/'+baseline.reservation+'/medical';
    await navigate('/panel/'+prefix+'/reservations');await wait('document.querySelector(".page-content tbody tr")','clinical reservations');
    const link='document.querySelector('+JSON.stringify('a[href="'+path+'"]')+')';
    await pointerExpression(link);await wait('document.querySelector(".file-manager-sidebar")','retained File Manager');
    if(width<992)await pointerExpression('Array.from(document.querySelectorAll(".file-manager-content button")).find(b=>b.getAttribute("aria-label")==='+JSON.stringify(copy[lang]['medical.requests'])+')');
    await pointerExpression('Array.from(document.querySelectorAll(".file-manager-menu button")).find(b=>b.textContent.trim()==='+JSON.stringify(baseline.request_title)+')');
    await clickText(copy[lang]['medical.reports']);await wait('document.querySelector(".file-manager-detail-content")','published history');
    await wait('document.querySelector(".page-content").textContent.includes("Synthetic demo report.")&&document.querySelector(".page-content").textContent.includes("Synthetic demo amendment.")','published report and amendment');
    assert.ok(await evaluate('Array.from(document.querySelectorAll(".file-manager-detail-content pre")).every(e=>e.dir==="auto"&&getComputedStyle(e).direction==="ltr")'),'English clinical text must retain its own direction in either shell language');
    await viewportCheck('clinical File Manager');await screenshot('clinical-'+id+'-'+width,lang);
    await send('Page.reload');await wait('document.querySelector(".file-manager-sidebar")','File Manager refresh');record(phase+' ordinary medical navigation/published history/refresh');
  };
  for(const id of [5,4]){
    await login(id,id===5?'/panel/doctor/reservations':'/panel/book');await closeNavigationOverlay();
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:false});
      for(const lang of ['en','fa']){
        phase='clinical-'+id+'-'+lang+'-'+width;await closeNavigationOverlay();await locale(lang);
        await medicalView(id,lang,width);
        await visit(profileDef);await screenshot('owner-'+id+'-'+width,lang);
        const own=await requestCheck('/api/panel-profile');assert.equal(own.data.data.user.id,id);
        for(const denied of ['/api/admin/reservations','/api/admin/medical-requests','/api/admin/questionnaires','/api/admin/users','/api/admin/payments','/api/admin/settings/general','/api/admin/dashboard'])await requestCheck(denied,403);
        if(id===4){
          await visit({name:'fixed patient questionnaire',path:'/panel/my/questionnaire',selector:'.page-content form input[type=radio]',api:'/api/questionnaires/demo-heart-health-screen'});
          assert.equal(await evaluate('document.querySelectorAll(".page-content input[type=radio]").length'),9);await screenshot('patient-questionnaire-'+width,lang);
          await visit({name:'patient booking discovery',path:'/panel/book',selector:'#booking-checkup option[value="5"]',api:'/api/checkups'});
          const available=await requestCheck('/api/doctors/2/availability?checkup_id=5&workplace_id=3');assert.ok(available.data.data.some(s=>Date.parse(s.start)>Date.now()&&s.price===7000000&&s.currency==='IRR'));
        }
        await requestCheck('/api/'+(id===4?'':'doctor/')+'reservations/not-a-real-reservation/medical-requests',404);
      }
    }
    await send('Emulation.clearDeviceMetricsOverride');await logout();
  }
  for(const actor of [1,2]){
    await login(actor,'/panel/');await closeNavigationOverlay();
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:false});
      for(const lang of ['en','fa']){
        phase='admin-'+actor+'-'+lang+'-'+width;await closeNavigationOverlay();await locale(lang);
        await visit({name:'dashboard reports/calendar',path:'/panel/',selector:'[data-calendar-generated]',api:'/api/admin/dashboard'});
        await wait('document.querySelector(".apexcharts-svg")&&document.querySelector(".fc-daygrid")','dashboard charts and appointments');
        assert.equal(await evaluate('document.querySelectorAll("[data-dashboard-section]").length'),10);
        assert.equal(await evaluate('!!document.querySelector("[data-dashboard-section] input[type=search]")'),false);
        const labels=await evaluate('Array.from(document.querySelectorAll(".fc-col-header-cell")).map(th=>{const compact=th.querySelector("span[title]"),full=th.querySelector(".d-sm-inline"),sr=th.querySelector(".visually-hidden"),label=compact&&getComputedStyle(compact).display!=="none"?compact:full??th.querySelector(".fc-col-header-cell-cushion"),r=label.getBoundingClientRect(),cell=th.getBoundingClientRect();return {compact:compact?.textContent??null,title:compact?.title??null,sr:sr?.textContent??null,hidden:compact?.getAttribute("aria-hidden")??null,compactDisplay:compact?getComputedStyle(compact).display:null,fullDisplay:full?getComputedStyle(full).display:null,width:r.width,cellWidth:cell.width};})');
        assert.equal(labels.length,7);
        if(lang==='fa'){
          assert.equal(new Set(labels.map(row=>row.compact)).size,7);
          for(const row of labels){assert.equal(row.hidden,'true');assert.equal(row.sr,row.title);assert.ok(row.width<=row.cellWidth+1,'Weekday text overflows its day column');assert.equal(row.compactDisplay==='none',width>=576);assert.equal(row.fullDisplay==='none',width<576);}
        }else assert.ok(labels.every(row=>row.compact===null));
        calendarLabels.push({phase,width,lang,labels});
        await calendarScreenshot('dashboard-'+actor+'-'+width,lang);
        if(width===1440&&lang==='fa')await measuredMirror('dashboard-'+actor+'-'+width);
        for(const page of collections){
          const sidebar='Array.from(document.querySelectorAll(".app-menu a")).find(a=>a.pathname==='+JSON.stringify(page.path)+')';
          await visit(page,width===1440?sidebar:null);
          if(['checkups','categories','specialties'].includes(page.name)){
            const target=await evaluate('Array.from(document.querySelectorAll(".page-content tbody a")).find(a=>a.pathname.startsWith('+JSON.stringify(page.path+'/')+'))?.pathname');
            assert.ok(target,'Catalog detail link missing '+page.name);
            await drill(page,{name:page.name+' detail boxes',path:target,selector:'.page-content section.card',api:'/api/admin'+target.slice('/panel'.length)});
          }
          const detail=extras.find(([parent])=>parent.path===page.path)?.[1];
          if(detail)await drill(page,detail);
        }
        await visit(profileDef);await screenshot('profile-'+actor+'-'+width,lang);
        for(const [directory,id]of [['patients',4],['doctors',5]]){
          const subject=baseline.accounts.find(a=>a.id===id);
          const support={name:directory+' metadata support',path:'/panel/users/'+subject.public_id,selector:'#profile-overview-identity',api:'/api/admin/users/'+subject.public_id+'/support-profile'};
          await visit(support);const p=await requestCheck(support.api);const raw=JSON.stringify(p.data);
          for(const key of ['password','remember_token','email_verified_at','body_html','answers_json','checksum_sha256','storage_path'])assert.ok(!raw.includes('"'+key+'"'),'Private support key '+key);
          await screenshot('support-'+directory+'-'+actor+'-'+width,lang);
        }
        if(actor===1){
          await visit({name:'root staff directory',path:'/panel/users',selector:'#userList tbody tr',api:'/api/admin/staff'});
          const staff=await requestCheck('/api/admin/staff');assert.ok(staff.data.data.users.every(u=>u.role==='admin'&&u.email===null&&u.phone===null));
          await visit({name:'root upload limits',path:'/panel/upload-limits',selector:'[id$="-form"]',api:'/api/admin/settings/uploads.medical'});
          await controls(lang,width);
        }else{
          for(const path of ['/panel/users','/panel/settings/general','/panel/upload-limits'])assert.equal(await evaluate('Array.from(document.querySelectorAll(".app-menu a")).some(a=>a.pathname==='+JSON.stringify(path)+')'),false);
          await requestCheck('/api/admin/staff',403);await requestCheck('/api/admin/settings/general',403);
        }
      }
    }
    await send('Emulation.clearDeviceMetricsOverride');await logout();
  }
  await login(3,'/panel/doctor/reservations');await closeNavigationOverlay();phase='unassigned-doctor-3';
  await requestCheck('/api/doctor/reservations/'+baseline.reservation+'/medical-requests',404);
  await navigate('/panel/doctor/reservations/'+baseline.reservation+'/medical');
  await wait('document.querySelector(".page-content [role=alert]")','unassigned medical denial');
  assert.ok(!(await text()).includes('Synthetic demo report.'));record('Unassigned doctor cannot read the accepted patient medical history');await logout();
  phase='guest';await navigate('/panel/reservations/8');await wait('location.pathname==="/panel/login"&&document.querySelector("#email")','guest deep link login');
  await navigate('/panel/questionnaires/1');await wait('location.pathname==="/panel/login"&&document.querySelector("#email")','guest editor deep link login');
  record('Guest clinical/editor deep links return to login; session changes leave no protected content');
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
 writeFileSync(target,JSON.stringify({checked_at:new Date().toISOString(),acceptance:failure?'failed':'passed',image:staticProof.image,phase,failure,checks,requests,responses,exceptions,external,blocked,networkFailures,baseline,final:finalState,screenshots,geometryChecks,releaseVisits,apiChecks,calendarLabels,scope: "Combined release rehearsal of final artifact: root/admin/doctor/patient/guest, ENFA desktop390px, completed API reads and rendered pages, native sidebar/detail/Back and medical navigation, dashboard/chart/calendar, catalogs/schedules/payments/settings/staff, questionnaire editor/saved-answer grids and private support/owner profiles. Fresh previews canceled; no password confirmation/business write/download/definition/worker/provider/queue operation. Synthetic immutable before/after data checked; isolated concurrency proof retained separately."},null,2)+'\n',{flag:'wx'});
 if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}for(const item of pending.values())clearTimeout(item.timer);browser.kill();
 for(let i=0;i<50;i++){try{assert.equal(realpathSync(dirname(profile)),realpathSync(tmpdir()));assert.equal(realpathSync(profile),resolve(profile));assert.match(basename(profile),/^checkupino-admin-medical-questionnaire-browser-[\w-]+$/);rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
}

