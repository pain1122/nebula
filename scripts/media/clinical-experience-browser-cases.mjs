import assert from 'node:assert/strict';

export async function runClinicalExperience(h) {
  const { send, evaluate, wait, navigate, login, logout, locale, copy, record, screenshot, clickText, click, api, nativeSelect, closeNavigationOverlay, baseline, setPhase } = h;
  const view = async (path, selector) => {
    await navigate(path);
    await wait(selector, 'settled clinical experience ' + path);
    await closeNavigationOverlay();
    await evaluate('document.fonts.ready');
  };
  const geometry = async label => {
    const value = await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,cards:Array.from(document.querySelectorAll(".main-content .card")).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}})})');
    assert.ok(value.scrollWidth <= value.width + 1, label + ' page overflow');
    assert.ok(value.cards.every(r=>r.left >= -1 && r.right <= value.width + 1), label + ' cards outside viewport');
  };
  for (const id of (h.patientOnly ? [4] : [4, 5, 2, 1])) {
    await login(id, '/panel/');
    await closeNavigationOverlay();
    for (const lang of ['en', 'fa']) {
      await locale(lang);
      for (const width of [1440, 390]) {
        setPhase('clinical-experience-' + id + '-' + lang + '-' + width);
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
        const clinical = id === 4 || id === 5;
        await view('/panel/', clinical ? 'document.querySelector(".page-content table")' : 'document.querySelector("[data-dashboard-period]")');
        const identity = await api('/api/auth/me'); assert.equal(identity.data.data.id, id);
        const home = await evaluate('document.querySelector(".page-content").textContent');
        if (clinical) {
          assert.ok(home.includes(copy[lang][id === 5 ? 'clinicalHome.doctor' : 'clinicalHome.patient']));
          assert.equal((await api('/api/admin/reservations')).status, 403);
          assert.equal(await evaluate('!!document.querySelector("[data-dashboard-period]")'), false);
          assert.equal(await evaluate('Array.from(document.querySelectorAll("a")).some(e=>e.getAttribute("href")==="/panel/patients")'), false);
        } else assert.equal((await api('/api/admin/dashboard')).status, 200);
        await geometry('home'); await screenshot('home-' + id + '-' + width, lang);
        record('Own dashboard/current identity and authority ' + id + ' ' + lang + ' ' + width);

        await view('/panel/profile', 'document.querySelector("#profile-overview-reports")');
        await clickText(copy[lang]['profileOverview.editName']);
        await wait('document.querySelector("dialog[open] #profile-first-name")', 'profile modal ready');
        const modal = await evaluate('(()=>{const r=document.querySelector("dialog[open] .modal-content").getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}})()');
        assert.ok(modal.left >= -1 && modal.right <= modal.width + 1 && modal.top >= 0 && modal.bottom <= modal.height + 1, 'Profile modal containment');
        assert.equal(await evaluate('!!document.querySelector(".page-content #profile-first-name")'), false);
        await screenshot('profile-modal-' + id + '-' + width, lang, true);
        await clickText(copy[lang]['users.cancel']);
        await wait('!document.querySelector("dialog[open]")', 'profile modal closed without save');
        record('Profile editing is modal/cancel-only ' + id + ' ' + lang + ' ' + width);

        if (id === 4) {
          await view('/panel/book', 'Array.from(document.querySelector("#booking-checkup")?.options??[]).some(o=>o.value==="5")');
          await nativeSelect('#booking-checkup', await evaluate('Array.from(document.querySelector("#booking-checkup").options).findIndex(o=>o.value==="5")'));
          await wait('Array.from(document.querySelector("#booking-doctor")?.options??[]).some(o=>o.value==="2")', 'real doctor discovery');
          await nativeSelect('#booking-doctor', await evaluate('Array.from(document.querySelector("#booking-doctor").options).findIndex(o=>o.value==="2")'));
          await wait('Array.from(document.querySelector("#booking-workplace")?.options??[]).some(o=>o.value==="3")', 'real workplace discovery');
          await nativeSelect('#booking-workplace', await evaluate('Array.from(document.querySelector("#booking-workplace").options).findIndex(o=>o.value==="3")'));
          await wait('document.querySelector("#booking-slot")?.options.length>1 || document.querySelector(".page-content")?.textContent.includes(' + JSON.stringify(copy[lang]['booking.noSlots']) + ')', 'settled real availability or its empty state');
          const available = await evaluate('document.querySelector("#booking-slot")?.options.length>1');
          if (available) await nativeSelect('#booking-slot', 1);
          await geometry('booking'); await screenshot('booking-' + width, lang);
          record('Booking widgets choose actual offering and show ' + (available ? 'a future slot' : 'the current unavailable-slot empty state') + ' without booking ' + lang + ' ' + width);
          await view('/panel/my/questionnaire', 'Array.from(document.querySelectorAll(".page-content button")).some(b=>b.textContent.trim()===' + JSON.stringify(copy[lang]['questionnaire.start']) + ')');
          assert.equal(await evaluate('!!document.querySelector(".page-content img")'), false);
          await geometry('questionnaire-grid'); await screenshot('questionnaire-grid-' + width, lang);
          await clickText(copy[lang]['questionnaire.start']);
          await wait('document.querySelector("#questionnaire-name")', 'selected published questionnaire');
          assert.ok(await evaluate('new URLSearchParams(location.search).has("slug")'));
          await click('.main-content input[type=radio]');
          assert.equal(await evaluate('document.querySelector("progress").value'), 1);
          await geometry('questionnaire-form'); await screenshot('questionnaire-form-' + width, lang);
          record('Published grid placeholders/selected slug/answer progress with no submission ' + lang + ' ' + width);
        }
        if (id === 4 || id === 5) {
          await view('/panel/' + (id === 5 ? 'doctor' : 'my') + '/reservations/' + baseline.reservation + '/medical', 'document.querySelector(".file-manager-sidebar")');
          await wait('document.querySelector(".file-manager-content ul bdi")', 'issued attachment rules');
          assert.equal(await evaluate('Array.from(document.querySelectorAll(".file-manager-content ul bdi")).every(e=>e.dir==="ltr")'), true);
          await geometry('medical');
          if (id === 5) {
            await clickText(copy[lang]['medical.newRequest']);
            await wait('document.querySelector("#medical-category-media")', 'current server categories');
            assert.equal(await evaluate('!!document.querySelector("#medical-request-limit")'), false);
            assert.equal(await evaluate('document.querySelector("#medical-category-archive").disabled && document.querySelector("#medical-category-multimedia").disabled'), true);
            await click('#medical-category-media');
            assert.equal(await evaluate('document.querySelectorAll(".modal.show input[type=checkbox]:checked").length'), 2);
            await screenshot('medical-categories-' + width, lang, true);
            await clickText(copy[lang]['medical.close']);
            await wait('!document.querySelector(".modal.show")', 'request canceled');
          } else await screenshot('attachment-rules-' + width, lang);
          record('Bidi-isolated issued requirements/multi-category preview without write ' + id + ' ' + lang + ' ' + width);
        }
      }
    }
    await logout();
  }
}
