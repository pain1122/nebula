// Served native browser acceptance. Live content is unavailable; positive content responses are browser fixtures only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {snapshot,runtime} from '../health/activation-state.mjs';
import {fixture,id,oldId} from './panel-fixtures.mjs';
assert.ok(process.argv.length===2 || process.argv.length===3 && process.argv[2]==='--root-followup');
const rootFollowup=process.argv[2]==='--root-followup';
const before=JSON.parse(readFileSync('docs/deployment/evidence/article-panel-before-2026-10-23.json','utf8'));
const baseline=snapshot(true);assert.deepEqual(baseline.hashes,before.state.hashes);
const password=readFileSync('.env','utf8').match(/^DEMO_SEED_PASSWORD=(.*)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/,'$2');assert.ok(password);
const copy=Object.fromEntries(['en','fa'].map(lang=>[lang,JSON.parse(readFileSync('frontend/src/locales/'+lang+'.json','utf8'))]));
const profile=mkdtempSync(join(tmpdir(),'checkupino-articles-'));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--incognito','--disable-gpu','--no-first-run','--disable-background-networking','--disable-sync','--window-size=1440,1000','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
let mocked=false;const mockedReads=[];
const stamp=Date.now(), checks=[], requests=[], responses=[], blocked=[], external=[], exceptions=[], captures=[], geometries=[];
const pending=new Map(), network=new Map(); let ws, sequence=0, phase='setup', failure=null, finalState=null;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=async(expression,label)=>{const end=Date.now()+35000;while(Date.now()<end){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error('Browser timeout: '+label);};
const navigate=path=>send('Page.navigate',{url:'http://localhost:3000'+path});
const pointer=async expression=>{
 let previous=null,point=null;const end=Date.now()+7000;
 while(Date.now()<end){const p=await evaluate(`(()=>{const e=${expression};if(!e||e.disabled)return null;e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;return r.width&&r.height&&e.contains(document.elementFromPoint(x,y))?{x,y}:null;})()`);if(p&&previous&&Math.abs(p.x-previous.x)<0.2&&Math.abs(p.y-previous.y)<0.2){point=p;break;}previous=p;await delay(100);}
 assert.ok(point,'Unavailable pointer target: '+expression);for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...point,...(type==='mouseMoved'?{}:{button:'left',clickCount:1})});
};
const click=s=>pointer(`document.querySelector(${JSON.stringify(s)})`);
const button=(label,root='.page-content')=>pointer(`Array.from(document.querySelectorAll(${JSON.stringify(root+' button')})).find(e=>e.textContent.trim()===${JSON.stringify(label)}&&!e.disabled)`);
const setValue=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const key=async(name,code,number)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:name,code,windowsVirtualKeyCode:number});};
const selectNext=async expression=>{await pointer(expression);await key('ArrowDown','ArrowDown',40);await key('Enter','Enter',13);};
const api=path=>evaluate(`fetch('http://localhost:8080'+${JSON.stringify(path)},{credentials:'include',headers:{Accept:'application/json'}}).then(async r=>({status:r.status,cache:r.headers.get('Cache-Control'),data:await r.json()}))`);
const record=name=>{checks.push({phase,name});console.log(JSON.stringify({phase,check:name,passed:true}));};
const overlays=async()=>{if(await evaluate('!!document.querySelector(".offcanvas")')){await wait('document.querySelector(".offcanvas.show .btn-close")','customizer');await click('.offcanvas.show .btn-close');await wait('!document.querySelector(".offcanvas")&&!document.querySelector(".offcanvas-backdrop")','customizer dismissed');}};
const locale=async lang=>{if(await evaluate('document.documentElement.lang!=='+JSON.stringify(lang))){const current=await evaluate('document.documentElement.lang');await pointer('Array.from(document.querySelectorAll("#page-topbar button")).find(e=>e.getAttribute("aria-label")==='+JSON.stringify(copy[current]['product.language.choose'])+')');await pointer('Array.from(document.querySelectorAll(".language .dropdown-item")).find(e=>e.textContent.trim()==='+JSON.stringify(lang==='en'?'English':'فارسی')+')');}await wait('document.documentElement.lang==='+JSON.stringify(lang),'locale');assert.equal(await evaluate('document.documentElement.dir'),lang==='fa'?'rtl':'ltr');};
const login=async id=>{const actor=baseline.accounts.find(a=>a.id===id);assert.ok(actor);phase='actor-'+id;await navigate('/panel/login');await wait('document.querySelector("#email")','login');await setValue('#email',actor.email);await setValue('#password-input',password);await evaluate('document.querySelector("form").requestSubmit()');await wait('document.querySelector(".topbar-user")','authenticated shell');assert.equal((await api('/api/auth/me')).data.data.id,id);await overlays();};
const logout=async()=>{const acknowledged=responses.filter(r=>r.path==='/logout'&&r.status===200).length;await overlays();await click('.topbar-user > button');await wait('document.querySelector("[data-key=t-logout]")','logout menu');await pointer('document.querySelector("[data-key=t-logout]").closest("button")');await wait('location.pathname==="/panel/login"&&document.querySelector("#email")','logout');const end=Date.now()+30000;while(responses.filter(r=>r.path==='/logout'&&r.status===200).length===acknowledged){assert.ok(Date.now()<end,'Logout server acknowledgement missing');await delay(100);}assert.equal(await evaluate('!!document.querySelector("#article-panel")'),false);assert.equal((await api('/api/auth/me')).status,401);};
const geometry = async (kind, lang, width, capture = false) => {
  await evaluate('document.fonts.ready'); await delay(200);
  const box = await evaluate(`(()=>{const root=document.querySelector('[data-content-page]');return {viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,actions:Array.from(root.querySelectorAll('[data-article-editor] > .card-body > .d-flex.mt-3 > button')).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,right:r.right};}),editorDirections:Array.from(root.querySelectorAll('.ck-editor__editable')).map(e=>getComputedStyle(e).direction)}})()`);
  assert.ok(box.scroll <= box.viewport + 1, 'Horizontal page overflow');
  if (kind === 'editor') { assert.equal(box.actions.length,3); assert.ok(Math.abs(box.actions[0].y-box.actions[1].y)<1,'Adjacent Save/Cancel'); assert.deepEqual(box.editorDirections,['ltr','rtl']); }
  geometries.push({phase,kind,lang,width,...box});
  if (capture) { const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const path=`docs/deployment/evidence/article-panel-${stamp}-${phase}-${kind}.png`;writeFileSync(path,Buffer.from(shot.data,'base64'),{flag:'wx'});captures.push(path); }
};
try {
  let port; for(let i=0;i<100&&!port;i++){try{port=Number(readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);}catch(error){if(!['ENOENT','EBUSY'].includes(error.code))throw error;}if(!port)await delay(100);}assert.ok(port);
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);return;}
    if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);
    else if(m.method==='Network.requestWillBeSent'){const r=m.params.request,u=new URL(r.url);if(u.origin==='http://localhost:8080'){const item={phase,method:r.method,path:u.pathname};requests.push(item);network.set(m.params.requestId,item);}else if(/^https?:$/.test(u.protocol)&&u.origin!=='http://localhost:3000')external.push(u.origin);}
    else if(m.method==='Network.responseReceived'){const r=network.get(m.params.requestId);if(r)responses.push({...r,status:m.params.response.status});}
    else if(m.method==='Fetch.requestPaused')void(async()=>{
      const {requestId,request}=m.params,u=new URL(request.url);
      if(mocked && u.origin==='http://localhost:8080' && /^\/api\/admin\/(articles|article-taxonomies)(\/|$)/.test(u.pathname) && request.method==='GET') {
        mockedReads.push({phase,path:u.pathname});await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'private, no-store'},{name:'Access-Control-Allow-Origin',value:'http://localhost:3000'},{name:'Access-Control-Allow-Credentials',value:'true'}],body:Buffer.from(JSON.stringify(fixture(u))).toString('base64')});return;
      }
      const allowed=u.origin==='http://localhost:3000'&&request.method==='GET'||u.origin==='http://localhost:8080'&&!u.pathname.endsWith('/download')&&(['GET','OPTIONS'].includes(request.method)||request.method==='POST'&&['/login','/logout'].includes(u.pathname));
      if(allowed)await send('Fetch.continueRequest',{requestId});else {blocked.push({method:request.method,path:u.pathname});await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
    })().catch(()=>{failure='Network guard failed';});
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await navigate('/panel/login');await wait('document.querySelector("#email")','login');assert.equal((await api('/api/admin/articles')).status,401);record('Real guest API refuses');
  for(const actorId of rootFollowup ? [1] : [2,1]) {
    await login(actorId);mocked=false;
    assert.equal((await api('/api/admin/articles')).status,503);
    await navigate('/panel/articles');await wait('document.querySelector("[data-content-page] [role=alert]")','real feature unavailable');record('Real disabled content responds unavailable without live schema');
    mocked=true;
    for(const width of [1440,390])for(const lang of ['en','fa']) {
      phase=`actor-${actorId}-${lang}-${width}`;await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      await navigate('/panel/articles');await wait('document.querySelector("[data-article-grid] a")','fixture article grid');await overlays();await locale(lang);
      await geometry('grid',lang,width,actorId===2);await button(copy[lang]['content.list']);await wait('document.querySelector("[data-content-page] table tbody tr")','list view');await geometry('list',lang,width);
      await navigate('/panel/articles/new');await wait('document.querySelectorAll("[data-article-editor] .ck-editor__editable").length===2','two native editors');
      await wait('Array.from(document.querySelectorAll("[data-article-editor] button")).find(e=>e.textContent.trim()==='+JSON.stringify(copy[lang]['content.saveDraft'])+')','editor toolbar');
      await setValue('#article-slug','browser-unsaved-draft');
      await button(copy[lang]['content.language.en'],'[data-article-editor]');await setValue('#article-title-en','Browser unsaved title');await click('#article-body-en');await send('Input.insertText',{text:'Native editor synthetic draft'});
      await button(copy[lang]['content.language.fa'],'[data-article-editor]');assert.equal(await evaluate('document.querySelector("#article-title-fa").value'),'');await button(copy[lang]['content.language.en'],'[data-article-editor]');assert.equal(await evaluate('document.querySelector("#article-title-en").value'),'Browser unsaved title');
      await wait('Array.from(document.querySelectorAll("[data-article-editor] button")).some(e=>e.textContent.trim()==='+JSON.stringify(copy[lang]['content.saveDraft'])+'&&!e.disabled)','valid native draft');
      await geometry('editor',lang,width,actorId===2);await button(copy[lang]['content.saveDraft'],'[data-article-editor]');await wait('document.querySelector("dialog[open]")','draft confirmation');assert.equal(await evaluate('document.querySelector("dialog button[type=submit]").disabled'),true);await button(copy[lang]['adminManage.close'],'dialog');await button(copy[lang]['content.cancel'],'[data-article-editor]');
      await navigate('/panel/articles/'+id);await wait('document.querySelector("[data-article-boxes]")','detail boxes');await geometry('workspace',lang,width,actorId===2);await button(copy[lang]['content.publishedCopy']);await wait('document.querySelector("[data-article-preview] article")?.textContent.includes('+JSON.stringify(lang==='en'?'Original article':'مقاله اصلی')+')','separate published preview');
      const previews=await evaluate('Array.from(document.querySelectorAll("[data-article-history] button")).filter(e=>e.textContent.trim()==='+JSON.stringify(copy[lang]['content.preview'])+').length');assert.equal(previews,2);
      await pointer('Array.from(document.querySelectorAll("[data-article-history] button")).filter(e=>e.textContent.trim()==='+JSON.stringify(copy[lang]['content.preview'])+').at(-1)');await wait('document.querySelector("dialog [data-article-preview]")','older version');await button(copy[lang]['content.action.copy_version'],'dialog');await wait('document.querySelector("dialog #administrative-reason")','copy confirmation');assert.equal(await evaluate('document.querySelector("dialog button[type=submit]").disabled'),true);await button(copy[lang]['adminManage.close'],'dialog');
      await navigate('/panel/article-taxonomies');await wait('document.querySelector("[data-content-page] table tbody tr")','taxonomy table');await geometry('taxonomies',lang,width,actorId===2);await button(copy[lang]['content.history']);await wait('document.querySelectorAll("[data-term-history] tbody tr").length===2','two exact term revisions');await button(copy[lang]['content.term.create']);await wait('document.querySelector("#article-term-slug")&&!document.querySelector("#article-term-slug").disabled','term form');await button(copy[lang]['adminManage.close'],'dialog');
      assert.equal(await evaluate('Object.values(localStorage).concat(Object.values(sessionStorage)).some(s=>/Browser unsaved title|browser-unsaved-draft|Native editor synthetic draft/.test(s))'),false);
      record('Browser fixtures only: four native ENFA screens, editor isolation/cancel, exact history/recovery, action rows and memory-only draft');
    }
    mocked=false;await logout();await navigate('/panel/articles/'+id);await wait('location.pathname==="/panel/login"','logout reentry');assert.equal(await evaluate('!!document.querySelector("[data-content-page]")'),false);record('Logout removes content and protects deep link');
  }
  for(const actorId of [4,5]) {
    await login(actorId);mocked=false;assert.equal((await api('/api/admin/articles')).status,403);
    for(const path of ['/panel/articles','/panel/articles/new','/panel/articles/'+id,'/panel/article-taxonomies']) {const start=requests.length;await navigate(path);await wait('document.querySelector(".topbar-user")&&!document.querySelector("[data-content-page]")&&location.pathname!=='+JSON.stringify(path),'role guard');await delay(100);assert.equal(requests.slice(start).filter(r=>/^\/api\/admin\/(articles|article-taxonomies)/.test(r.path)).length,0);}
    record('Real patient/doctor API and four route guards refuse content administration');await logout();
  }
  assert.equal(blocked.length,0);assert.equal(external.length,0);assert.equal(exceptions.length,0);finalState=snapshot();assert.deepEqual(finalState.hashes,before.state.hashes);assert.deepEqual(finalState.health_counts,before.state.health_counts);record('Business/protected data, health counts and pending jobs preserved');
} catch(error) { failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure})); }
finally {
  if(ws?.readyState===WebSocket.OPEN){try{mocked=false;if(await evaluate('!!document.querySelector(".topbar-user")'))await logout();await send('Browser.close');}catch{}ws.close();}browser.kill();for(const p of pending.values())clearTimeout(p.timer);
  const evidence={acceptance:failure?'failed':'passed',checked_at:new Date().toISOString(),failure,checks,requests,responses,mockedReads,blocked,external,exceptions,captures,geometries,root_followup:rootFollowup,image:runtime().find(s=>s.name==='checkupino_prod-admin-1')?.image,final_state:finalState,scope:'Real synthetic auth/role/unavailable reads; browser-fixture positive editorial screens only. Zero live content/password-confirmation/business mutation, migration, worker or job consumption.'};
  const path=`docs/deployment/evidence/article-panel-browser-${stamp}-2026-10-23.json`;writeFileSync(path,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({acceptance:evidence.acceptance,checks:checks.length,captures:captures.length,evidence:path}));
}
