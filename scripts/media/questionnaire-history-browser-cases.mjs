import assert from 'node:assert/strict';

export async function runQuestionnaireHistory(h) {
  const {send,evaluate,wait,navigate,login,logout,locale,copy,record,screenshot,click,api,closeNavigationOverlay,setPhase}=h;
  const view=async(path,condition)=>{await navigate(path);await wait(condition,'settled '+path);await closeNavigationOverlay();await evaluate('document.fonts.ready');};
  const geometry=async()=>{
    const result=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,cards:Array.from(document.querySelectorAll(".page-content .card")).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}})})');
    assert.ok(result.scroll<=result.width+1,'History viewport overflow');
    assert.ok(result.cards.every(r=>r.left>=-1&&r.right<=result.width+1),'History cards outside viewport');
  };
  const openMobile=async(width)=>{if(width===390&&!await evaluate('document.body.classList.contains("vertical-sidebar-enable")')){await click('#topnav-hamburger-icon');await wait('document.body.classList.contains("vertical-sidebar-enable")','mobile navigation open');}};
  const closeMobile=async(width)=>{if(width===390&&await evaluate('document.body.classList.contains("vertical-sidebar-enable")')){await click('.vertical-overlay');await wait('!document.body.classList.contains("vertical-sidebar-enable")','mobile navigation closed');}};
  await navigate('/panel/login');await wait('!!document.querySelector("#email")','same-origin guest context');
  const guest=await api('/api/my/questionnaire-submissions');assert.equal(guest.status,401);record('Guest history refused');
  let savedId=null;
  for(const id of (h.patientOnly ? [4] : [4,5,2,1])){
    await login(id,'/panel/');await closeNavigationOverlay();
    const history=await api('/api/my/questionnaire-submissions');
    if(id===4){assert.equal(history.status,200);assert.match(history.cache,/no-store/);assert.equal(history.data.data.owner_id,4);assert.ok(history.data.data.items.length>0,'Existing owner submission required');savedId=history.data.data.items[0].public_id;
      const saved=await api('/api/my/questionnaire-submissions/'+savedId);assert.equal(saved.status,200);assert.equal(saved.data.data.owner_id,4);assert.ok(saved.data.data.answers_available);assert.ok(saved.data.data.answers.length>0);
      for(const key of ['submitter_phone','guest_phone','submitter_name','guest_token_hash','meta','user_id','answers_json'])assert.ok(!(key in saved.data.data));
    }else{assert.equal(history.status,403);assert.equal((await api('/api/my/questionnaire-submissions/'+savedId)).status,403);}
    record('Current role/ownership/no-store allowlist '+id);
    for(const lang of ['en','fa']){
      await locale(lang);
      for(const width of [1440,390]){
        setPhase('questionnaire-history-'+id+'-'+lang+'-'+width);
        await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
        const path=id===4?'/panel/my/questionnaire?view=submissions':id===5?'/panel/doctor/reservations':'/panel/questionnaires';
        await view(path,id===4?'!!document.querySelector("section a[href*=submission]")':'!!document.querySelector(".page-content table")');
        await openMobile(width);
        const links=await evaluate('Array.from(document.querySelectorAll("#navbar-nav [data-product-navigation] a[href]" )).map(e=>({href:new URL(e.href).pathname+new URL(e.href).search,current:e.getAttribute("aria-current")}))');
        if(id===4){assert.ok(links.some(r=>r.href==='/panel/my/questionnaire?view=submissions'&&r.current==='page'));assert.ok(!links.some(r=>r.href==='/panel/users'||r.href==='/panel/questionnaires'));}
        if(id===5){assert.ok(!links.some(r=>r.href.includes('/my/questionnaire')||r.href==='/panel/users'));}
        if(id===2)assert.ok(!links.some(r=>r.href==='/panel/users'||r.href==='/panel/settings/general'||r.href==='/panel/upload-limits'));
        if(id===1){for(const path of ['/panel/users','/panel/settings/general','/panel/upload-limits'])assert.ok(links.some(r=>r.href===path));}
        const groups=await evaluate('Array.from(document.querySelectorAll("#navbar-nav [data-product-navigation] > a[aria-controls] ")).map(e=>({id:e.getAttribute("aria-controls"),open:e.getAttribute("aria-expanded")}))');
        assert.equal(new Set(groups.map(r=>r.id)).size,groups.length,'Unique submenu ids');
        for(const group of groups){const selector='a[aria-controls="'+group.id+'"]';const original=await evaluate('location.pathname+location.search');
          await click(selector);await wait('document.querySelector('+JSON.stringify(selector)+').getAttribute("aria-expanded")==='+JSON.stringify(group.open==='true'?'false':'true'),'submenu toggled');
          await click(selector);await wait('document.querySelector('+JSON.stringify(selector)+').getAttribute("aria-expanded")==='+JSON.stringify(group.open),'submenu restored');
          assert.equal(await evaluate('location.pathname+location.search'),original,'Group must not navigate');
        }
        await screenshot('menu-'+id+'-'+width,lang,true);await closeMobile(width);
        record('Native grouped navigation/active leaf/role boundaries '+id+' '+lang+' '+width);
        if(id===4){
          await click('section a[href*=submission]');await wait('Array.from(document.querySelectorAll(".page-content h3")).some(e=>e.textContent==='+JSON.stringify(copy[lang]['questionnaire.savedResult'])+')','saved result snapshot');
          assert.equal(await evaluate('document.querySelector("#product-questionnaires a[aria-current=page]")?.textContent'),copy[lang]['questionnaire.history']);
          await geometry();await screenshot('saved-answers-'+width,lang);
          if(h.patientOnly)assert.ok(await evaluate('Array.from(document.querySelectorAll("section h3,section h4,section .text-break")).filter(e=>e.textContent.trim()).every(e=>e.dir==="auto"||e.textContent==='+JSON.stringify(copy[lang]['questionnaire.savedResult'])+')'),'Saved content uses its own text direction');
          if(h.patientOnly)assert.ok(await evaluate('Array.from(document.querySelectorAll("section [dir=auto]")).filter(e=>/^[A-Za-z]/.test(e.textContent.trim())).every(e=>getComputedStyle(e).direction==="ltr")'),'Stored English text resolves LTR within Farsi shell');
          await send('Page.reload',{ignoreCache:true});await wait('Array.from(document.querySelectorAll(".page-content h3")).some(e=>e.textContent==='+JSON.stringify(copy[lang]['questionnaire.savedResult'])+')','saved deep link reload');await closeNavigationOverlay();
          await openMobile(width);await click('#product-questionnaires a[href="/panel/my/questionnaire"]');await wait('!!document.querySelector(".page-content .ri-survey-line.display-3")','available catalog via submenu');await closeMobile(width);
          assert.equal(await evaluate('document.querySelector("#product-questionnaires a[aria-current=page]")?.textContent'),copy[lang]['questionnaire.available']);
          await geometry();record('Owner saved answers/result/refreshed deep link/catalog native submenu '+lang+' '+width);
        }else if(id!==5){
          await view('/panel/questionnaire-submissions/'+savedId,'!!document.querySelector(".page-content .card") && document.querySelector("#product-questionnaires a[aria-current=page]")?.getAttribute("href")==="/panel/questionnaire-submissions"');
          assert.equal(await evaluate('document.querySelector("a[aria-controls=product-questionnaires]").getAttribute("aria-expanded")'),'true');
          await geometry();record('Admin submission deep link retains expanded containing group '+id+' '+lang+' '+width);
        }
      }
    }
    await logout();
  }
}
