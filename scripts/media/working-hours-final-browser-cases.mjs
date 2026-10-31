import assert from 'node:assert/strict';

export async function runWorkingHoursFinalBrowser(h) {
  const { send, evaluate, wait, navigate, login, logout, locale, copy, record, screenshot,
    clickText, click, closeNavigationOverlay, setPhase, setValue, pointerExpression, api } = h;
  for (const id of [3, 5]) {
    await login(id, '/panel/');
    await closeNavigationOverlay();
    for (const lang of ['en', 'fa']) {
      await locale(lang);
      for (const width of [1440, 390]) {
        setPhase(`working-hours-${id}-${lang}-${width}`);
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
        await navigate('/panel/profile');
        await wait('!!document.querySelector("#doctor-practice button.btn-soft-primary")', 'own workplace schedule');
        await closeNavigationOverlay();
        const before = await api('/api/doctor/practice');
        assert.equal(before.status, 200);
        assert.equal(before.data.data.owner_id, id);
        await click('#doctor-practice button.btn-soft-primary');
        await wait('!!document.querySelector("[data-working-hours-editor]")', 'working-hours editor');
        assert.equal(await evaluate('document.querySelectorAll("[data-working-day]").length'), 7);
        const day = await evaluate('document.querySelector("[data-working-shift]").closest("[data-working-day]").dataset.workingDay');
        const scope = `[data-working-day="${day}"] [data-working-shift]`;
        while (await evaluate('document.querySelectorAll('+JSON.stringify(scope)+').length > 1')) {
          await pointerExpression('Array.from(document.querySelectorAll('+JSON.stringify(scope+' button')+')).filter(b=>b.textContent.trim()==='+JSON.stringify(copy[lang]['doctorPractice.removeWindow'])+').at(-1)');
        }
        // Real React form interactions modify only an unsaved draft. All PUT/step-up requests remain blocked.
        await setValue(`${scope} input[id$="-start"]`, '08:00');
        await setValue(`${scope} input[id$="-end"]`, '16:00');
        const remove = copy[lang]['doctorPractice.removeBreak'];
        while (await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(scope + ' button')})).some(b=>b.getAttribute('aria-label')===${JSON.stringify(remove)})`)) {
          await pointerExpression(`Array.from(document.querySelectorAll(${JSON.stringify(scope + ' button')})).find(b=>b.getAttribute('aria-label')===${JSON.stringify(remove)})`);
        }
        await pointerExpression(`Array.from(document.querySelectorAll(${JSON.stringify(scope + ' button')})).find(b=>b.textContent.trim()===${JSON.stringify(copy[lang]['doctorPractice.addBreak'])})`);
        await setValue(`${scope} input[id*="-break-start-"]`, '12:00');
        await setValue(`${scope} input[id*="-break-end-"]`, '13:00');
        await setValue(`${scope} input[id$="-duration"]`, '30');
        await wait(`document.querySelector(${JSON.stringify(scope + ' [data-shift-preview]')}).querySelectorAll('bdi').length===14`, 'fourteen real appointment times');
        assert.equal(await evaluate('document.querySelectorAll("[data-working-hours-editor] [role=alert]").length'), 0, 'Complete draft must be valid');
        const breakWidths = await evaluate('Array.from(document.querySelectorAll('+JSON.stringify(scope+' input[id*="-break-"]')+')).map(e=>e.getBoundingClientRect().width)');
        assert.ok(breakWidths.every(width=>width>=160), 'Native time controls must have room for clock text');
        assert.equal(await evaluate('document.querySelector("dialog[open] .modal-dialog").classList.contains("modal-lg")'), true);
        await evaluate('document.querySelector("dialog[open]").scrollTop=0');
        await screenshot('overview-'+id+'-'+width,lang,true);
        const starts = await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(scope + ' [data-shift-preview] bdi')})).map(e=>e.textContent)`);
        assert.ok(!starts.includes('12:00') && starts.includes('13:00') && starts.includes('15:30'));
        assert.equal(await evaluate('document.querySelector("dialog[open] button[type=submit]").disabled'), true);
        await evaluate(`document.querySelector(${JSON.stringify(scope)}).scrollIntoView({block:'start',behavior:'instant'})`);
        await screenshot(`shift-${id}-${width}`, lang, true);
        await evaluate(`document.querySelector(${JSON.stringify(scope + ' [data-shift-preview]')}).scrollIntoView({block:'center',behavior:'instant'})`);
        await screenshot(`capacity-${id}-${width}`, lang, true);
        const overflow = await evaluate('document.querySelector("dialog[open] .modal-content").scrollWidth > document.querySelector("dialog[open] .modal-content").clientWidth + 2');
        assert.equal(overflow, false, 'Working-hours content must fit its modal');
        await clickText(copy[lang]['users.cancel']);
        await wait('!document.querySelector("dialog[open]")', 'draft canceled');
        const after = await api('/api/doctor/practice');
        assert.deepEqual(after.data.data, before.data.data, 'Canceled shift draft must not alter saved rules');
        record(`Own full-day/rest/capacity draft and unchanged canceled schedule ${id} ${lang} ${width}`);
      }
    }
    await logout();
  }
}
