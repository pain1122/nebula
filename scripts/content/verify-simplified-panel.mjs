// Read-only native final candidate check. No content mutation or mocked response.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {snapshot,runtime} from '../health/activation-state.mjs';
assert.equal(process.argv.length,2);
const before=JSON.parse(readFileSync('docs/deployment/evidence/article-simplification-before-2026-10-23.json','utf8'));
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
const setField=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const overlays=async()=>{if(await evaluate('!!document.querySelector(".offcanvas")')){await wait('document.querySelector(".offcanvas.show .btn-close")','customizer');await click('.offcanvas.show .btn-close');await wait('!document.querySelector(".offcanvas")&&!document.querySelector(".offcanvas-backdrop")','customizer dismissed');}};
const locale=async lang=>{if(await evaluate('document.documentElement.lang!=='+JSON.stringify(lang))){const current=await evaluate('document.documentElement.lang');await pointer('Array.from(document.querySelectorAll("#page-topbar button")).find(e=>e.getAttribute("aria-label")==='+JSON.stringify(copy[current]['product.language.choose'])+')');await pointer('Array.from(document.querySelectorAll(".language .dropdown-item")).find(e=>e.textContent.trim()==='+JSON.stringify(lang==='en'?'English':'فارسی')+')');}await wait('document.documentElement.lang==='+JSON.stringify(lang),'locale');assert.equal(await evaluate('document.documentElement.dir'),lang==='fa'?'rtl':'ltr');};
const login=async id=>{const actor=baseline.accounts.find(a=>a.id===id);assert.ok(actor);phase='actor-'+id;await navigate('/panel/login');await wait('document.querySelector("#email")','login');await setValue('#email',actor.email);await setValue('#password-input',password);await evaluate('document.querySelector("form").requestSubmit()');await wait('document.querySelector(".topbar-user")','authenticated shell');assert.equal((await api('/api/auth/me')).data.data.id,id);await overlays();};
const logout=async()=>{const acknowledged=responses.filter(r=>r.path==='/logout'&&r.status===200).length;await overlays();await click('.topbar-user > button');await wait('document.querySelector("[data-key=t-logout]")','logout menu');await pointer('document.querySelector("[data-key=t-logout]").closest("button")');await wait('location.pathname==="/panel/login"&&document.querySelector("#email")','logout');const end=Date.now()+30000;while(responses.filter(r=>r.path==='/logout'&&r.status===200).length===acknowledged){assert.ok(Date.now()<end,'Logout server acknowledgement missing');await delay(100);}assert.equal(await evaluate('!!document.querySelector("#article-panel")'),false);assert.equal((await api('/api/auth/me')).status,401);};
let contentId=null,mutating=false;const writes=[],stages=[];const successful=()=>0;
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
        allowed=['GET','OPTIONS'].includes(request.method)||request.method==='POST'&&['/login','/logout'].includes(u.pathname);
        if(allowed&&!['GET','OPTIONS'].includes(request.method)&&u.pathname.startsWith('/api/admin/'))writes.push({method:request.method,path:u.pathname});
      }
      if(allowed)await send('Fetch.continueRequest',{requestId});else{blocked.push({method:request.method,path:u.pathname});await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
    })().catch(()=>{failure='Network scope guard failed';});
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});

  const live=JSON.parse(readFileSync('docs/deployment/evidence/article-live-authoring-1792770896872-2026-10-23.json','utf8'));
  contentId=live.content_id;for(const actorId of [2,1]){await login(actorId);
  for(const width of [1440,390])for(const lang of ['en','fa']){
    phase='actor-'+actorId+'-'+lang+'-'+width;
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await navigate('/panel/articles/'+contentId);await wait('document.querySelector("[data-article-boxes]")','real workspace');await locale(lang);
    for(const path of ['/panel/articles/'+contentId,'/panel/articles/new']){
      await navigate(path);await wait('document.querySelector("[data-article-boxes],[data-article-editor]")','real article screen');
      await wait('Array.from(document.querySelectorAll("link[rel=stylesheet]")).every(e=>e.sheet)','loaded styles');await evaluate('document.fonts.ready');await delay(300);
      const geometry=await evaluate('(()=>{const m=document.querySelector(".main-content").getBoundingClientRect(),s=document.querySelector(".app-menu").getBoundingClientRect();return {width:innerWidth,dir:document.documentElement.dir,main:{left:m.left,right:m.right},sidebar:{left:s.left,right:s.right},overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};})()');
      geometries.push({phase,path,...geometry});
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const capture='docs/deployment/evidence/article-simplification-'+stamp+'-'+actorId+'-'+lang+'-'+width+'-'+(path.endsWith('/new')?'editor':'workspace')+'.png';writeFileSync(capture,Buffer.from(shot.data,'base64'),{flag:'wx'});captures.push(capture);

      if(path.endsWith('/new')){
        await wait('document.querySelectorAll(".ck-editor__editable").length===2&&!document.querySelector("#article-slug").matches(":disabled")','native editor readiness');
        assert.equal(await evaluate('!!document.querySelector("[id^=article-summary-]")'),false);
        assert.equal(await evaluate('!!document.querySelector("[id^=article-source-],#content-picker-topic-search")'),false);
        assert.equal(await evaluate('Array.from(document.querySelectorAll("[data-article-editor] h5")).some(e=>'+JSON.stringify([copy[lang]['content.sources'],copy[lang]['content.tabs.topic']])+'.includes(e.textContent.trim()))'),false);
        for(const kind of ['category','tag'])assert.ok(await evaluate('!!document.querySelector("#content-picker-'+kind+'-search")'));
        const height=await evaluate('Array.from(document.querySelectorAll(".ck-editor__editable")).find(e=>e.getBoundingClientRect().height>0).getBoundingClientRect().height');
        assert.equal(height,width===1440?400:250);geometries.push({phase,editor_height:height});
        await click('#article-seo-toggle');await wait('document.querySelector("#article-seo-toggle").getAttribute("aria-expanded")==="true"&&!document.querySelector("#article-seo-body").classList.contains("collapsing")','accordion expanded');
        await setValue('#article-slug','unsaved-seo-demo');
        for(const [kind,min,max] of [['title',50,60],['description',120,160]])for(const [count,tone] of [[min-1,'text-body'],[min,'text-success'],[max,'text-success'],[max+1,'text-danger']]){
          await setField('#article-seo-'+kind+'-'+lang,'x'.repeat(count));
          await wait('document.querySelector("[data-article-seo-language='+lang+'] [data-seo-counter='+kind+']").classList.contains('+JSON.stringify(tone)+')','counter colour boundary');
        }
        for(const kind of ['keywords','schema_json','canonical_url'])await setField('#article-seo-'+kind+'-'+lang,copy[lang]['content.seo.example.'+kind]);
        await wait('Array.from(document.querySelectorAll("[data-article-actions] button")).find(e=>e.textContent.includes('+JSON.stringify(copy[lang]['content.saveDraft'])+'))?.disabled===false','advisory ranges do not block save');
        const safe=await evaluate('Array.from(document.querySelectorAll("[data-article-seo] input,[data-article-seo] textarea")).filter(e=>e.getBoundingClientRect().height>0).map(e=>({id:e.id,dir:e.dir,placeholder:!!e.placeholder,invalid:e.getAttribute("aria-invalid")}))');
        assert.equal(safe.filter(e=>e.id!=='article-seo-language').length,5);assert.ok(safe.every(e=>e.placeholder&&e.invalid==='false'));
        const shotSeo=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const seoCapture='docs/deployment/evidence/article-simplification-'+stamp+'-'+actorId+'-'+lang+'-'+width+'-accordion.png';writeFileSync(seoCapture,Buffer.from(shotSeo.data,'base64'),{flag:'wx'});captures.push(seoCapture);
        await setField('#article-seo-schema_json-'+lang,'<script>alert(1)</script>');
        await wait('document.querySelector("#article-seo-schema_json-'+lang+'").getAttribute("aria-invalid")==="true"','invalid schema refusal');
        assert.equal(await evaluate('!!document.querySelector("[data-article-seo] script")'),false);
        await setField('#article-seo-schema_json-'+lang,copy[lang]['content.seo.example.schema_json']);
        await button(copy[lang]['content.cancel'],'[data-article-editor]');await wait('location.pathname==="/panel/articles"','cancel returns without save');
        record('Native editor height, no summary, accessible accordion, five localized examples, all counter boundaries, safe JSON and cancel');
      }
      assert.equal(geometry.overflow,false);if(width===1440){if(lang==='fa')assert.ok(geometry.main.right<=geometry.sidebar.left+1,'RTL content/sidebar overlap');else assert.ok(geometry.main.left>=geometry.sidebar.right-1,'LTR content/sidebar overlap');}
    }
    await navigate('/panel/article-taxonomies');await wait('document.querySelector("[data-content-page] table")','taxonomy page');assert.equal(await evaluate('Array.from(document.querySelectorAll("[data-content-page] button")).some(e=>e.textContent.trim()==='+JSON.stringify(copy[lang]['content.tabs.topic'])+')'),false);
    await navigate('/panel/articles');await wait('document.querySelector("#article-search")','article list');assert.equal(await evaluate('!!document.querySelector("#article-filter-topic_id")'),false);
    record('Settled real workspace/editor ENFA responsive layout');
  }
  await logout();}
  assert.equal(blocked.length,0);assert.equal(external.length,0);assert.equal(exceptions.length,0);
  finalState=snapshot();assert.deepEqual(finalState.hashes,before.state.hashes);assert.deepEqual(finalState.health_counts,before.state.health_counts);

}catch(error){failure=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;console.error(JSON.stringify({acceptance:'failed',phase,message:failure,content_id:contentId}));}
finally{
  mutating=false;if(ws?.readyState===WebSocket.OPEN){try{if(await evaluate('!!document.querySelector(".topbar-user")'))await logout();await send('Browser.close');}catch{}ws.close();}browser.kill();for(const p of pending.values())clearTimeout(p.timer);
  const evidence={acceptance:failure?'failed':'passed',checked_at:new Date().toISOString(),failure,phase,content_id:contentId,geometries,checks,stages,successful_content_writes:successful(),writes,requests,responses,blocked,external,exceptions,captures,final_state:finalState,image:runtime().find(s=>s.name==='checkupino_prod-admin-1')?.image,scope:'Real admin/root ENFA1440/390 source/topic control removal, category/tag retention, taxonomy/list controls and retained SEO/editor/cancel acceptance. No content writes, mocks, confirmation, downloads or jobs.'};
  const path=`docs/deployment/evidence/article-simplification-browser-${stamp}-2026-10-23.json`;writeFileSync(path,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({acceptance:evidence.acceptance,successful_content_writes:evidence.successful_content_writes,evidence:path}));
}
