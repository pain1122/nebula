import assert from 'node:assert/strict';

export async function runDoctorPanel(h) {
 const {send,evaluate,wait,navigate,login,logout,locale,copy,record,screenshot,clickText,click,api,closeNavigationOverlay,baseline,setPhase}=h;
 const view=async(path,selector)=>{await navigate(path);await wait(selector,'settled '+path);assert.equal(await evaluate('!!document.querySelector(".offcanvas")'),false,'No automatic customizer on route load');await closeNavigationOverlay();await evaluate('document.fonts.ready');};
 const geometry=async label=>{const result=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,cards:Array.from(document.querySelectorAll(".page-content .card")).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}})})');assert.ok(result.scroll<=result.width+1,label+' overflow');assert.ok(result.cards.every(r=>r.left>=-1&&r.right<=result.width+1),label+' cards outside viewport');};
 const button=(key,args={})=>Object.entries(args).reduce((text,[name,value])=>text.replace('{{'+name+'}}',value),copy[awaitLanguage][key]);
 let awaitLanguage='en';
 const menu=async(width,link)=>{
  if(width===390&&!await evaluate('document.body.classList.contains("vertical-sidebar-enable")'))await click('#topnav-hamburger-icon');
  const target=link.endsWith('/')?link.slice(0,-1):link;
  const expression='Array.from(document.querySelectorAll("#navbar-nav a[href]")).find(e=>(e.getAttribute("href").endsWith("/")?e.getAttribute("href").slice(0,-1):e.getAttribute("href"))==='+JSON.stringify(target)+')';
  await wait(expression+'?.getAttribute("aria-current")==="page"','selected menu item');
  assert.equal(await evaluate(expression+'.classList.contains("bg-primary-subtle")'),true);
  if(width===390){await click('.vertical-overlay');await wait('!document.body.classList.contains("vertical-sidebar-enable")','navigation overlay closed');}
 };
 const chooser=async label=>{await wait('Array.from(document.querySelectorAll(".page-content button")).some(e=>e.getAttribute("aria-label")==='+JSON.stringify(label)+')','loaded choice '+label);await click('button[aria-label='+JSON.stringify(label)+']');};
 await navigate('/panel/login');await wait('!!document.querySelector("#email")','guest origin');
 for(const path of ['/api/doctor/practice','/api/doctor/dashboard/appointments?from=2026-10-01&until=2026-11-01'])assert.equal((await api(path)).status,401);
 record('Guest doctor profile/calendar reads refused');
 for(const id of [4,3,5,2,1]){
  await login(id,'/panel/');
  const actor=baseline.accounts.find(a=>a.id===id);assert.ok(actor);
  await wait('!!document.querySelector(".offcanvas.show")','first per-account introduction');
  assert.equal(await evaluate('localStorage.getItem('+JSON.stringify('checkupino.customizer.seen.v1.'+actor.public_id)+')||localStorage.getItem('+JSON.stringify('checkupino.customizer.seen.v1.'+id)+')'),'1');
  await closeNavigationOverlay();
  const doctor=[3,5].includes(id);
  const practice=await api('/api/doctor/practice');
  const calendar=await api('/api/doctor/dashboard/appointments?from=2026-10-01&until=2026-11-01');
  if(doctor){assert.equal(practice.status,200);assert.equal(practice.data.data.owner_id,id);assert.match(practice.cache,/no-store/);assert.equal(calendar.status,200);assert.equal(calendar.data.data.owner_id,id);assert.equal(calendar.data.data.scope,'doctor_confirmed');assert.ok(calendar.data.data.appointments.every(r=>r.status==='confirmed'));assert.ok(!calendar.data.data.appointments.some(r=>r.public_id===baseline.reservation),'Completed golden-flow reservation excluded');assert.equal((await api('/api/doctor/dashboard/appointments?from=2026-10-01&until=2026-11-01&doctor_id=1')).status,422);}
  else {assert.equal(practice.status,403);assert.equal(calendar.status,403);}
  record('Own doctor practice/calendar/confirmed-only scope and other-role refusals '+id);
  for(const lang of ['en','fa']){
   await locale(lang);awaitLanguage=lang;
   for(const width of [1440,390]){
    setPhase('doctor-panel-'+id+'-'+lang+'-'+width);
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
    const path=id===4?'/panel/book':doctor?'/panel/':'/panel/reservations';
    await view(path,id===4?'!!document.querySelector("#booking-search")':doctor?'!!document.querySelector("[data-calendar-toolbar]")':'!!document.querySelector(".page-content table")');
    assert.equal(await evaluate('!!document.querySelector(".offcanvas")'),false,'Customizer must not repeat on page navigation');
    await menu(width,id===4?'/panel/book':doctor?'/panel/':'/panel/reservations');
    await click('.customizer-setting button');await wait('!!document.querySelector(".offcanvas.show")','manual customizer knob');await closeNavigationOverlay();
    await send('Page.reload',{ignoreCache:true});await wait(id===4?'!!document.querySelector("#booking-search")':doctor?'!!document.querySelector("[data-calendar-toolbar]")':'!!document.querySelector(".page-content table")','reloaded page');
    assert.equal(await evaluate('!!document.querySelector(".offcanvas")'),false,'No automatic customizer on reload');await closeNavigationOverlay();
    record('Per-account once-only customizer/manual keyboard-capable knob/active menu '+id+' '+lang+' '+width);
    if(id===4){
     const catalog=await api('/api/checkups?page=1');assert.equal(catalog.status,200);const service=catalog.data.data.data.find(c=>c.id===5);assert.ok(service,'Existing accepted offering required');
     await chooser(button('booking.chooseService',{name:service.title}));await clickText(copy[lang]['booking.nextStep']);
     const offered=await api('/api/checkups/5/doctors');assert.equal(offered.status,200);const selected=offered.data.data.find(d=>d.doctor_profile_id===2);assert.ok(selected);assert.ok(selected.experience_years>=0);assert.equal(selected.photo_url,null);assert.equal(selected.rating,null);
     await wait('!!document.querySelector(".page-content .avatar-lg")','doctor cards');await geometry('doctor cards');await screenshot('doctor-cards-'+width,lang);
     await chooser(button('booking.chooseDoctor',{name:selected.doctor_name}));await clickText(copy[lang]['booking.nextStep']);
     const workplace=selected.workplaces.find(w=>w.id===3);assert.ok(workplace);await chooser(button('booking.chooseLocation',{name:workplace.name}));await clickText(copy[lang]['booking.nextStep']);
     await wait('!!document.querySelector(".page-content .list-group-item")||document.querySelector(".page-content")?.textContent.includes('+JSON.stringify(copy[lang]['booking.noSlots'])+')','actual slots or honest empty availability');
     const slotButtons=await evaluate('document.querySelectorAll(".page-content .list-group-item").length');
     if(slotButtons){await click('.page-content .list-group-item');assert.equal(await evaluate('Array.from(document.querySelectorAll(".page-content button")).find(e=>e.textContent.trim()==='+JSON.stringify(copy[lang]['booking.confirm'])+').disabled'),false);}
     else assert.equal(await evaluate('Array.from(document.querySelectorAll(".page-content button")).find(e=>e.textContent.trim()==='+JSON.stringify(copy[lang]['booking.confirm'])+').disabled'),true);
     await geometry('time selection');await screenshot('wizard-slots-'+width,lang);
     await clickText(copy[lang]['booking.previous']);await wait('!!document.querySelector(".page-content .ri-map-pin-line.fs-1")','back to location');
     await click('.page-content .breadcrumb button');await wait('!!document.querySelector("#booking-search")','breadcrumb back to service');
     assert.equal(await evaluate('document.querySelectorAll(".page-content button[aria-pressed=true]").length'),1);record('Service/description -> real doctor cards -> locations -> times, Back/breadcrumb and no booking '+lang+' '+width);
    }else if(doctor){
     await wait('document.querySelector("[data-dashboard-section=appointments]")?.textContent.includes('+JSON.stringify(copy[lang]['doctorPractice.calendarHint'])+')','owned confirmed-only calendar');
     assert.equal(await evaluate('document.querySelector("[data-dashboard-section=appointments] a").getAttribute("href")'),'/panel/doctor/reservations');
     await geometry('doctor calendar');await screenshot('doctor-calendar-'+id+'-'+width,lang,false,'[data-dashboard-section=appointments]');
     await view('/panel/profile','!!document.querySelector("#doctor-practice button") && !document.querySelector("#doctor-practice .spinner-border")');
     await wait('Array.from(document.querySelectorAll("#doctor-practice button")).some(e=>e.textContent.trim()==='+JSON.stringify(copy[lang]['doctorPractice.editProfessional'])+')','professional owner data');
     await menu(width,'/panel/profile');await geometry('doctor profile');await screenshot('doctor-practice-'+id+'-'+width,lang,false,'#doctor-practice');
     await clickText(copy[lang]['doctorPractice.editProfessional']);await wait('!!document.querySelector("#practice-experience")','professional edit dialog');
     assert.equal(await evaluate('document.querySelector("dialog[open] button[type=submit]").disabled'),true);
     assert.equal(await evaluate('!!document.querySelector("#practice-primary")'),true);
     await screenshot('professional-preview-'+id+'-'+width,lang,true);await clickText(copy[lang]['users.cancel']);await wait('!document.querySelector("dialog[open]")','professional canceled');
     const activeLocation=practice.data.data.workplaces.find(w=>w.active);
     if(activeLocation){await clickText(copy[lang]['doctorPractice.editDays']);await wait('!!document.querySelector("#practice-reason")','weekly rules dialog');await clickText(copy[lang]['doctorPractice.addWindow']);assert.equal(await evaluate('document.querySelector("dialog[open] button[type=submit]").disabled'),true);await screenshot('weekly-preview-'+id+'-'+width,lang,true);await clickText(copy[lang]['users.cancel']);await wait('!document.querySelector("dialog[open]")','weekly rules canceled');}
     record('Own confirmed calendar and visible professional/working-day edit previews canceled '+id+' '+lang+' '+width);
    }else {await geometry('administration preserved');await screenshot('admin-menu-'+id+'-'+width,lang);record('Administrative role retained; no doctor practice access '+id+' '+lang+' '+width);}
   }
  }
  await logout();
 }
 await login(4,'/panel/');await closeNavigationOverlay();assert.equal(await evaluate('!!document.querySelector(".offcanvas")'),false,'Returning user must not be introduced again');await logout();record('Returning patient login retains completed customizer introduction');
}
