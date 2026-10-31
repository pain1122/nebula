// Authorized real synthetic authoring acceptance; no mocked responses. Never replay after persisted writes.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {snapshot,runtime} from '../health/activation-state.mjs';
assert.equal(process.argv.length,2);
const before=JSON.parse(readFileSync('docs/deployment/evidence/article-product-layout-before-2026-10-23.json','utf8'));
const baseline=snapshot(true);assert.deepEqual(baseline.hashes,before.state.hashes);
const password=readFileSync('.env','utf8').match(/^DEMO_SEED_PASSWORD=(.*)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/,'$2');assert.ok(password);
const copy=Object.fromEntries(['en','fa'].map(lang=>[lang,JSON.parse(readFileSync('frontend/src/locales/'+lang+'.json','utf8'))]));
const profile=mkdtempSync(join(tmpdir(),'checkupino-articles-'));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--incognito','--disable-gpu','--no-first-run','--disable-background-networking','--disable-sync','--window-size=1440,1000','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});

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
const slug='demo-article-'+stamp,reason='Synthetic article authoring acceptance',termIds={},permittedActions=['submit','review','publish','copy_version'];
let contentId=null,mutating=false;
const writes=[],stages=[];
const setField=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing field');const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const successful=()=>responses.filter(r=>/\/api\/admin\/(articles|article-taxonomies)/.test(r.path)&&r.method!=='GET'&&r.method!=='OPTIONS'&&r.status>=200&&r.status<300).length;
const confirm=async()=>{
  await wait('document.querySelector("#administrative-reason")','reason');await setField('#administrative-reason',reason);await click('dialog input[type=checkbox]');
  const before=successful();const form=await evaluate('({fields:Array.from(document.querySelectorAll("dialog input,dialog textarea")).filter(e=>e.type!=="password").map(e=>({id:e.id,value:e.value,checked:e.checked,disabled:e.disabled})),buttons:Array.from(document.querySelectorAll("dialog button")).map(e=>({text:e.textContent.trim(),disabled:e.disabled})),alerts:Array.from(document.querySelectorAll("dialog [role=alert]")).map(e=>e.textContent)})');if(form.buttons.some(e=>e.text==="Confirm action"&&e.disabled))console.error(JSON.stringify({confirmation_diagnostic:form}));await button(copy.en['adminManage.confirm'],'dialog');
  const until=Date.now()+35000;let passwordSent=false;
  while(successful()===before){assert.ok(Date.now()<until,'Ordinary write did not complete; do not replay.');if(await evaluate('!!document.querySelector("#recent-password")')){assert.equal(passwordSent,false,'Repeated password prompt refused');await setField('#recent-password',password);await pointer('document.querySelector("button[form=recent-password-form]")');passwordSent=true;}const alerts=await evaluate('Array.from(document.querySelectorAll("dialog [role=alert]")).map(e=>e.textContent)');assert.equal(alerts.length,0,'Write refused; stop and reconcile instead of replaying.');await delay(100);}
  await wait('!document.querySelector("dialog[open]")','write dialog closed');
};
const readArticle=async()=>{const result=await api('/api/admin/articles/'+contentId);assert.equal(result.status,200);assert.match(result.cache,/no-store/);return result.data.data;};
const allowWrite=(request,path)=>{
  if(!mutating)return false;let body;try{body=JSON.parse(request.postData);}catch{return false;}
  if(body.reason!==reason||body.confirmed!==true)return false;
  if(request.method==='POST'&&path==='/api/admin/article-taxonomies')return ['category','topic','tag'].includes(body.kind)&&body.slug===slug+'-'+body.kind;
  if(path==='/api/admin/articles'&&request.method==='POST')return body.slug===slug;
  if(contentId&&path==='/api/admin/articles/'+contentId&&request.method==='PUT')return body.slug===slug;
  return contentId&&path==='/api/admin/articles/'+contentId+'/actions'&&request.method==='POST'&&permittedActions.includes(body.action);
};
try{
  let port;for(let i=0;i<100&&!port;i++){try{port=Number(readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);}catch(error){if(!['ENOENT','EBUSY'].includes(error.code))throw error;}if(!port)await delay(100);}assert.ok(port);
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);return;}
    if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);
    else if(m.method==='Network.requestWillBeSent'){const r=m.params.request,u=new URL(r.url);if(u.origin==='http://localhost:8080'){const item={phase,method:r.method,path:u.pathname};requests.push(item);network.set(m.params.requestId,item);}else if(/^https?:$/.test(u.protocol)&&u.origin!=='http://localhost:3000')external.push(u.origin);}
    else if(m.method==='Network.responseReceived'){const r=network.get(m.params.requestId);if(r)responses.push({...r,status:m.params.response.status});}
    else if(m.method==='Fetch.requestPaused')void(async()=>{
      const {requestId,request}=m.params,u=new URL(request.url);let allowed=u.origin==='http://localhost:3000'&&request.method==='GET';
      if(u.origin==='http://localhost:8080'&&!u.pathname.endsWith('/download')){
        allowed=['GET','OPTIONS'].includes(request.method)||request.method==='POST'&&['/login','/logout','/api/auth/confirm-password'].includes(u.pathname)||allowWrite(request,u.pathname);
        if(allowed&&!['GET','OPTIONS'].includes(request.method)&&u.pathname.startsWith('/api/admin/'))writes.push({method:request.method,path:u.pathname});
      }
      if(allowed)await send('Fetch.continueRequest',{requestId});else{blocked.push({method:request.method,path:u.pathname});await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
    })().catch(()=>{failure='Network scope guard failed';});
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await login(2);await navigate('/panel/article-taxonomies');await wait('document.querySelector("[data-content-page] table")','live taxonomy list');await locale('en');mutating=true;
  assert.equal((await api('/api/admin/articles')).status,200);
  for(const kind of ['category','topic','tag']){
    phase='create-'+kind;await navigate('/panel/article-taxonomies');await wait('document.querySelector("[data-content-page] table")','taxonomy list');await button(copy.en['content.tabs.'+kind]);await button(copy.en['content.term.create']);await wait('document.querySelector("#article-term-slug")&&!document.querySelector("#article-term-slug").matches(":disabled")','term context');
    await setField('#article-term-slug',slug+'-'+kind);await button(copy.en['content.language.en'],'dialog');await setField('#article-term-en','Demo '+kind+' '+stamp);await setField('#article-term-description-en','Synthetic bilingual taxonomy description');await button(copy.en['content.language.fa'],'dialog');await setField('#article-term-fa',copy.fa['content.kind.'+kind]+' '+stamp);await setField('#article-term-description-fa',copy.fa['content.sharedTermsHint']);await confirm();
    const found=await api('/api/admin/article-taxonomies?kind='+kind+'&q='+slug+'-'+kind);assert.equal(found.status,200);assert.equal(found.data.data.length,1);const term=found.data.data[0];assert.equal(term.slug,slug+'-'+kind);assert.ok(term.labels.en&&term.labels.fa&&term.descriptions.en&&term.descriptions.fa);termIds[kind]=term.id;record('Ordinary bilingual '+kind+' creation with one English slug');
  }
  phase='create-article';await navigate('/panel/articles/new');await wait('document.querySelectorAll(".ck-editor__editable").length===2','native editors');await setField('#article-slug',slug);
  for(const lang of ['en','fa']){await button(copy.en['content.language.'+lang],'[data-article-editor]');await setField('#article-title-'+lang,lang==='en'?'Demo educational article '+stamp:copy.fa['content.newArticle']+' '+stamp);await setField('#article-summary-'+lang,lang==='en'?'Synthetic educational summary':copy.fa['content.unsavedPreview']);await click('#article-body-'+lang);await send('Input.insertText',{text:lang==='en'?'Synthetic educational article for end-to-end acceptance.':copy.fa['content.sharedTermsHint']});await wait('document.querySelector("#article-body-'+lang+'")','stable editor identity after typing');}
  for(const kind of ['category','topic','tag']){await click('#content-picker-'+kind+'-search');await setField('#content-picker-'+kind+'-search','Demo '+kind+' '+stamp);await wait('Array.from(document.querySelectorAll("[role=option]")).some(e=>e.textContent.includes('+JSON.stringify('Demo '+kind+' '+stamp)+'))','shared term option');await pointer('Array.from(document.querySelectorAll("[role=option]")).find(e=>e.textContent.includes('+JSON.stringify('Demo '+kind+' '+stamp)+'))');await key('Escape','Escape',27);}
  await pointer('document.getElementById("article-health-condition.diabetes")');await button(copy.en['content.previewDraft'],'[data-article-editor]');await wait('document.querySelector("dialog [data-article-preview]")','unsaved bilingual preview');await button(copy.en['content.close'],'dialog');await button(copy.en['content.saveDraft'],'[data-article-editor]');await confirm();
  await wait('/^\\/panel\\/articles\\/[0-7][0-9a-hjkmnp-tv-z]{25}$/.test(location.pathname)','new article workspace');contentId=await evaluate('location.pathname.split("/").at(-1)');
  const draft=await readArticle();assert.equal(draft.working.version,1);assert.equal(draft.published,null);assert.equal(draft.working.taxonomy.length,3);assert.deepEqual(draft.working.taxonomy.map(t=>t.id).sort(),Object.values(termIds).sort());record('Real native ENFA draft save and three shared bilingual relationships');
  for(const action of ['submit','review','publish']){phase=action;await wait('document.querySelector("[data-article-boxes]")','workspace');await button(copy.en['content.action.'+action]);await wait('document.querySelector("dialog [data-article-preview]")','fresh signed action preview');await confirm();const state=await readArticle();assert.equal(state.working_state,{submit:'in_review',review:'reviewed',publish:'published'}[action]);stages.push({action,version:state.working.version,hash:state.working.content_hash,published:state.published?.version??null});record('Ordinary exact-version '+action);}
  const published=(await readArticle()).published;
  phase='edit-published';await button(copy.en['content.editDraft']);await wait('document.querySelector("#article-title-en")','edit draft');await button(copy.en['content.language.en'],'[data-article-editor]');await setField('#article-title-en','Demo revised educational article '+stamp);await button(copy.en['content.saveDraft'],'[data-article-editor]');await confirm();
  const edited=await readArticle();assert.equal(edited.working.version,2);assert.equal(edited.status,'published_with_draft');assert.equal(edited.published.id,published.id);assert.equal(edited.published.content_hash,published.content_hash);record('Ordinary edit appends draft and retains exact published version');
  phase='recover';await wait('document.querySelectorAll("[data-article-history] tbody tr").length===2','two immutable versions');await pointer('Array.from(document.querySelectorAll("[data-article-history] button")).filter(e=>e.textContent.trim()==='+JSON.stringify(copy.en['content.preview'])+').at(-1)');await wait('document.querySelector("dialog [data-article-preview]")','older version preview');await button(copy.en['content.action.copy_version'],'dialog');await wait('document.querySelector("#administrative-reason")','recovery confirmation');await confirm();
  const recovered=await readArticle();assert.equal(recovered.working.version,3);assert.equal(recovered.working_state,'draft');assert.equal(recovered.published.id,published.id);assert.equal(recovered.published.content_hash,published.content_hash);assert.equal(recovered.working.content_hash,published.content_hash);assert.equal(recovered.review,null);
  const history=await api('/api/admin/articles/'+contentId+'/versions');assert.equal(history.data.data.length,3);const events=await api('/api/admin/articles/'+contentId+'/events');assert.equal(events.data.data.filter(e=>e.action==='admin.article.version_copied').length,1);record('Ordinary older-version recovery appends version3; publication and all history retained');
  for(const lang of ['en','fa']){await locale(lang);await wait('document.querySelector("[data-article-boxes]")','live workspace');const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const path=`docs/deployment/evidence/article-live-${stamp}-${lang}-2026-10-23.png`;writeFileSync(path,Buffer.from(shot.data,'base64'),{flag:'wx'});captures.push(path);}
  mutating=false;assert.equal(successful(),9);await logout();assert.equal((await api('/api/admin/articles')).status,401);
  for(const actor of [4,5]){await login(actor);assert.equal((await api('/api/admin/articles')).status,403);await logout();}record('Live guest/patient/doctor content-administration refusals');
  assert.equal(blocked.length,0);assert.equal(external.length,0);assert.equal(exceptions.length,0);finalState=snapshot();for(const[key,hash]of Object.entries(before.state.hashes))if(key!=='audit_events')assert.equal(finalState.hashes[key],hash,'Unrelated live data changed: '+key);assert.deepEqual(finalState.health_counts,before.state.health_counts);record('Every unrelated business/protected/health/job fingerprint preserved; new article audits separately verified');
}catch(error){failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure,content_id:contentId}));}
finally{
  mutating=false;if(ws?.readyState===WebSocket.OPEN){try{if(await evaluate('!!document.querySelector(".topbar-user")'))await logout();await send('Browser.close');}catch{}ws.close();}browser.kill();for(const p of pending.values())clearTimeout(p.timer);
  const evidence={acceptance:failure?'failed':'passed',checked_at:new Date().toISOString(),failure,phase,content_id:contentId,slug,term_ids:termIds,checks,stages,successful_content_writes:successful(),writes,requests,responses,blocked,external,exceptions,captures,final_state:finalState,image:runtime().find(s=>s.name==='checkupino_prod-admin-1')?.image,scope:'Authorized ordinary synthetic browser taxonomy create, bilingual article draft/review/publish/edit/copy recovery with real password/reason/revision. No fixtures, DB status shortcuts, unrelated writes, health writes or queue consumption. Never replay after partial writes.'};
  const path=`docs/deployment/evidence/article-live-authoring-${stamp}-2026-10-23.json`;writeFileSync(path,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({acceptance:evidence.acceptance,successful_content_writes:evidence.successful_content_writes,evidence:path}));
}
