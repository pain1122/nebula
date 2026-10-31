import assert from 'node:assert/strict';

export async function runClinicalOnboardingDoctorBrowser(h) {
  const { send, evaluate, wait, navigate, login, logout, locale, copy, record, screenshot,
    clickText, closeNavigationOverlay, setPhase, api, setValue } = h;
  for (const id of [3, 5]) {
    await login(id, '/panel/'); await closeNavigationOverlay();
    for (const lang of ['en', 'fa']) {
      await locale(lang);
      for (const width of [1440, 390]) {
        setPhase(`clinical-doctor-${id}-${lang}-${width}`);
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
        await navigate('/panel/profile');
        await wait('Array.from(document.querySelectorAll("#doctor-practice button")).some(b=>b.textContent.trim()==='+JSON.stringify(copy[lang]['onboarding.addLocation'])+')','doctor location controls');
        await closeNavigationOverlay();
        const before = await api('/api/doctor/practice');
        await clickText(copy[lang]['onboarding.addLocation']);
        await wait('!!document.querySelector("#doctor-hospital")','doctor location selection');
        assert.equal(await evaluate('Array.from(document.querySelectorAll("dialog[open] button[type=submit]")).at(-1).disabled'),true);
        await screenshot('doctor-add-location-'+id+'-'+width,lang,true);
        await clickText(copy[lang]['users.cancel']); await wait('!document.querySelector("dialog[open]")','location draft canceled');
        await clickText(copy[lang]['onboarding.doctorPrices']);
        await wait('!!document.querySelector("input[id^=doctor-service-price-]")','doctor owned service pricing');
        assert.equal(await evaluate('Array.from(document.querySelectorAll("dialog[open] button[type=submit]")).at(-1).disabled'),true);
        await screenshot('doctor-prices-'+id+'-'+width,lang,true);
        await clickText(copy[lang]['users.cancel']); await wait('!document.querySelector("dialog[open]")','price draft canceled');
        await clickText(copy[lang]['doctorPractice.editDays']);
        await wait('!!document.querySelector("[data-working-hours-editor]")','per-location working days');
        await clickText(copy[lang]['users.cancel']); await wait('!document.querySelector("dialog[open]")','working day draft canceled');
        assert.deepEqual((await api('/api/doctor/practice')).data.data,before.data.data);
        await navigate('/panel/hospitals'); await wait('location.pathname === "/panel" || location.pathname === "/panel/"','doctor admin route refusal');
        record(`Doctor owns independent location/schedule/service-price controls, canceled unchanged ${id} ${lang} ${width}`);
      }
    }
    await logout();
  }
  await login(4,'/panel/'); await closeNavigationOverlay();
  for (const lang of ['en','fa']) {
    await locale(lang);
    for (const width of [1440,390]) {
      setPhase(`clinical-patient-${lang}-${width}`);
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
      for (const path of ['/panel/doctors/new','/panel/patients/new','/panel/hospitals','/panel/hospitals/new']) {
        await navigate(path); await wait('location.pathname === "/panel" || location.pathname === "/panel/"','patient admin route refusal');
        assert.equal(await evaluate('!!document.querySelector("#clinical-first_name,#hospital-name,#hospital-search")'),false);
      }
      record(`Patient cannot enter any clinical administration create route ${lang} ${width}`);
    }
  }
  await logout();
}
