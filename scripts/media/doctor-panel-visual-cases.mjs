import assert from 'node:assert/strict';

export async function runDoctorPanelVisual(h) {
 const {send,evaluate,wait,navigate,login,logout,locale,copy,record,screenshot,clickText,closeNavigationOverlay,setPhase}=h;
 for(const id of [3,5]) {
  await login(id,'/panel/');await closeNavigationOverlay();
  for(const lang of ['en','fa']) {
   await locale(lang);
   for(const width of [1440,390]) {
    setPhase('doctor-visual-'+id+'-'+lang+'-'+width);
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
    await navigate('/panel/');
    await wait('!!document.querySelector("[data-calendar-toolbar]") && !document.querySelector("[data-dashboard-section=appointments] .spinner-border")','doctor calendar data');
    await closeNavigationOverlay();await screenshot('calendar-'+id+'-'+width,lang,false,'[data-dashboard-section=appointments]');
    await navigate('/panel/profile');
    await wait('Array.from(document.querySelectorAll("#doctor-practice button")).some(e=>e.textContent.trim()==='+JSON.stringify(copy[lang]['doctorPractice.editProfessional'])+')','doctor professional data');
    await closeNavigationOverlay();await screenshot('practice-'+id+'-'+width,lang,false,'#doctor-practice');
    await clickText(copy[lang]['doctorPractice.editProfessional']);
    await wait('!!document.querySelector("#practice-experience")','professional modal');
    assert.equal(await evaluate('document.querySelector("dialog[open] button[type=submit]").disabled'),true);
    await screenshot('professional-'+id+'-'+width,lang,true);await clickText(copy[lang]['users.cancel']);await wait('!document.querySelector("dialog[open]")','modal canceled');
    record('Visible owned calendar/professional profile and canceled professional modal '+id+' '+lang+' '+width);
   }
  }
  await logout();
 }
}
