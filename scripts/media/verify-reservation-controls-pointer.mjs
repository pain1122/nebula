import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'No endpoint/account overrides accepted.');
assert.ok(!existsSync('docs/deployment/evidence/reservation-controls-pointer-2026-10-13.json'),'Evidence exists; inspect it instead of overwriting.');

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
const staticProof = JSON.parse(readFileSync('docs/deployment/evidence/reservation-controls-static-2026-10-13.json','utf8'));
assert.equal(staticProof.acceptance,'passed');
assert.equal(JSON.parse(spawnSync('docker',['inspect','--format','{{json .Image}}','checkupino_prod-admin-1'],{encoding:'utf8',windowsHide:true,timeout:10000}).stdout),staticProof.image);
const profile = mkdtempSync(join(tmpdir(), 'checkupino-admin-medical-questionnaire-browser-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--incognito', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-sync', '--window-size=1440,1000', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const copy = Object.fromEntries(['en','fa'].map(lang => [lang, JSON.parse(readFileSync(`frontend/src/locales/${lang}.json`, 'utf8'))]));
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/reservation-controls-pointer-2026-10-13.json', import.meta.url));
const pending = new Map(), network = new Map(), requests = [], responses = [], exceptions = [], external = [], checks = [], blocked = [];
let ws, sequence = 0, phase = 'setup', failure = null, finalState = null;
const runStamp=Date.now(),screenshots=[],geometryChecks=[];
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
    const candidate=await evaluate(`(()=>{const e=${expression};if(!e||e.disabled)return null;e.scrollIntoView({block:'center',inline:'nearest'});for(const r of e.getClientRects()){const x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(r.width>0&&r.height>0&&hit&&e.contains(hit))return {x,y};}return null;})()`);
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
const noOverlay = async () => assert.equal(await evaluate('Array.from(document.querySelectorAll(".offcanvas-backdrop,.modal-backdrop,.vertical-overlay,.layout-rightside-col .overlay")).filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=="hidden"&&getComputedStyle(e).display!=="none"&&Number(getComputedStyle(e).opacity)>0).length'),0);
const screenshot = async (kind,lang) => {
  await noOverlay();await evaluate('document.fonts.ready.then(()=>{window.scrollTo({top:0,left:0,behavior:"instant"});return true})');
  await wait('scrollY===0&&document.querySelector("#page-topbar").getBoundingClientRect().top===0','capture scroll origin');await delay(100);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  const relative='../../docs/deployment/evidence/reservation-controls-pointer-'+kind+'-'+lang+'-'+runStamp+'-2026-10-13.png';
  writeFileSync(fileURLToPath(new URL(relative,import.meta.url)),Buffer.from(shot.data,'base64'),{flag:'wx'});screenshots.push(relative.replace('../../',''));
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
    samples[lang]=await evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};const selectors=['.main-content','#page-topbar','.app-menu','.footer','.page-content section.card'];return {width:document.documentElement.clientWidth,windowWidth:innerWidth,root:{...document.documentElement.dataset},boxes:selectors.map(s=>({selector:s,...rect(document.querySelector(s))})),breadcrumb:getComputedStyle(document.querySelector('.breadcrumb-item.active'),'::before').content,logoTransform:getComputedStyle(document.querySelector('.navbar-brand-box img')).transform,cards:Array.from(document.querySelectorAll('.page-content section.card')).map(rect),scrollWidth:document.documentElement.scrollWidth}})()`);
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
  assert.notEqual(samples.en.breadcrumb,samples.fa.breadcrumb,'Breadcrumb horizontal arrow must reverse');
  record(label+' mirrored shell/cards/breadcrumb/logo and actual language menu flag spacing');
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









  const patient=baseline.accounts.find(a=>a.id===4),doctor=baseline.accounts.find(a=>a.id===5);
  assert.ok(patient&&doctor);
  const replaceInput=async(selector,value)=>{
    await click(selector);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
    await send('Input.insertText',{text:value});
  };
  const closeNavigationOverlay=async()=>{
    if(await evaluate('!!document.querySelector(".offcanvas")'))await clearCustomizer();
    if(await evaluate('!!document.querySelector(".layout-rightside-col.d-block .overlay")')){
      await click('.layout-rightside-col.d-block .overlay');
      await wait('!document.querySelector(".layout-rightside-col.d-block .overlay")','home activity drawer dismissed');
    }
    await noOverlay();
  };
  const ready=async()=>{await wait('document.querySelector("#profile-overview-identity")&&!document.querySelector(".page-content [role=alert]")','profile overview');await closeNavigationOverlay();};
  for(const id of [2,1]){
    await login(id,'/panel/');await closeNavigationOverlay();
    for(const lang of ['en','fa']){
      phase='reservation-controls-'+id+'-'+lang;await locale(lang);
      await navigate('/panel/reservations/8?doctor_id=2');await closeNavigationOverlay();
      await wait('document.querySelector("[data-reservation-actions]")','terminal controls');
      const terminal=await api('/api/admin/reservations/8');
      assert.equal(terminal.status,200);assert.equal(terminal.data.data.actions.can_reschedule,false);
      assert.deepEqual(terminal.data.data.actions.allowed_statuses,[]);
      assert.match(terminal.data.data.actions.revision,/^[a-f0-9]{64}$/);
      const buttons=await evaluate('Array.from(document.querySelectorAll("[data-reservation-actions] button")).map(b=>({text:b.textContent.trim(),disabled:b.disabled}))');
      assert.equal(buttons.length,id===1?2:1);assert.ok(buttons.every(b=>b.disabled));
      record('Admin '+id+' '+lang+' completed reservation shows current disabled controls; root-only override stays scoped');
      await navigate('/panel/reservations/3?user_id=4');await closeNavigationOverlay();
      await wait('document.querySelector("[data-reservation-actions]")','eligible controls');
      const detail=await api('/api/admin/reservations/3');
      assert.equal(detail.status,200);assert.equal(detail.data.data.patient.id,4);assert.equal(detail.data.data.actions.can_reschedule,true);
      await clickText(copy[lang]['reservationActions.reschedule']);
      await wait('document.querySelector("#reschedule-slot")&&!document.querySelector("#reschedule-slot").disabled','real slot reader');
      const slotData=await evaluate('(()=>{const s=document.querySelector("#reschedule-slot");return {options:Array.from(s.options).map(o=>({value:o.value,text:o.textContent})),from:document.querySelector("#reschedule-from").value,to:document.querySelector("#reschedule-to").value}})()');
      const available=await api('/api/admin/reservations/3/reschedule-slots?from='+slotData.from+'&to='+slotData.to+'&page=1&per_page=20');
      assert.equal(available.status,200);assert.equal(available.data.data.reservation_id,3);
      assert.equal(available.data.data.booked_amount,detail.data.data.booked_amount);
      assert.equal(available.data.data.actions.revision,detail.data.data.actions.revision);
      assert.ok(slotData.options.slice(1).every(o=>available.data.data.items.some(s=>s.slot_id===o.value)));
      assert.equal(await evaluate('document.querySelector("dialog[open] button[type=submit]").disabled'),true);
      if(available.data.data.items.length){
        await click('#reschedule-slot');
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        await wait('!!document.querySelector("#reschedule-slot").value','native slot selection');
        const chosen=await evaluate('document.querySelector("#reschedule-slot").value');assert.ok(available.data.data.items.some(s=>s.slot_id===chosen));
      }
      await click('#reservation-action-reason');await send('Input.insertText',{text:'Synthetic read-only control rehearsal.'});
      assert.equal(await evaluate('document.querySelector("dialog[open] button[type=submit]").disabled'),true);
      await clickText(copy[lang]['adminManage.close']);await wait('!document.querySelector("dialog[open]")','reschedule cancellation');
      await clickText(copy[lang]['adminReservations.refresh']);await wait('document.querySelector("[data-reservation-actions]")','fresh detail');
      record('Admin '+id+' '+lang+' actual reschedule dialog/real bounded slot read/booked-money/native selection/reason/cancel/fresh reset; no save');
      if(id===1){
        await clickText(copy[lang]['reservationActions.override']);await wait('document.querySelector("#reservation-override-state")','root override');
        const states=await evaluate('Array.from(document.querySelector("#reservation-override-state").options).map(o=>o.value).filter(Boolean)');
        assert.deepEqual(states,detail.data.data.actions.allowed_statuses);assert.ok(!states.includes('paid')&&!states.includes('pending'));
        await click('#reservation-override-state');
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        await click('#reservation-action-reason');await send('Input.insertText',{text:'Synthetic unsaved root reason.'});
        await click('#reservation-action-confirm');
        assert.equal(await evaluate('document.querySelector("dialog[open] button[type=submit]").disabled'),false);
        await clickText(copy[lang]['adminManage.close']);await wait('!document.querySelector("dialog[open]")','root cancellation');
        record('Root '+lang+' only current permitted states/explicit reason-confirmation/native cancellation; no status delivery');
      }
      await screenshot('reservation-'+id,lang);
      await pointerExpression('Array.from(document.querySelectorAll(".page-content a")).find(a=>a.textContent.trim()==='+JSON.stringify(copy[lang]['adminReservations.back'])+')');
      await wait('location.pathname==="/panel/reservations"&&document.querySelector(".page-content table")','reservation Back');
      assert.equal(await evaluate('new URLSearchParams(location.search).get("user_id")'),'4');
    }
    await logout();
  }
  await login(1,'/panel/');await closeNavigationOverlay();
  await navigate('/panel/reservations/3');await closeNavigationOverlay();await wait('document.querySelector("[data-reservation-actions]")','mobile controls');
  await measuredMirror('Reservation detail desktop');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(300);await measuredMirror('Reservation detail mobile 390px');
  for(const lang of ['en','fa']){
    await locale(lang);await clickText(copy[lang]['reservationActions.reschedule']);
    await wait('document.querySelector("#reschedule-slot")&&!document.querySelector("#reschedule-slot").disabled','mobile slots');
    const shape=await evaluate('(()=>{const r=document.querySelector("dialog .modal-content").getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,scroll:document.documentElement.scrollWidth}})()');
    assert.ok(shape.left>=-1&&shape.right<=shape.width+1);assert.ok(shape.scroll<=shape.width+1);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const path='docs/deployment/evidence/reservation-controls-modal-mobile-'+lang+'-'+runStamp+'-2026-10-13.png';
    writeFileSync(path,Buffer.from(shot.data,'base64'),{flag:'wx'});screenshots.push(path);
    await clickText(copy[lang]['adminManage.close']);await wait('!document.querySelector("dialog[open]")','mobile cancellation');
    record('Root '+lang+' 390px reschedule modal fits viewport and cancels without delivery');
  }
  await send('Emulation.clearDeviceMetricsOverride');await logout();

  finalState=snapshot();assert.deepEqual(finalState.hashes,baseline.hashes);
  assert.equal(exceptions.length,0);assert.equal(external.length,0);assert.equal(blocked.length,0);
  assert.ok(requests.every(r=>['GET','OPTIONS'].includes(r.method)||['/login','/logout'].includes(r.path)));
  record('All accepted clinical/payment/questionnaire/audit/outbox/protected fingerprints unchanged; no job or business write');
}catch(error){failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure}));try{console.log(JSON.stringify({dom_diagnostic:await evaluate('({path:location.pathname,editors:Array.from(document.querySelectorAll("[data-questionnaire-rich-text]")).map(e=>({id:e.dataset.questionnaireRichText,alert:e.querySelector("[role=alert]")?.textContent,editable:e.querySelector("[contenteditable]")?.outerHTML.slice(0,250)})),count:document.querySelectorAll(".ck-editor__editable").length})')}));}catch{}}
finally{
 if(failure&&ws?.readyState===WebSocket.OPEN){try{if(await evaluate("!!document.querySelector('.topbar-user')")){if(await evaluate('!!document.querySelector(".offcanvas")'))await clearCustomizer();await logout();}}catch{}}
 try{finalState??=snapshot();assert.deepEqual(finalState.hashes,baseline.hashes);}catch{failure??='Final immutable fingerprints failed';process.exitCode=1;}
 const target=failure?evidencePath.replace('.json','-failed-'+Date.now()+'.json'):evidencePath;
 if(failure)process.exitCode=1;
 writeFileSync(target,JSON.stringify({checked_at:new Date().toISOString(),acceptance:failure?'failed':'passed',image:staticProof.image,phase,failure,checks,requests,responses,exceptions,external,blocked,baseline,final:finalState,screenshots,geometryChecks,scope:'Actual mouse reservation detail controls for admin/root in English/Farsi: completed8 disabled, eligible synthetic patient4 reservation3 real slots/booked money/unsaved reason and cancellation, root server states/confirmation/cancel, Back/refresh and desktop/390px geometry. Login/logout only; no business save, download, scanner or worker operation.'},null,2)+'\n',{flag:'wx'});
 if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}for(const item of pending.values())clearTimeout(item.timer);browser.kill();
 for(let i=0;i<50;i++){try{assert.equal(realpathSync(dirname(profile)),realpathSync(tmpdir()));assert.equal(realpathSync(profile),resolve(profile));assert.match(basename(profile),/^checkupino-admin-medical-questionnaire-browser-[\w-]+$/);rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
}
