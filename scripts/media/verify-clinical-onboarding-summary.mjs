import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

assert.equal(process.argv.length, 2, 'No overrides accepted.');
const directory='docs/deployment/evidence/',target=directory+'clinical-onboarding-acceptance-2026-10-18.json';
assert.ok(!existsSync(target),'Accepted evidence must not be replayed.');
const json=name=>JSON.parse(readFileSync(directory+name,'utf8'));
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const log=name=>{const b=readFileSync(directory+name);return b[0]===255&&b[1]===254?b.toString('utf16le'):b.toString('utf8');};
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(r.status,0,'Read-only runtime inspection failed.');return r.stdout;};
const browser=json('clinical-onboarding-doctor-browser-2026-10-18.json'),assets=json('clinical-onboarding-final-static-2026-10-18.json');
// The same-image admin prefix passed before a harness selector selected Search
// instead of Save in the first doctor modal. Preserve that failed remainder;
// accept only its completed admin groups and separately verified doctor/patient delta.
const admin=json('clinical-onboarding-final-browser-2026-10-18-failed-1792289785170.json');
const prior=json('working-hours-acceptance-2026-10-18.json'),older=json('doctor-panel-acceptance-2026-10-18.json');
for(const proof of [browser,assets,prior,older])assert.equal(proof.acceptance,'passed');
assert.equal(browser.image,assets.image);assert.equal(assets.assets.length,70);
assert.equal(admin.image,assets.image);assert.equal(admin.acceptance,'failed');
assert.equal(admin.phase,'clinical-doctor-3-en-1440');assert.equal(admin.checks.length,8);
assert.ok(admin.checks.every(name=>name.startsWith('Admin/root real creation/detail controls')));
assert.equal(admin.screenshots.length,40);assert.equal(browser.checks.length,13);assert.equal(browser.screenshots.length,16);
for(const key of ['hashes','catalog_hashes','finance_hashes']){
 assert.deepEqual(admin.baseline[key],admin.final[key]);assert.deepEqual(admin.baseline[key],browser.baseline[key]);
}
for(const key of ['exceptions','blocked','external'])assert.equal(admin[key].length,0);
assert.ok(admin.requests.every(r=>['GET','OPTIONS'].includes(r.method)||r.method==='POST'&&['/login','/logout'].includes(r.path)));
assert.ok(admin.responses.every(r=>r.status<500));
for(const key of ['hashes','catalog_hashes','finance_hashes'])assert.deepEqual(browser.baseline[key],browser.final[key]);
for(const key of ['exceptions','blocked','external'])assert.equal(browser[key].length,0);
assert.ok(browser.requests.every(r=>['GET','OPTIONS'].includes(r.method)||r.method==='POST'&&['/login','/logout'].includes(r.path)));
assert.ok(browser.responses.every(r=>r.status<500));
assert.ok(browser.networkFailures.every(r=>r.canceled));
for(const [name,count]of [['clinical-onboarding-ui-accepted-2026-10-18.json',156],['clinical-onboarding-transport-fixed-2026-10-18.json',179]]){
 const proof=json(name);assert.equal(proof.success,true);assert.equal(proof.numFailedTestSuites,0);assert.equal(proof.numFailedTests,0);assert.equal(proof.numPassedTests,count);assert.ok(proof.testResults.every(s=>s.status==='passed'));
}
const quality=log('clinical-onboarding-quality-accepted-2026-10-18.log');
for(const pattern of [/76 passed \(76\)/,/790 passed \(790\)/,/All matched files use Prettier code style/,/any=2515, ambient=10, legacyApex=40, undeclared=0/])assert.match(quality,pattern);
assert.match(log('clinical-onboarding-backend-accepted-2026-10-18.log'),/18 passed \(164 assertions\)/);
assert.match(log('clinical-onboarding-legacy-accepted-2026-10-18.log'),/OK \(31 tests, 385 assertions\)/);
assert.match(log('clinical-onboarding-price-delta-2026-10-18.log'),/OK \(1 test, 9 assertions\)/);
assert.match(log('clinical-onboarding-audit-accepted-2026-10-18.log'),/OK \(9 tests, 75 assertions\)/);

const features=[
 'app/Services/HospitalAdministration.php','app/Services/DoctorLocationService.php','app/Services/AdminIdentityService.php','app/Services/DoctorPracticeService.php','app/Services/SchedulingService.php','app/Services/AuditLogger.php',
 'app/Http/Controllers/Api/Admin/HospitalController.php','app/Http/Controllers/Api/Admin/ClinicalAccountController.php','app/Http/Controllers/Api/DoctorLocationController.php','app/Http/Controllers/Api/BookingApiController.php','app/Http/Controllers/Api/Admin/ScheduleReadController.php','routes/api.php',
 'tests/Feature/Api/ClinicalOnboardingTest.php','tests/Feature/Api/AdminScheduleReadContractTest.php',
 'frontend/src/modules/checkupino/profiles/onboarding.ts','frontend/src/modules/checkupino/profiles/useClinicalWrite.ts','frontend/src/modules/checkupino/profiles/practice.ts',
 'frontend/src/modules/checkupino/manifest.ts','frontend/src/panel/registry.ts','frontend/src/panel/menu.ts',
 'frontend/src/pages/Users/ClinicalAccountCreate.tsx','frontend/src/pages/Users/DoctorLocationEditor.tsx','frontend/src/pages/Users/DoctorPractice.tsx','frontend/src/pages/Users/UserDirectory.tsx',
 'frontend/src/pages/Administration/Hospitals.tsx','frontend/src/pages/Administration/ScheduleIndexRedirect.tsx','frontend/src/locales/en.json','frontend/src/locales/fa.json',
 'frontend/src/test/ClinicalOnboarding.test.tsx','frontend/src/test/UserDirectory.test.tsx','frontend/src/test/productRegistry.test.ts','frontend/src/Routes/RouterContract.test.tsx',
];
const contexts=['CURRENT_TASK.md','AI_BOOT.md','docs/TODO.md','docs/ai-context/CONTINUE_PROMPT.md','docs/ai-context/TASK_LOG.md','docs/ai-context/modules/admin-panel.md','docs/ai-context/modules/auth.md','docs/ai-context/modules/booking.md','docs/ai-context/modules/doctor-reports.md','docs/deployment/clinical-onboarding-locations-proposal-2026-10-18.md','docs/deployment/clinical-onboarding-locations-2026-10-18.md'];
const scripts=['scripts/media/verify-clinical-onboarding-static.mjs','scripts/media/verify-clinical-onboarding-browser.mjs','scripts/media/clinical-onboarding-browser-cases.mjs','scripts/media/verify-clinical-onboarding-final-static.mjs','scripts/media/verify-clinical-onboarding-final-browser.mjs','scripts/media/clinical-onboarding-final-browser-cases.mjs','scripts/media/verify-clinical-onboarding-doctor-browser.mjs','scripts/media/clinical-onboarding-doctor-browser-cases.mjs','scripts/media/verify-clinical-onboarding-summary.mjs'];
const allowed=new Set([...features,...contexts]),sourceBindings=new Map(),artifactBindings=new Map();
// Newer accepted source bindings supersede older versions of the same file;
// immutable evidence artifacts themselves must still match every retained digest.
for(const [path,hash]of Object.entries({...older.sources,...prior.sources}))if(!allowed.has(path)){
 assert.equal(sha(path),hash,'Unrelated source changed: '+path);sourceBindings.set(path,hash);
}
for(const proof of [prior,older]){
 for(const group of [proof.evidence,proof.captures,proof.superseded_captures])for(const [path,hash]of Object.entries(group??{})){assert.equal(sha(path),hash,'Historical artifact changed: '+path);artifactBindings.set(path,hash);}
}
assert.equal(readFileSync('docs/ai-context/TASK_LOG.md','utf8').split('\n').length,150);
const adminContainer=JSON.parse(docker(['inspect','checkupino_prod-admin-1']))[0];assert.equal(adminContainer.Image,assets.image);assert.equal(adminContainer.State.Health.Status,'healthy');
assert.equal(JSON.parse(docker(['image','inspect','checkupino-admin:clinical-onboarding-accepted-2026-10-18']))[0].Id,assets.image);
assert.equal(JSON.parse(docker(['image','inspect','checkupino-admin:working-hours-accepted-2026-10-18']))[0].Id,prior.image);
const app=JSON.parse(docker(['inspect','checkupino_app']))[0];assert.equal(app.Image,'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
for(const destination of ['/run/medical-content','/run/medical-scan'])assert.ok(app.Mounts.some(m=>m.Destination===destination&&m.RW===false));
const running=docker(['ps','--format','{{.Names}}']).trim().split(/\r?\n/).filter(name=>name.startsWith('checkupino')).sort();assert.equal(running.length,9);
for(const name of ['checkupino_scan-scanner-1','checkupino_scan-scan-check-1','checkupino_scan-scan-worker-1','checkupino_content-content-parser-1'])assert.equal(JSON.parse(docker(['inspect',name]))[0].State.Running,false);
assert.equal(docker(['ps','--all','--filter','label=com.docker.compose.project=checkupino_schedule_acceptance','--format','{{.Names}}']).trim(),'');
const evidenceNames=readdirSync(directory).filter(name=>name.startsWith('clinical-onboarding-')&&/\.(?:json|log)$/.test(name));
const result={acceptance:'passed',checked_at:new Date().toISOString(),image:assets.image,retained_image_tag:'checkupino-admin:clinical-onboarding-accepted-2026-10-18',rollback_image:prior.image,
 frontend:{full_files:76,full_tests:790,final_route_label_form_delta:156,final_transport_and_related_delta:179},backend:{base_tests:18,base_assertions:164,legacy_tests:31,legacy_assertions:385,price_delta:{tests:1,assertions:9},final_audit:{tests:9,assertions:75}},
 native:{cohorts:20,groups:admin.checks.length+browser.checks.length,requests:admin.requests.length+browser.requests.length,captures:admin.screenshots.length+browser.screenshots.length,admin_prefix:'completed_groups_only_from_retained_failed_remainder',doctor_patient_delta:'passed'},served_assets:70,runtime:running,
 unrelated_source_bindings_preserved:sourceBindings.size,historical_artifacts_preserved:artifactBindings.size,task_log_physical_lines:150,data_and_protected_fingerprints_preserved:true,business_writes:0,password_confirmations:0,jobs_consumed:0,helpers_stopped:true,
 sources:Object.fromEntries([...features,...contexts,...scripts].map(path=>[path,sha(path)])),evidence:Object.fromEntries(evidenceNames.map(name=>[directory+name,sha(directory+name)])),captures:Object.fromEntries([...admin.screenshots,...browser.screenshots].map(path=>[path,sha(path)])),
 scope:'Approved manual clinical onboarding and doctor-selected hospitals/clinics/service prices. Native forms and all drafts canceled; persistence, price generation, late rollback and audit values tested in isolated SQLite. No live account/credential/schedule creation, migration, reseed, backend Compose, scanner or queue action. Current slots/booked money/protected identities unchanged. Initial helper query-contract bug and harness selector quoting retained and superseded.',
 separate_gates:['live_positive_onboarding_profile_schedule_saves','real_mysql_contention_for_new_writers','location_removal_reactivation_and_post_creation_verification','current_scanner_and_exact_job_delivery','large_media_and_thumbnail_publication'],
};
writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({acceptance:result.acceptance,image:result.image,native:result.native,retained_sources:sourceBindings.size,historical_artifacts:artifactBindings.size}));
