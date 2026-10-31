import assert from 'node:assert/strict';

export async function runClinicalOnboardingBrowser(h) {
  const { send, evaluate, wait, navigate, login, logout, locale, copy, record, screenshot,
    clickText, closeNavigationOverlay, setPhase, api, setValue } = h;
  for (const id of [2, 1]) {
    await login(id, '/panel/'); await closeNavigationOverlay();
    const list = await api('/api/admin/hospitals');
    assert.equal(list.status, 200); assert.ok(list.data.data.hospitals.length > 0);
    const hospital = list.data.data.hospitals[0];
    for (const lang of ['en', 'fa']) {
      await locale(lang);
      for (const width of [1440, 390]) {
        setPhase(`clinical-admin-${id}-${lang}-${width}`);
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
        for (const [path, ready] of [
          ['/panel/doctors', `!!document.querySelector('a[href="/panel/doctors/new"]')`],
          ['/panel/doctors/new', '!!document.querySelector("#clinical-first_name") && !document.querySelector("#clinical-first_name").disabled'],
          ['/panel/patients', `!!document.querySelector('a[href="/panel/patients/new"]')`],
          ['/panel/patients/new', '!!document.querySelector("#clinical-first_name") && !document.querySelector("#clinical-first_name").disabled'],
          ['/panel/hospitals', `!!document.querySelector('#hospital-search') && !!document.querySelector(${JSON.stringify('.page-content a[href="/panel/hospitals/'+hospital.public_id+'"]')})`],
          ['/panel/hospitals/new', '!!document.querySelector("#hospital-name")'],
          ['/panel/hospitals/' + hospital.public_id, `document.querySelector('.page-content')?.textContent.includes(${JSON.stringify(hospital.name)}) && Array.from(document.querySelectorAll('.page-content button')).some(b=>b.textContent.trim()===${JSON.stringify(copy[lang]['onboarding.editHospital'])})`],
        ]) {
          await navigate(path); await wait(ready, path); await closeNavigationOverlay();
          if (path.endsWith('/doctors/new') || path.endsWith('/patients/new')) {
            assert.equal(await evaluate('document.querySelector("#clinical-password").type'), 'password');
            assert.equal(await evaluate('document.querySelector("#clinical-first_name").value'), '');
            if (path.endsWith('/doctors/new')) assert.equal(await evaluate('Array.from(document.querySelectorAll("input[type=checkbox]")).find(e=>e.closest("label")?.textContent.includes('+JSON.stringify(copy[lang]['onboarding.verifyDoctor'])+'))?.checked'),false);
          }
          if (path === '/panel/hospitals/new') assert.equal(await evaluate('!!document.querySelector("#hospital-price")'), false);
          if (path.includes('/new')) await screenshot('create-' + path.split('/')[2] + '-' + id + '-' + width, lang, false);
        }
        await clickText(copy[lang]['onboarding.editHospital']);
        await wait('!!document.querySelector("#hospital-name")', 'hospital edit');
        assert.equal(await evaluate('document.querySelector("#hospital-name").value'), hospital.name);
        await setValue('#hospital-name', 'Unsaved synthetic clinic draft');
        await clickText(copy[lang]['users.cancel']);
        await wait('!document.querySelector("#hospital-name")', 'hospital draft canceled');
        assert.equal((await api('/api/admin/hospitals/' + hospital.public_id)).data.data.hospital.name, hospital.name);
        await navigate('/panel/schedules/workplaces');
        await wait('location.pathname==="/panel/schedules"', 'compatibility schedule redirect');
        record(`Admin/root real creation/detail controls and canceled hospital edit ${id} ${lang} ${width}`);
      }
    }
    await logout();
  }
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
        assert.equal(await evaluate('document.querySelector("dialog[open] button[type=submit]").disabled'),true);
        await screenshot('doctor-add-location-'+id+'-'+width,lang,true);
        await clickText(copy[lang]['users.cancel']); await wait('!document.querySelector("dialog[open]")','location draft canceled');
        await clickText(copy[lang]['onboarding.doctorPrices']);
        await wait('!!document.querySelector("input[id^=doctor-service-price-]")','doctor owned service pricing');
        assert.equal(await evaluate('document.querySelector("dialog[open] button[type=submit]").disabled'),true);
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
