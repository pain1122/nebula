import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';

assert.equal(process.argv.length,2,'No account/runtime/evidence overrides accepted.');
const directory='docs/deployment/evidence/',target=directory+'doctor-panel-acceptance-2026-10-18.json';
assert.ok(!existsSync(target),'Inspect immutable acceptance instead of replaying it.');
const json=name=>JSON.parse(readFileSync(directory+name,'utf8'));
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const log=name=>{const b=readFileSync(directory+name);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8');};
const clinical=json('clinical-experience-acceptance-2026-10-17.json'),release=json('panel-release-acceptance-2026-10-17.json'),staff=json('staff-directory-acceptance-2026-10-16.json');
const prior=json('questionnaire-history-acceptance-2026-10-18.json'),context=json('questionnaire-history-final-context-2026-10-18.json');
const dependencies=json('panel-release-session-quality-2026-10-17.json');
const full=json('doctor-panel-browser-2026-10-18.json'),visual=json('doctor-panel-visual-2026-10-18.json'),assets=json('doctor-panel-static-2026-10-18.json');
for(const proof of [clinical,prior,context,full,visual,assets])assert.equal(proof.acceptance,'passed');
assert.equal(full.image,assets.image);assert.equal(visual.image,assets.image);assert.equal(assets.assets.length,66);
assert.equal(full.checks.filter(s=>s.startsWith('Per-account once-only')).length,20);
assert.equal(full.checks.filter(s=>s.startsWith('Own confirmed calendar and visible')).length,8);
assert.equal(full.checks.filter(s=>s.startsWith('Service/description ->')).length,4);
assert.equal(visual.checks.filter(s=>s.startsWith('Visible owned calendar/')).length,8);
for(const proof of [full,visual]){
 for(const key of ['hashes','catalog_hashes','finance_hashes'])assert.deepEqual(proof.final[key],proof.baseline[key]);
 for(const key of ['exceptions','external','blocked'])assert.deepEqual(proof[key],[]);
 assert.ok(proof.responses.every(row=>row.status<500));assert.ok(proof.networkFailures.every(row=>row.canceled));
 assert.ok(proof.requests.every(row=>['GET','OPTIONS'].includes(row.method)||row.method==='POST'&&['/login','/logout'].includes(row.path)));
}
for(const key of ['hashes','catalog_hashes','finance_hashes'])assert.deepEqual(full.final[key],visual.final[key]);
const quality=log('doctor-panel-quality-accepted-2026-10-18.log');
assert.match(quality,/Test Files\s+74 passed/);assert.match(quality,/Tests\s+759 passed/);assert.ok(quality.includes('Quality ratchets pass:'));assert.ok(quality.includes('All matched files use Prettier code style!'));
const delta=json('doctor-panel-final-source-fixed-2026-10-18.json');
assert.equal(delta.success,true);assert.equal(delta.numFailedTests,0);assert.equal(delta.numFailedTestSuites,0);assert.equal(delta.numPassedTests,80);assert.equal(delta.testResults.length,9);assert.ok(delta.testResults.every(s=>s.status==='passed'));
for(const [name,pattern] of [
 ['doctor-panel-backend-accepted-2026-10-18.log',/8 passed \(83 assertions\)/],
 ['doctor-panel-backend-canonical-delta-2026-10-18.log',/6 passed \(62 assertions\)/],
 ['doctor-panel-backend-calendar-delta-2026-10-18.log',/1 passed \(17 assertions\)/],
 ['doctor-panel-backend-card-privacy-delta-2026-10-18.log',/1 passed \(15 assertions\)/],
])assert.match(log(name),pattern);
const featurePaths=[
 'routes/api.php','app/Http/Controllers/Api/DoctorAppointmentCalendarController.php','app/Http/Controllers/Api/DoctorPracticeController.php','app/Services/DoctorPracticeService.php','app/Http/Controllers/Api/BookingApiController.php','tests/Feature/Api/DoctorPanelExperienceTest.php',
 'frontend/src/modules/checkupino/preferences/customizer.ts','frontend/src/modules/checkupino/preferences/customizer.test.ts','frontend/src/modules/checkupino/profiles/practice.ts','frontend/src/modules/checkupino/dashboard/calendar.ts','frontend/src/modules/checkupino/booking/api.ts',
 'frontend/src/pages/Users/DoctorPractice.tsx','frontend/src/pages/Users/UserProfile.tsx','frontend/src/pages/Booking/PatientBooking.tsx','frontend/src/pages/DashboardEcommerce/ClinicalDashboard.tsx','frontend/src/pages/DashboardEcommerce/AppointmentCalendar.tsx',
 'frontend/src/Components/Common/RightSidebar.tsx','frontend/src/Layouts/index.tsx','frontend/src/Layouts/VerticalLayouts/index.tsx','frontend/src/Layouts/HorizontalLayout/index.tsx','frontend/src/Layouts/TwoColumnLayout/index.tsx','frontend/src/panel/menu.ts',
 'frontend/src/locales/en.json','frontend/src/locales/fa.json','frontend/src/test/DoctorPractice.test.tsx','frontend/src/test/RoleBooking.test.tsx','frontend/src/test/ClinicalExperience.test.tsx','frontend/src/Layouts/ShellLifecycle.test.tsx','frontend/src/Layouts/LayoutMenuData.test.tsx','frontend/src/test/productRegistry.test.ts',
];
const contextPaths=['CURRENT_TASK.md','AI_BOOT.md','docs/TODO.md','docs/ai-context/CONTINUE_PROMPT.md','docs/ai-context/TASK_LOG.md','docs/ai-context/modules/admin-panel.md','docs/ai-context/modules/auth.md','docs/ai-context/modules/booking.md','docs/ai-context/modules/doctor-reports.md','docs/deployment/doctor-panel-booking-wizard-2026-10-18.md'];
const scriptPaths=['scripts/media/doctor-panel-browser-cases.mjs','scripts/media/verify-doctor-panel-browser.mjs','scripts/media/verify-doctor-panel-static.mjs','scripts/media/doctor-panel-visual-cases.mjs','scripts/media/verify-doctor-panel-visual.mjs','scripts/media/verify-doctor-panel-summary.mjs'];
let unchanged=0;
for(const [path,expected] of Object.entries({...staff.sources,...release.sources,...clinical.sources,...prior.sources,...context.sources})){
 if(featurePaths.includes(path)||contextPaths.includes(path))continue;
 assert.equal(sha(path),expected,'Unrelated accepted source changed: '+path);unchanged++;
}
for(const path of ['frontend/package.json','frontend/package-lock.json','frontend/vite.config.ts','frontend/src/index.tsx','frontend/src/modules/checkupino/auth/history.ts']){
 const expected=dependencies.sources[path]??release.sources[path]??staff.sources[path];assert.ok(expected,'Prior foundation binding missing: '+path);assert.equal(sha(path),expected,'Dependency/privacy/quality foundation changed: '+path);
}
let retainedEvidence=0;
for(const [path,expected] of Object.entries({...staff.evidence,...release.evidence,...clinical.evidence,...prior.evidence,...prior.captures})){
 assert.equal(sha(path),expected,'Historical evidence changed: '+path);retainedEvidence++;
}
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4000000});assert.equal(r.status,0,'Project runtime inspection failed.');return r.stdout;};
const names=['checkupino_app','checkupino_nginx','checkupino_db','checkupino_redis','checkupino_prod-admin-1','checkupino_media-media-master-1','checkupino_media-media-volume-1','checkupino_media-media-filer-1','checkupino_media-media-s3-1'];
const runtime=names.map(name=>{const c=JSON.parse(docker(['inspect',name]))[0];assert.equal(c.State.Running,true);return {name,image:c.Image,health:c.State.Health?.Status??null};});
const app=JSON.parse(docker(['inspect','checkupino_app']))[0];assert.equal(app.Image,'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
for(const destination of ['/run/medical-content','/run/medical-scan'])assert.ok(app.Mounts.some(m=>m.Destination===destination&&m.RW===false));
assert.equal(runtime.find(r=>r.name==='checkupino_prod-admin-1').image,assets.image);assert.equal(runtime.find(r=>r.name==='checkupino_prod-admin-1').health,'healthy');
for(const name of ['checkupino_scan-scanner-1','checkupino_scan-scan-check-1','checkupino_scan-scan-worker-1','checkupino_content-content-parser-1'])assert.equal(JSON.parse(docker(['inspect',name]))[0].State.Running,false);
assert.equal(JSON.parse(docker(['image','inspect','checkupino-admin:doctor-panel-accepted-2026-10-18']))[0].Id,assets.image);
assert.equal(JSON.parse(docker(['image','inspect','checkupino-admin:questionnaire-history-accepted-2026-10-18']))[0].Id,prior.image);
assert.equal(readFileSync('docs/ai-context/TASK_LOG.md','utf8').split('\n').length,150);
const superseded=full.screenshots.filter(p=>p.includes('doctor-panel-browser-doctor-calendar-')||p.includes('doctor-panel-browser-doctor-practice-'));
assert.equal(superseded.length,16);
const captures=[...full.screenshots.filter(p=>!superseded.includes(p)),...visual.screenshots];assert.equal(captures.length,56);
const evidenceNames=['doctor-panel-quality-2026-10-18.log','doctor-panel-quality-accepted-2026-10-18.log','doctor-panel-final-source-delta-2026-10-18.json','doctor-panel-final-source-fixed-2026-10-18.json','doctor-panel-backend-accepted-2026-10-18.log','doctor-panel-backend-canonical-delta-2026-10-18.log','doctor-panel-backend-calendar-delta-2026-10-18.log','doctor-panel-backend-card-privacy-delta-2026-10-18.log','doctor-panel-admin-build-2026-10-18.log','doctor-panel-admin-build-fixed-2026-10-18.log','doctor-panel-static-2026-10-18.json','doctor-panel-browser-2026-10-18.json','doctor-panel-visual-2026-10-18.json'];
const result={acceptance:'passed',checked_at:new Date().toISOString(),image:assets.image,retained_image_tag:'checkupino-admin:doctor-panel-accepted-2026-10-18',rollback_image:prior.image,frontend:{full_files:74,full_tests:759,final_affected_tests:80,final_affected_files:9},backend:{full_tests:8,full_assertions:83,canonical_delta:{tests:6,assertions:62},calendar_delta:{tests:1,assertions:17},privacy_delta:{tests:1,assertions:15}},matrix:{cohorts:20,groups:full.checks.length,requests:full.requests.length},visual_delta:{cohorts:8,groups:visual.checks.length,requests:visual.requests.length,captures:visual.screenshots.length},accepted_captures:captures.length,served_assets:66,runtime,helpers_stopped:true,app_image_and_readonly_sockets_preserved:true,business_writes:0,password_confirmations:0,downloads:0,jobs_consumed:0,current_and_historical_fingerprints_preserved:true,unrelated_source_bindings_verified:unchanged,historical_evidence_bindings_verified:retainedEvidence,task_log_physical_lines:150,registry_failure_and_static_recovery_disclosed:true,doctor_calendar_policy:'current_owned_confirmed_canonical_paid_only_completed_excluded',customizer_scope:'once_per_account_browser_with_tab_fallback_and_manual_knob',separate_gates:['live_profile_weekly_admin_saves','weekly_writer_real_mysql_concurrency','doctor_avatar_and_rating_publication','cross_device_preferences','scanner_and_continuous_processing','large_media_and_questionnaire_thumbnails'],sources:Object.fromEntries([...featurePaths,...contextPaths,...scriptPaths].map(p=>[p,sha(p)])),evidence:Object.fromEntries(evidenceNames.map(p=>[directory+p,sha(directory+p)])),captures:Object.fromEntries(captures.map(p=>[p,sha(p)])),superseded_captures:Object.fromEntries(superseded.map(p=>[p,sha(p)])),scope:'Requested doctor practice/confirmed calendar/booking wizard/active navigation/customizer only. No new panel URL, dependency, schema, credential or backend/database/worker/scanner Compose change. Positive saves are isolated tests; native acceptance is guarded read-only plus ordinary synthetic login/logout.'};
writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({acceptance:result.acceptance,image:result.image,groups:full.checks.length+visual.checks.length,requests:full.requests.length+visual.requests.length,accepted_captures:captures.length,unchanged_sources:unchanged,historical_evidence:retainedEvidence}));
