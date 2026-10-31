import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// An isolated profile uses existing demo credentials in memory. It never records them.
// Every setting PUT is forced to a stale revision before reaching Laravel: no settings write can succeed.
const password = readFileSync('.env', 'utf8').match(/^DEMO_SEED_PASSWORD=(.*)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
assert.ok(password, 'Existing configured demo password is required.');
const profile = mkdtempSync(join(tmpdir(), 'checkupino-upload-policy-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-sync',
  '--window-size=1440,1000', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const copy = Object.fromEntries(['en', 'fa'].map(locale => [locale, JSON.parse(readFileSync(`frontend/src/locales/${locale}.json`, 'utf8'))]));
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/upload-policy-panel-browser-2026-10-08.json', import.meta.url));
let ws, sequence = 0, phase = 'setup', failure = null, simulated = null, mockPolicy = null;
const pending = new Map(), requests = [], responses = [], exceptions = [], external = [], guardedWrites = [], checks = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 45000);
  pending.set(id, { resolve, reject, timeout });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const wait = async (expression, label) => {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error('Browser timeout: ' + label);
};
const navigate = path => send('Page.navigate', { url: 'http://localhost:3000' + path });
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const setValue = (selector, value) => evaluate(`(() => {
  const field = document.querySelector(${JSON.stringify(selector)});
  const prototype = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, ${JSON.stringify(value)});
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
const api = path => evaluate(`fetch('http://localhost:8080' + ${JSON.stringify(path)}, { credentials: 'include', headers: { Accept: 'application/json' } }).then(async result => ({ status: result.status, data: await result.json() }))`);
const record = (name, evidence = true) => { checks.push({ name, evidence }); console.log(JSON.stringify({ name, evidence })); };
const menuLinks = () => evaluate(`Array.from(document.querySelectorAll('#navbar-nav a[href]')).map(item => item.getAttribute('href'))`);
const locale = async language => {
  if (await evaluate(`document.documentElement.lang === ${JSON.stringify(language)}`)) return;
  await click('.header-item:has(.language) > button');
  await evaluate(`Array.from(document.querySelectorAll('.language .dropdown-item')).find(item => item.textContent.trim() === ${JSON.stringify(language === 'en' ? 'English' : 'فارسی')}).click()`);
  await wait(`document.documentElement.lang === ${JSON.stringify(language)}`, 'language flag');
  assert.equal(await evaluate('document.documentElement.dir'), language === 'fa' ? 'rtl' : 'ltr');
};
const login = async (account, landing) => {
  phase = account;
  await navigate('/panel/login');
  await wait(`document.querySelector('#email')`, 'login form');
  await setValue('#email', account + '@checkupino.test');
  await setValue('#password-input', password);
  await evaluate(`document.querySelector('form').requestSubmit()`);
  await wait(`${landing === '/panel/' ? '/^\\/panel\\/?$/.test(location.pathname)' : `location.pathname === ${JSON.stringify(landing)}`} && document.querySelector('.topbar-user')`, 'authenticated landing');
  const result = await api('/api/auth/me');
  assert.equal(result.status, 200);
  const identity = result.data.data;
  assert.ok(identity.id && ![7, 8].includes(identity.id), 'Protected verification accounts must remain untouched.');
  return { id: identity.id, roles: identity.roles };
};
const logout = async () => {
  const count = responses.filter(item => item.path === '/logout' && item.status === 200).length;
  await click('.topbar-user > button');
  await wait(`document.querySelector('[data-key="t-logout"]')`, 'logout control');
  await evaluate(`document.querySelector('[data-key="t-logout"]').closest('button').click()`);
  await wait(`location.pathname === '/panel/login' && document.querySelector('#email')`, 'logout landing');
  const deadline = Date.now() + 30000;
  while (responses.filter(item => item.path === '/logout' && item.status === 200).length === count) {
    if (Date.now() > deadline) throw new Error('Logout was not acknowledged.');
    await delay(100);
  }
};
const controls = () => wait(`document.querySelector('#uploads-medical-form') && document.querySelector('#uploads-public_media-form')`, 'both policy cards');
const reason = value => setValue('#uploads-medical-reason', value);
const submit = () => evaluate(`document.querySelector('#uploads-medical-form').requestSubmit()`);
const reload = async () => {
  await click('.page-content .card:first-of-type .card-body > button');
  await wait(`!document.querySelector('#uploads-medical-form fieldset').disabled && document.querySelector('#uploads-medical-reason').value === ''`, 'explicit policy reload');
};
const storageCheck = async () => {
  const keys = await evaluate('Object.keys(localStorage).concat(Object.keys(sessionStorage))');
  assert.ok(!keys.some(key => /token|password|authuser/i.test(key)), 'Credentials must not enter browser storage.');
};

try {
  const activePort = join(profile, 'DevToolsActivePort');
  for (let index = 0; index < 100 && !existsSync(activePort); index++) await delay(100);
  assert.ok(existsSync(activePort), 'Isolated Chrome did not start.');
  const port = Number(readFileSync(activePort, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  const network = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (!item) return;
      clearTimeout(item.timeout);
      message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    else if (message.method === 'Network.requestWillBeSent') {
      const request = message.params.request, url = new URL(request.url);
      if (url.origin === 'http://localhost:8080') {
        const item = { phase, method: request.method, path: url.pathname, has_csrf: Object.keys(request.headers).some(name => name.toLowerCase() === 'x-xsrf-token') };
        requests.push(item); network.set(message.params.requestId, item);
      } else if (/^https?:$/.test(url.protocol) && url.origin !== 'http://localhost:3000') external.push({ phase, origin: url.origin, path: url.pathname });
    } else if (message.method === 'Network.responseReceived') {
      const item = network.get(message.params.requestId);
      if (item) responses.push({ ...item, status: message.params.response.status });
    } else if (message.method === 'Fetch.requestPaused') {
      void (async () => {
        const { requestId, request } = message.params;
        if (request.method === 'PUT') {
          const body = JSON.parse(request.postData);
          assert.ok(/^http:\/\/localhost:8080\/api\/admin\/settings\/uploads\.(medical|public_media)$/.test(request.url));
          assert.match(body.expected_revision, /^[a-f0-9]{64}$/);
          assert.notEqual(body.expected_revision, '0'.repeat(64));
          guardedWrites.push({ phase, key: request.url.split('/').at(-1), value: body.value, has_reason: !!body.reason?.trim(), expected_revision_forced_stale: true });
          await send('Fetch.continueRequest', { requestId, postData: Buffer.from(JSON.stringify({ ...body, expected_revision: '0'.repeat(64) })).toString('base64') });
        } else if (request.method === 'GET' && mockPolicy && request.url.endsWith('uploads.medical')) {
          await send('Fetch.fulfillRequest', { requestId, responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' }, { name: 'Access-Control-Allow-Credentials', value: 'true' }],
            body: Buffer.from(JSON.stringify({ success: true, data: { setting: mockPolicy } })).toString('base64') });
        } else await send('Fetch.continueRequest', { requestId });
      })().catch(async error => {
        failure = String(error.message).replaceAll(password, '[redacted]');
        try { await send('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'Aborted' }); } catch { /* Keep failed requests blocked. */ }
      });
    }
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:8080/api/admin/settings/uploads.*', requestStage: 'Request' }] });
  record('Isolated actual Chrome', (await send('Browser.getVersion')).product);
  await navigate('/panel/upload-limits');
  await wait(`location.pathname === '/panel/login' && document.querySelector('#email')`, 'guest route denial');
  assert.equal((await api('/api/admin/settings/uploads.medical')).status, 401);
  record('Guest page redirects to login and API read returns 401');

  const root = await login('rootadmin', '/panel/');
  assert.ok(root.roles.includes('root-admin'));
  await navigate('/panel/upload-limits'); await controls(); await locale('en');
  const medical = await api('/api/admin/settings/uploads.medical'), publicMedia = await api('/api/admin/settings/uploads.public_media');
  assert.equal(medical.status, 200); assert.equal(publicMedia.status, 200);
  assert.equal(medical.data.data.setting.default_max_bytes, 10485760);
  assert.equal(publicMedia.data.data.setting.default_max_bytes, 5242880);
  assert.equal(await evaluate(`document.querySelector('#uploads-medical-default').value`), '10');
  assert.equal(await evaluate(`document.querySelector('#uploads-public_media-default').value`), '5');
  const links = await menuLinks();
  assert.ok(links.indexOf('/panel/upload-limits') > links.indexOf('/panel/users'));
  record('Root page reads actual 10/5 MiB policies and menu follows Users', root);

  const putsBefore = guardedWrites.length;
  await submit();
  await wait(`document.querySelector('#uploads-medical-reason-error')?.textContent.includes(${JSON.stringify(copy.en['uploads.reasonRequired'])})`, 'required reason');
  await reason('Synthetic deployed policy negative verification');
  await setValue('#uploads-medical-default-unit', 'bytes');
  await setValue('#uploads-medical-default', '10485761'); await submit();
  await wait(`document.querySelector('#uploads-medical-default-error')?.textContent.includes(${JSON.stringify(copy.en['uploads.aboveCapacity'])})`, 'capacity guard');
  await setValue('#uploads-medical-default', '1.1'); await submit();
  await wait(`document.querySelector('#uploads-medical-default-error')?.textContent.includes(${JSON.stringify(copy.en['uploads.wholeBytes'])})`, 'whole-byte guard');
  assert.equal(guardedWrites.length, putsBefore);
  record('Required reason, one byte over capacity and fractional bytes reject before network writes');
  await reload();
  assert.equal(await evaluate(`document.querySelector('#uploads-medical-default').value`), '10');
  record('Explicit reload discards edits and clears the reason');

  await reason('Synthetic password cancellation check'); await submit();
  await wait(`document.querySelector('#recent-password')`, 'real password step-up');
  assert.equal(responses.filter(item => item.method === 'PUT').at(-1)?.status, 423);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await wait(`!document.querySelector('#recent-password') && !document.querySelector('#uploads-medical-form fieldset').disabled`, 'password cancellation');
  assert.equal(guardedWrites.length, putsBefore + 1);
  record('Actual backend 423 opens existing dialog; Escape cancels without retry');

  await submit(); await wait(`document.querySelector('#recent-password')`, 'password prompt retry');
  await setValue('#recent-password', password);
  await evaluate(`document.querySelector('#recent-password-form').requestSubmit()`);
  await wait(`document.querySelector('.page-content').textContent.includes(${JSON.stringify(copy.en['uploads.changed'])})`, 'real stale-revision denial');
  assert.equal(await evaluate(`document.querySelector('#uploads-medical-form fieldset').disabled`), true);
  assert.ok(responses.some(item => item.path === '/api/auth/confirm-password' && item.status === 200));
  assert.equal(responses.filter(item => item.method === 'PUT').at(-1)?.status, 422);
  record('Actual password confirmation retries once; guarded stale revision returns 422 and requires reload', { write_revision_forced_stale: true, settings_write_succeeded: false });
  await reload(); await reason('Synthetic reset rejection check');
  await click('#uploads-medical-form button[type="button"]');
  await wait(`document.querySelector('.page-content').textContent.includes(${JSON.stringify(copy.en['uploads.changed'])})`, 'reset stale guard');
  assert.deepEqual(guardedWrites.at(-1).value, []);
  record('Reset sends empty overrides with reason through ordinary stale-revision rejection');
  await reload();

  // This fixture changes only one intercepted read response in the isolated browser.
  mockPolicy = { ...medical.data.data.setting, revision: 'f'.repeat(64), default_max_bytes: 52428800,
    capacity_max_bytes: 1073741824, scanner_max_bytes: 1073741824,
    policy: { allowed_mime_types: ['application/pdf', 'video/mp4', 'application/zip'], max_bytes_by_mime: { 'application/pdf': 1048576, 'video/mp4': 52428800, 'application/zip': 268435456 } },
    type_limit_overrides: { 'application/pdf': 1048576, 'application/zip': 268435456 } };
  await reason('Synthetic draft before policy refresh');
  await reload();
  await wait(`document.querySelector('.page-content').textContent.includes('video/mp4')`, 'future MIME fixture');
  assert.equal(await evaluate(`document.querySelector('#uploads-medical-default').value`), '50');
  assert.equal(await evaluate(`document.querySelector('#uploads-medical-type-0').value`), '1');
  assert.equal(await evaluate(`document.querySelector('#uploads-medical-type-2').value`), '256');
  simulated = { intercepted_get_only: true, section_default_mib: 50, document_limit_mib: 1, zip_limit_mib: 256, live_policy_changed: false };
  record('Browser-only future MIME/capacity fixture adapts controls on explicit reload', simulated);
  mockPolicy = null;
  await reload(); await locale('fa');
  for (const key of ['medical', 'public', 'default', 'reason', 'save', 'reset'])
    assert.ok((await evaluate(`document.querySelector('.page-content').textContent`)).includes(copy.fa['uploads.' + key]));
  await setValue('#uploads-medical-default', '۱٫۵');
  await reason('Synthetic Persian exact-byte negative check'); await submit();
  await wait(`document.querySelector('.page-content').textContent.includes(${JSON.stringify(copy.fa['uploads.changed'])})`, 'Persian conversion and stale guard');
  assert.equal(guardedWrites.at(-1).value.max_bytes, 1572864);
  record('Farsi flag owns RTL, paired labels and Persian decimal equals exact 1.5 MiB before rejected write');
  await reload(); await send('Page.reload'); await controls();
  assert.equal(await evaluate(`document.documentElement.lang`), 'fa');
  assert.equal(await evaluate(`document.querySelector('#uploads-medical-default').value`), '10');
  assert.equal(await evaluate(`document.querySelector('#uploads-medical-reason').value`), '');
  record('Deep-link refresh retains locale and reads unchanged actual policy');
  await storageCheck(); await logout();

  for (const [account, role, landing] of [['admin', 'admin', '/panel/'], ['doctor', 'doctor', '/panel/doctor/reservations'], ['patient', 'patient', '/panel/book']]) {
    const identity = await login(account, landing);
    assert.ok(identity.roles.includes(role));
    assert.ok(!(await menuLinks()).includes('/panel/upload-limits'));
    await navigate('/panel/upload-limits');
    await wait(`${landing === '/panel/' ? '/^\\/panel\\/?$/.test(location.pathname)' : `location.pathname === ${JSON.stringify(landing)}`} && document.querySelector('.topbar-user')`, 'role route denial');
    assert.equal(await evaluate(`!!document.querySelector('#uploads-medical-form')`), false);
    assert.equal((await api('/api/admin/settings/uploads.medical')).status, 403);
    assert.equal((await api('/api/admin/settings/uploads.public_media')).status, 403);
    record('Deployed ' + role + ' has no link/page and both APIs return 403', identity);
    await storageCheck(); await logout();
  }
  assert.equal(exceptions.length, 0, 'No uncaught browser exceptions.');
  assert.equal(external.length, 0, 'No external page HTTP requests.');
  assert.equal(requests.filter(item => item.method === 'OPTIONS' && !guardedWrites.some(write => item.path.endsWith(write.key)) && item.path !== '/api/auth/confirm-password' && item.path !== '/login' && item.path !== '/logout').length, 0, 'Reads must not cause preflights.');
  assert.ok(responses.filter(item => item.method === 'PUT').every(item => [422, 423].includes(item.status)), 'Every live setting request must remain rejected.');
  assert.ok(requests.filter(item => item.method === 'PUT').every(item => item.has_csrf), 'All setting writes carry CSRF.');
  assert.equal(failure, null);
  record('No settings write succeeded; credential storage, read preflight, CSRF, external-request and exception checks pass');
} catch (error) {
  failure = String(error.message).replaceAll(password, '[redacted]');
  process.exitCode = 1;
  console.error(JSON.stringify({ acceptance: 'failed', phase, message: failure }));
} finally {
  const evidence = { checked_at: new Date().toISOString(), acceptance: failure ? 'failed' : 'passed', phase, failure, checks,
    requests, responses, exceptions, external, guarded_writes: guardedWrites, simulated_policy: simulated,
    scope: 'Actual served Chrome access/read/negative-control acceptance. All PUT revisions forced stale before Laravel; no live settings changes. Future policy is an intercepted GET fixture only. Successful live save/reset/audit and actual deployment policy mutation are not claimed.' };
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  if (ws?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch { /* Own browser exits below. */ } ws.close(); }
  for (const item of pending.values()) clearTimeout(item.timeout);
  browser.kill();
}
