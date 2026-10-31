import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';

assert.equal(process.argv.length,2,'No runtime, account or evidence overrides accepted.');
const directory='docs/deployment/evidence/';
const target=directory+'questionnaire-history-acceptance-2026-10-18.json';
assert.ok(!existsSync(target),'Inspect accepted evidence instead of overwriting.');
const json=name=>JSON.parse(readFileSync(directory+name,'utf8'));
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const log=name=>{const b=readFileSync(directory+name);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8');};
const prior=json('clinical-experience-acceptance-2026-10-17.json');
const release=json('panel-release-acceptance-2026-10-17.json');
const staff=json('staff-directory-acceptance-2026-10-16.json');
const dependencies=json('panel-release-session-quality-2026-10-17.json');
const full=json('questionnaire-history-browser-2026-10-18.json');
const final=json('questionnaire-history-browser-final-2026-10-18.json');
const assets=json('questionnaire-history-static-final-2026-10-18.json');
for(const proof of [prior,full,final,assets])assert.equal(proof.acceptance,'passed');
assert.equal(full.checks.filter(s=>s.startsWith('Native grouped navigation')).length,16);
assert.equal(final.checks.filter(s=>s.startsWith('Native grouped navigation')).length,4);
assert.equal(final.image,assets.image);assert.equal(assets.assets.length,65);
for(const proof of [full,final]){
  for(const key of ['hashes','catalog_hashes','finance_hashes'])assert.deepEqual(proof.final[key],proof.baseline[key]);
  for(const key of ['exceptions','external','blocked'])assert.deepEqual(proof[key],[]);
  assert.ok(proof.responses.every(r=>r.status<500));assert.ok(proof.networkFailures.every(r=>r.canceled));
  assert.ok(proof.requests.every(r=>['GET','OPTIONS'].includes(r.method)||r.method==='POST'&&['/login','/logout'].includes(r.path)));
}
for(const key of ['hashes','catalog_hashes','finance_hashes'])assert.deepEqual(full.final[key],final.final[key]);
const quality=log('questionnaire-history-quality-2026-10-18.log');
assert.match(quality,/Test Files\s+72 passed/);assert.match(quality,/Tests\s+746 passed/);
assert.ok(quality.includes('Quality ratchets pass:'));assert.ok(quality.includes('All matched files use Prettier code style!'));
for(const name of ['questionnaire-history-source-final-2026-10-18.json','questionnaire-history-bidi-delta-2026-10-18.json']){
  const proof=json(name);assert.equal(proof.numPassedTests,23);assert.equal(proof.numFailedTests,0);assert.equal(proof.testResults.length,3);
}
assert.match(log('questionnaire-history-backend-fixed-2026-10-18.log'),/7 passed \(78 assertions\)/);
const featurePaths=[
 'routes/api.php','app/Http/Controllers/Api/PatientQuestionnaireSubmissionController.php','tests/Feature/Api/PatientQuestionnaireHistoryTest.php',
 'frontend/src/panel/menu.ts','frontend/src/Layouts/LayoutMenuData.tsx','frontend/src/Layouts/LayoutMenuData.test.tsx',
 'frontend/src/Layouts/VerticalLayouts/index.tsx','frontend/src/Layouts/HorizontalLayout/index.tsx','frontend/src/Layouts/TwoColumnLayout/index.tsx',
 'frontend/src/modules/checkupino/questionnaire/api.ts','frontend/src/pages/Questionnaire/QuestionnaireWorkspace.tsx','frontend/src/pages/Questionnaire/QuestionnaireHistory.tsx',
 'frontend/src/test/ClinicalExperience.test.tsx','frontend/src/test/productRegistry.test.ts','frontend/src/locales/en.json','frontend/src/locales/fa.json',
];
const contextPaths=['CURRENT_TASK.md','AI_BOOT.md','docs/TODO.md','docs/ai-context/CONTINUE_PROMPT.md','docs/ai-context/TASK_LOG.md','docs/ai-context/modules/admin-panel.md','docs/ai-context/modules/auth.md','docs/ai-context/modules/doctor-reports.md','docs/deployment/questionnaire-history-navigation-2026-10-18.md'];
const scriptPaths=['scripts/media/questionnaire-history-browser-cases.mjs','scripts/media/verify-questionnaire-history-browser.mjs','scripts/media/verify-questionnaire-history-browser-final.mjs','scripts/media/verify-questionnaire-history-static.mjs','scripts/media/verify-questionnaire-history-static-final.mjs','scripts/media/verify-questionnaire-history-summary.mjs'];
let unrelated=0;
for(const [path,expected] of Object.entries({...staff.sources,...release.sources,...prior.sources})){
 if(featurePaths.includes(path)||contextPaths.includes(path))continue;
 assert.equal(sha(path),expected,'Unrelated accepted source changed: '+path);unrelated++;
}
for(const path of ['frontend/package.json','frontend/package-lock.json','frontend/vite.config.ts','frontend/src/index.tsx','frontend/src/modules/checkupino/auth/history.ts'])assert.equal(sha(path),dependencies.sources[path]??release.sources[path],'Dependency/privacy foundation changed: '+path);
let retainedEvidence=0;
for(const [path,expected] of Object.entries({...staff.evidence,...release.evidence,...prior.evidence})){
 assert.equal(sha(path),expected,'Historical evidence changed: '+path);retainedEvidence++;
}
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4000000});assert.equal(r.status,0,'Project runtime inspection failed.');return r.stdout;};
const names=['checkupino_app','checkupino_nginx','checkupino_db','checkupino_redis','checkupino_prod-admin-1','checkupino_media-media-master-1','checkupino_media-media-volume-1','checkupino_media-media-filer-1','checkupino_media-media-s3-1'];
const services=names.map(name=>{const x=JSON.parse(docker(['inspect',name]))[0];assert.equal(x.State.Running,true);return {name,image:x.Image,health:x.State.Health?.Status??null};});
const app=JSON.parse(docker(['inspect','checkupino_app']))[0];
assert.equal(app.Image,'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
for(const destination of ['/run/medical-content','/run/medical-scan'])assert.ok(app.Mounts.some(m=>m.Destination===destination&&m.RW===false));
assert.equal(services.find(s=>s.name==='checkupino_prod-admin-1').image,assets.image);
assert.equal(services.find(s=>s.name==='checkupino_prod-admin-1').health,'healthy');
for(const name of ['checkupino_scan-scanner-1','checkupino_scan-scan-check-1','checkupino_scan-scan-worker-1','checkupino_content-content-parser-1'])assert.equal(JSON.parse(docker(['inspect',name]))[0].State.Running,false);
assert.equal(JSON.parse(docker(['image','inspect','checkupino-admin:questionnaire-history-accepted-2026-10-18']))[0].Id,assets.image);
assert.equal(JSON.parse(docker(['image','inspect','checkupino-admin:clinical-experience-accepted-2026-10-17']))[0].Id,prior.image);
assert.equal(readFileSync('docs/ai-context/TASK_LOG.md','utf8').split('\n').length,150);
const captures=[...full.screenshots,...final.screenshots];
const evidenceNames=['questionnaire-history-quality-2026-10-18.log','questionnaire-history-source-final-2026-10-18.json','questionnaire-history-bidi-delta-2026-10-18.json','questionnaire-history-backend-2026-10-18.log','questionnaire-history-backend-fixed-2026-10-18.log','questionnaire-history-admin-build-2026-10-18.log','questionnaire-history-admin-bidi-build-2026-10-18.log','questionnaire-history-static-2026-10-18.json','questionnaire-history-static-final-2026-10-18.json','questionnaire-history-browser-2026-10-18.json','questionnaire-history-browser-final-2026-10-18.json'];
const result={acceptance:'passed',checked_at:new Date().toISOString(),image:assets.image,retained_image_tag:'checkupino-admin:questionnaire-history-accepted-2026-10-18',rollback_image:prior.image,frontend:{files:72,tests:746,final_affected_tests:23},backend:{tests:7,assertions:78},full_matrix:{cohorts:16,groups:full.checks.length,requests:full.requests.length,captures:full.screenshots.length,image:full.image},final_patient_delta:{cohorts:4,groups:final.checks.length,requests:final.requests.length,captures:final.screenshots.length},served_assets:65,runtime:services,helpers_stopped:true,app_image_and_readonly_sockets_preserved:true,business_writes:0,password_confirmations:0,downloads:0,jobs_consumed:0,all_current_and_historical_fingerprints_preserved:true,unchanged_source_bindings:unrelated,retained_historical_evidence_bindings:retainedEvidence,task_log_physical_lines:150,sources:Object.fromEntries([...featurePaths,...contextPaths,...scriptPaths].map(p=>[p,sha(p)])),evidence:Object.fromEntries(evidenceNames.map(p=>[directory+p,sha(directory+p)])),captures:Object.fromEntries(captures.map(p=>[p,sha(p)])),scope:'Patient-owned saved questionnaire history and grouped role navigation only. Existing panel URLs/Velzon/ENFA/session guards retained. No business replay, dependency/schema/environment/credentials or backend/database/worker/scanner Compose change. Pending clinical jobs, current engine recovery, continuous processing, thumbnails and live profile/admin saves remain separate.'};
writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({acceptance:result.acceptance,image:result.image,full_groups:full.checks.length,final_groups:final.checks.length,captures:captures.length,unchanged_sources:unrelated,historical_evidence:retainedEvidence}));
