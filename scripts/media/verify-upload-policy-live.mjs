import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// One approved live acceptance: ordinary UI save, readonly DB/audit verification,
// then ordinary UI reset. The request guard allows only this run's reviewed values.
// No request payload, CSRF header or revision is modified by the verifier.
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/upload-policy-live-2026-10-08.json', import.meta.url));
const prior = process.argv.includes('--verify-existing') ? JSON.parse(readFileSync(evidencePath,'utf8')) : null;
const run = prior?.run ?? `checkupino-upload-policy-${Date.now()}`;
const saveReason = `Synthetic demo acceptance ${run}: save 2 MiB default and 1 MiB PDF`;
const resetReason = `Synthetic demo acceptance ${run}: restore configured defaults`;
const savedValue = { max_bytes: 2097152, type_limits: { 'application/pdf': 1048576 } };
const password = readFileSync('.env', 'utf8').match(/^DEMO_SEED_PASSWORD=(.*)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
assert.ok(password, 'Existing demo password is required.');
const profile = mkdtempSync(join(tmpdir(), 'checkupino-upload-live-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-sync',
  '--window-size=1440,1000', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let ws, sequence = 0, phase = 'baseline', approved = null, failure = null, baseline = null, saved = null, restored = null;
const pending = new Map(), checks = prior?.checks ?? [], responses = [], guarded = [], exceptions = [];
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
  while (Date.now() < deadline) { if (failure) throw new Error(failure); if (await evaluate(`Boolean(${expression})`)) return; await delay(100); }
  throw new Error('Browser timeout: ' + label);
};
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const setValue = (selector, value) => evaluate(`(() => {
  const field = document.querySelector(${JSON.stringify(selector)});
  const prototype = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, ${JSON.stringify(value)});
  field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
const api = path => evaluate(`fetch('http://localhost:8080' + ${JSON.stringify(path)}, { credentials: 'include', headers: { Accept: 'application/json' } }).then(async response => ({ status: response.status, data: await response.json() }))`);
const record = (name, evidence = true) => { checks.push({ name, evidence }); console.log(JSON.stringify({ name, evidence })); };
const snapshot = () => {
  const php = `<?php
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
$policies = $app->make(App\\Services\\UploadPolicySettings::class);
$effective = $policies->forSection('medical')->descriptor();
$protected = App\\Models\\User::whereIn('id', [7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray();
$otherSettings = App\\Models\\SettingValue::whereHas('definition', fn($query) => $query->where('key','!=','uploads.medical'))->orderBy('id')->get()->toArray();
$events = App\\Models\\AuditEvent::where('action','settings.marketplace.updated')->where('reason','like','%${run}%')->orderBy('id')->get();
echo json_encode([
 'checked_at' => now('Asia/Tehran')->toIso8601String(),
 'mysql_select' => Illuminate\\Support\\Facades\\DB::selectOne('SELECT 1 AS connected')->connected,
 'redis_ping' => (string) Illuminate\\Support\\Facades\\Redis::ping(),
 'scanning_enabled' => config('medical.scanner.enabled'), 'private_driver' => config('filesystems.disks.private.driver'),
 'log_writable' => is_writable(storage_path('logs/laravel.log')),
 'medical' => $policies->describe('uploads.medical'), 'public_media' => $policies->describe('uploads.public_media'),
 'effective_medical' => $effective,
 'counts' => ['reservation_files' => App\\Models\\ReservationFile::withTrashed()->count(), 'reservation_medical_requests' => App\\Models\\ReservationMedicalRequest::count(), 'reservation_reports' => App\\Models\\ReservationReport::count(), 'jobs' => Illuminate\\Support\\Facades\\DB::table('jobs')->count(), 'setting_definitions' => App\\Models\\SettingDefinition::count(), 'setting_values' => App\\Models\\SettingValue::count(), 'upload_setting_definitions' => App\\Models\\SettingDefinition::whereIn('key',['uploads.medical','uploads.public_media'])->count()],
 'protected_accounts_fingerprint' => hash('sha256', json_encode($protected, JSON_THROW_ON_ERROR)),
 'other_settings_fingerprint' => hash('sha256', json_encode($otherSettings, JSON_THROW_ON_ERROR)),
 'audits' => $events->map(fn($event) => ['id'=>$event->id,'public_id'=>$event->public_id,'actor_id'=>$event->actor_user_id,'action'=>$event->action,'subject_type'=>$event->subject_type,'subject_id'=>$event->subject_id,'risk_level'=>$event->risk_level,'reason'=>$event->reason,'outcome'=>$event->outcome,'before'=>$event->before,'after'=>$event->after,'route'=>$event->route,'correlation_id'=>$event->correlation_id])->all(),
], JSON_THROW_ON_ERROR);
`;
  const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 25000 });
  assert.equal(result.status, 0, 'Readonly www-data policy/audit snapshot must succeed.');
  return JSON.parse(result.stdout);
};
const unchanged = state => {
  assert.equal(state.mysql_select, 1); assert.ok(['1','PONG','+PONG'].includes(state.redis_ping));
  assert.equal(state.scanning_enabled, false); assert.equal(state.private_driver, 'local');
  for (const key of ['reservation_files','reservation_medical_requests','reservation_reports','jobs']) assert.equal(state.counts[key], 0);
  assert.deepEqual(state.public_media, baseline.public_media);
  assert.equal(state.other_settings_fingerprint, baseline.other_settings_fingerprint);
  assert.equal(state.protected_accounts_fingerprint, baseline.protected_accounts_fingerprint);
};
const audit = (event, reason, before, after) => {
  assert.equal(event.actor_id, 1); assert.equal(event.action, 'settings.marketplace.updated');
  assert.equal(event.subject_type, 'App\\Models\\SettingValue'); assert.equal(event.risk_level, 'high');
  assert.equal(event.reason, reason); assert.equal(event.outcome, 'succeeded');
  assert.equal(event.route, 'PUT /api/admin/settings/uploads.medical'); assert.match(event.correlation_id, /^[\da-f-]{36}$/);
  assert.deepEqual(event.before, before);
  assert.deepEqual(event.after, { setting_key: 'uploads.medical', scope_type: 'platform', scope_key: 'marketplace', value: after });
};
const switchLocale = async language => {
  if (await evaluate(`document.documentElement.lang === ${JSON.stringify(language)}`)) return;
  await click('.header-item:has(.language) > button');
  await evaluate(`Array.from(document.querySelectorAll('.language .dropdown-item')).find(item => item.textContent.trim() === ${JSON.stringify(language === 'en' ? 'English' : 'فارسی')}).click()`);
  await wait(`document.documentElement.lang === ${JSON.stringify(language)}`, 'flag locale');
};
try {
  if(prior) {
    assert.ok(prior.saved && prior.restored,'Only an already verified save AND reset may use readonly continuation.');
    baseline=prior.baseline; saved=prior.saved; restored=snapshot(); unchanged(restored);
    assert.deepEqual(restored.counts,prior.restored.counts);
    assert.deepEqual(restored.medical,prior.restored.medical);
    assert.deepEqual(restored.audits,prior.restored.audits);
    audit(restored.audits[0],saveReason,null,savedValue);
    audit(restored.audits[1],resetReason,{setting_key:'uploads.medical',scope_type:'platform',scope_key:'marketplace',value:savedValue},[]);
    record('Readonly continuation verifies both existing audits and restored policies; no writes replayed');
  } else {
    baseline = snapshot();
    assert.equal(baseline.log_writable, true);
    assert.deepEqual(baseline.counts, { reservation_files:0,reservation_medical_requests:0,reservation_reports:0,jobs:0,setting_definitions:3,setting_values:3,upload_setting_definitions:0 });
    assert.deepEqual(baseline.medical.value, []); assert.equal(baseline.medical.default_max_bytes, 10485760);
    assert.equal(baseline.public_media.default_max_bytes, 5242880); assert.equal(baseline.audits.length, 0);
    unchanged(baseline);
    record('Readonly pristine baseline, FPM log writeability and protected-account/other-setting fingerprints pass');
  }
  const activePort = join(profile, 'DevToolsActivePort');
  for (let index=0; index<100 && !existsSync(activePort); index++) await delay(100);
  assert.ok(existsSync(activePort), 'Isolated Chrome did not start.');
  const port = Number(readFileSync(activePort,'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve,reject) => { ws.addEventListener('open',resolve,{once:true}); ws.addEventListener('error',reject,{once:true}); });
  const network = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const item = pending.get(message.id); pending.delete(message.id); if (!item) return;
      clearTimeout(item.timeout); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    else if (message.method === 'Network.requestWillBeSent') {
      const request=message.params.request, url=new URL(request.url);
      if (url.origin==='http://localhost:8080') network.set(message.params.requestId,{phase,path:url.pathname,method:request.method,has_csrf:Object.keys(request.headers).some(name=>name.toLowerCase()==='x-xsrf-token')});
    } else if (message.method === 'Network.responseReceived') {
      const item=network.get(message.params.requestId); if(item) responses.push({...item,status:message.params.response.status});
    } else if (message.method === 'Fetch.requestPaused') {
      void (async () => {
        const {requestId,request}=message.params;
        if(request.method==='PUT') {
          assert.ok(approved,'No setting writes outside the reviewed save/reset phase.');
          assert.equal(request.url,'http://localhost:8080/api/admin/settings/uploads.medical');
          const body=JSON.parse(request.postData);
          assert.deepEqual(body,{scope_type:'platform',scope_key:'marketplace',value:approved.value,reason:approved.reason,expected_revision:approved.revision});
          assert.ok(guarded.filter(item=>item.phase===phase).length<2,'No extra setting retries.');
          guarded.push({phase,key:'uploads.medical',value:body.value,reason:body.reason,revision:body.expected_revision,forwarded_unchanged:true});
        }
        await send('Fetch.continueRequest',{requestId});
      })().catch(async error => { failure=String(error.message).replaceAll(password,'[redacted]'); try{await send('Fetch.failRequest',{requestId:message.params.requestId,errorReason:'Aborted'});}catch{} });
    }
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:8080/api/admin/settings/*',requestStage:'Request'}]});
  await send('Page.navigate',{url:'http://localhost:3000/panel/login'});
  await wait(`document.querySelector('#email')`,'login fields');
  await setValue('#email','rootadmin@checkupino.test'); await setValue('#password-input',password);
  await evaluate(`document.querySelector('form').requestSubmit()`);
  await wait(`/^\\/panel\\/?$/.test(location.pathname) && document.querySelector('.topbar-user')`,'root landing');
  const identity=(await api('/api/auth/me')).data.data;
  assert.equal(identity.id,1); assert.ok(identity.roles.includes('root-admin'));
  await send('Page.navigate',{url:'http://localhost:3000/panel/upload-limits'});
  await wait(`document.querySelector('#uploads-medical-form') && document.querySelector('#uploads-public_media-form')`,'actual policy forms');
  await switchLocale('en');
  const initial=(await api('/api/admin/settings/uploads.medical')).data.data.setting;
  assert.deepEqual(initial,prior ? restored.medical : baseline.medical);
  if(!prior) {
  phase='save'; approved={revision:initial.revision,value:savedValue,reason:saveReason};
  await setValue('#uploads-medical-default','2');
  await setValue('#uploads-medical-type-0','1');
  await setValue('#uploads-medical-type-0-unit','MiB');
  await setValue('#uploads-medical-reason',saveReason);
  await evaluate(`document.querySelector('#uploads-medical-form').requestSubmit()`);
  await wait(`document.querySelector('#recent-password')`,'actual step-up prompt');
  assert.equal(responses.filter(item=>item.method==='PUT').at(-1)?.status,423);
  await setValue('#recent-password',password);
  await evaluate(`document.querySelector('#recent-password-form').requestSubmit()`);
  await wait(`document.querySelector('#uploads-medical-reason').value === '' && !document.querySelector('#uploads-medical-form fieldset').disabled && document.querySelector('.page-content output.alert-success')`,'successful save and authoritative refresh');
  approved=null;
  const read=(await api('/api/admin/settings/uploads.medical')).data.data.setting;
  assert.deepEqual(read.value,savedValue); assert.equal(read.default_max_bytes,2097152);
  assert.deepEqual(read.type_limit_overrides,{'application/pdf':1048576});
  saved=snapshot(); unchanged(saved);
  assert.deepEqual(saved.effective_medical.max_bytes_by_mime,{'application/pdf':1048576,'image/jpeg':2097152,'image/png':2097152});
  assert.deepEqual(saved.counts,{...baseline.counts,setting_definitions:4,setting_values:4,upload_setting_definitions:1});
  assert.equal(saved.audits.length,1); audit(saved.audits[0],saveReason,null,savedValue);
  record('Actual English UI save passes step-up, refreshes effective limits and creates one high-risk before/after audit',{default_bytes:2097152,pdf_bytes:1048576,audit_id:saved.audits[0].public_id});
  await switchLocale('fa');
  const current=(await api('/api/admin/settings/uploads.medical')).data.data.setting;
  assert.equal(current.revision,read.revision,'An intervening change must not be overwritten.');
  phase='reset'; approved={revision:read.revision,value:[],reason:resetReason};
  await setValue('#uploads-medical-reason',resetReason);
  await click('#uploads-medical-form button[type="button"]');
  await wait(`document.querySelector('#uploads-medical-default').value === '10' && document.querySelector('#uploads-medical-reason').value === '' && !document.querySelector('#uploads-medical-form fieldset').disabled`,'successful normal reset and refresh');
  approved=null;
  restored=snapshot(); unchanged(restored);
  assert.deepEqual(restored.medical.value,[]);
  assert.deepEqual(restored.effective_medical,baseline.effective_medical);
  assert.equal(restored.medical.default_max_bytes,10485760);
  assert.deepEqual(restored.counts,saved.counts); assert.equal(restored.audits.length,2);
  audit(restored.audits[1],resetReason,{setting_key:'uploads.medical',scope_type:'platform',scope_key:'marketplace',value:savedValue},[]);
  assert.equal(saved.audits[0].subject_id,restored.audits[1].subject_id);
  assert.deepEqual(restored.audits[0],saved.audits[0],'Original audit is retained intact.');
  record('Actual Farsi reset restores medical 10 MiB/PDF default and retains two high-risk audits',{medical_bytes:10485760,public_bytes:5242880,audit_ids:restored.audits.map(item=>item.public_id),definition_and_value_retained:true});
  }
  await send('Page.reload');
  await wait(`document.querySelector('#uploads-medical-default')?.value === '10' && document.querySelector('#uploads-public_media-default')?.value === '5'`,'persisted defaults after deep-link reload');
  const keys=await evaluate('Object.keys(localStorage).concat(Object.keys(sessionStorage))');
  assert.ok(!keys.some(key=>/token|password|authuser/i.test(key))); assert.equal(exceptions.length,0);
  const writeResponses=(prior?.responses ?? responses).filter(item=>item.method==='PUT');
  assert.deepEqual(writeResponses.map(item=>item.status),[423,200,200]);
  assert.ok(writeResponses.every(item=>item.has_csrf));
  if(prior) assert.equal(guarded.length,0,'Readonly continuation must not repeat writes.');
  const logoutBefore=responses.filter(item=>item.path==='/logout' && item.status===200).length;
  await click('.topbar-user > button'); await wait(`document.querySelector('[data-key="t-logout"]')`,'logout control');
  await evaluate(`document.querySelector('[data-key="t-logout"]').closest('button').click()`);
  await wait(`location.pathname === '/panel/login' && document.querySelector('#email')`,'logout landing');
  const logoutDeadline=Date.now()+30000;
  while(responses.filter(item=>item.path==='/logout' && item.status===200).length===logoutBefore) {
    if(Date.now()>logoutDeadline) throw new Error('Logout was not acknowledged.');
    await delay(100);
  }
  assert.equal((await api('/api/auth/me')).status,401);
  record('Deep-link reload preserves restored policies; CSRF/storage/exception checks and acknowledged guest logout pass');
} catch(error) {
  failure=String(error.message).replaceAll(password,'[redacted]'); process.exitCode=1;
  console.error(JSON.stringify({acceptance:'failed',phase,message:failure,save_verified:!!saved,reset_verified:!!restored}));
} finally {
  const evidence={checked_at:new Date().toISOString(),run,acceptance:failure?'failed':'passed',phase,failure,baseline,saved,restored,checks,responses:[...(prior?.responses??[]),...responses],guarded_requests:[...(prior?.guarded_requests??[]),...guarded],exceptions,readonly_continuation:!!prior,
    scope:'Authorized October 8 ordinary live medical-policy save/reset only. Root account 1, preserved revision/CSRF/password/reason/audit. No payload rewriting, migrations, reset/reseed, file upload, scanner/worker or other-project operation. Medical setting definition/value and both audits intentionally retained.'};
  writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');
  if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}ws.close();}
  for(const item of pending.values())clearTimeout(item.timeout); browser.kill();
}
