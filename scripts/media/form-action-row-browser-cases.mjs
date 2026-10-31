import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

// Read-only native acceptance: never submit a business form or password prompt.
export async function runFormActionRowBrowser(h) {
  const { send, evaluate, wait, navigate, login, logout, locale, copy, record,
    clickText, closeNavigationOverlay, setPhase, api } = h;
  let captures = 0;
  const row = async (kind, lang, width, cancelKey = 'users.cancel') => {
    const cancel = copy[lang][cancelKey];
    const geometry = await evaluate(`(()=>{
      const root=document.querySelector('dialog[open]')||document.querySelector('.page-content');
      const cancel=Array.from(root.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(cancel)});
      const save=cancel?.parentElement.querySelector('button[type=submit]');
      if(!save||!cancel)return null;
      cancel.scrollIntoView({block:'center'});
      const a=save.getBoundingClientRect(),b=cancel.getBoundingClientRect();
      return {sameParent:save.parentElement===cancel.parentElement,saveDisabled:save.disabled,cancelDisabled:cancel.disabled,
        associated:!!save.form,topDelta:Math.abs(a.top-b.top),gap:Math.max(a.left,b.left)-Math.min(a.right,b.right),
        left:Math.min(a.left,b.left),right:Math.max(a.right,b.right),width:innerWidth,dir:document.documentElement.dir};
    })()`);
    assert.ok(geometry, kind+' has both actions');
    assert.equal(geometry.sameParent,true); assert.equal(geometry.associated,true);
    assert.equal(geometry.saveDisabled,true); assert.equal(geometry.cancelDisabled,false);
    assert.ok(geometry.topDelta<2 && geometry.gap>=0,kind+' actions must be beside each other');
    assert.ok(geometry.left>=0 && geometry.right<=geometry.width,kind+' actions fit viewport');
    assert.equal(geometry.dir,lang==='fa'?'rtl':'ltr');
    await new Promise(resolve=>setTimeout(resolve,150));
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const name=`docs/deployment/evidence/form-action-row-${kind}-${lang}-${width}-2026-10-18.png`;
    writeFileSync(name,Buffer.from(shot.data,'base64'),{flag:'wx'}); captures++;
    record(JSON.stringify({kind,lang,width,geometry,capture:name}));
    await clickText(cancel);
  };
  for(const id of [2,3,4]) {
    await login(id,'/panel/'); await closeNavigationOverlay();
    const hospital=id===2?(await api('/api/admin/hospitals')).data.data.hospitals[0]:null;
    for(const lang of ['en','fa']) {
      await locale(lang);
      for(const width of [1440,390]) {
        setPhase(`action-row-${id}-${lang}-${width}`);
        await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
        if(hospital) {
          await navigate('/panel/hospitals/'+hospital.public_id);
          await wait('Array.from(document.querySelectorAll(".page-content button")).some(b=>b.textContent.trim()==='+JSON.stringify(copy[lang]['onboarding.editHospital'])+')','hospital edit control');
          await closeNavigationOverlay(); await clickText(copy[lang]['onboarding.editHospital']);
          await wait('!!document.querySelector("#hospital-name")','hospital edit');
          await row('hospital',lang,width);
          await wait('!document.querySelector("#hospital-name")','hospital canceled');
          await navigate('/panel/checkups/5');
          await wait('Array.from(document.querySelectorAll(".page-content button")).some(b=>b.textContent.trim()==='+JSON.stringify(copy[lang]['catalog.update'])+')','catalog update');
          await clickText(copy[lang]['catalog.update']);
          await wait('!!document.querySelector("#administrative-reason")','shared administrative dialog');
          await row('administration',lang,width,'adminManage.close');
          await wait('!document.querySelector("dialog[open]")','administration canceled');
        }
        await navigate('/panel/profile');
        await wait('!!document.querySelector("#profile-overview-reports")','own profile');
        await closeNavigationOverlay(); await clickText(copy[lang]['profileOverview.editName']);
        await wait('!!document.querySelector("#profile-first-name")','display name modal');
        await row('profile-'+id,lang,width);
        await wait('!document.querySelector("dialog[open]")','name canceled');
        if(id===3) {
          for(const [key,ready,kind] of [
            ['onboarding.addLocation','#doctor-hospital','add-location'],
            ['onboarding.doctorPrices','input[id^=doctor-service-price-]','doctor-prices'],
            ['doctorPractice.editProfessional','#practice-primary','professional'],
            ['doctorPractice.editDays','[data-working-hours-editor]','working-hours'],
          ]) {
            await clickText(copy[lang][key]);
            await wait('!!document.querySelector('+JSON.stringify(ready)+')',kind);
            await row(kind,lang,width);
            await wait('!document.querySelector("dialog[open]")',kind+' canceled');
          }
        }
      }
    }
    await logout();
  }
  assert.equal(captures,36);
  record('36 native action rows fit EN/FA desktop/mobile and ordinary Cancel closes every draft; no business submissions.');
}
