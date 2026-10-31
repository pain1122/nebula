import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

assert.equal(process.argv.length,2);
const output='docs/deployment/evidence/form-action-row-acceptance-2026-10-18.json';
assert.ok(!existsSync(output),'Accepted evidence exists; inspect it instead of replaying.');
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const evidence={};
const receipt=kind=>{
  const path=`docs/deployment/evidence/form-action-row-${kind}-2026-10-18.json`;
  evidence[path]=hash(path); return read(path);
};
const parentPath='docs/deployment/evidence/clinical-onboarding-acceptance-2026-10-18.json';
const parent=read(parentPath); assert.equal(parent.acceptance,'passed'); evidence[parentPath]=hash(parentPath);
for(const [path,expected] of Object.entries({...parent.evidence,...parent.captures}))assert.equal(hash(path),expected,'Historical artifact changed: '+path);
const sources=[
  'frontend/src/pages/Administration/Hospitals.tsx','frontend/src/pages/Administration/ActionDialog.tsx',
  'frontend/src/pages/Users/DoctorPractice.tsx','frontend/src/pages/Users/ProfileNameForm.tsx',
  'frontend/src/pages/Users/DoctorLocationEditor.tsx','frontend/src/pages/Reservations/AdminReservationActions.tsx',
];
const docs=['AI_BOOT.md','CURRENT_TASK.md','docs/TODO.md','docs/ai-context/CONTINUE_PROMPT.md',
  'docs/ai-context/modules/admin-panel.md','docs/ai-context/TASK_LOG.md'];
const changed=new Set([...sources,...docs]);
for(const [path,expected] of Object.entries(parent.sources))if(!changed.has(path))assert.equal(hash(path),expected,'Unrelated accepted source changed: '+path);
const frontend={};
for(const kind of ['source','guards']){
  const r=receipt(kind);assert.equal(r.success,true);assert.equal(r.numFailedTests,0);assert.equal(r.numFailedTestSuites,0);
  assert.ok(r.testResults.every(s=>s.status==='passed'));frontend[kind]={files:r.numPassedTestSuites,tests:r.numPassedTests};
}
const staticProof=receipt('static'),browser=receipt('browser');
assert.equal(staticProof.acceptance,'passed');assert.equal(browser.acceptance,'passed');
assert.equal(browser.image,staticProof.image);
assert.deepEqual(browser.baseline.hashes,browser.final.hashes);
assert.deepEqual(browser.baseline.catalog_hashes,browser.final.catalog_hashes);
assert.deepEqual(browser.baseline.finance_hashes,browser.final.finance_hashes);
assert.equal(browser.exceptions.length,0);assert.equal(browser.blocked.length,0);assert.equal(browser.external.length,0);
const rows=browser.checks.filter(c=>c.startsWith('{')).map(c=>JSON.parse(c));assert.equal(rows.length,36);
const captures={};for(const row of rows){assert.ok(row.geometry.topDelta<2);assert.equal(row.geometry.gap,8);captures[row.capture]=hash(row.capture);}
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(r.status,0);return r.stdout;};
const container=JSON.parse(docker(['inspect','checkupino_prod-admin-1']))[0];assert.equal(container.Image,staticProof.image);assert.equal(container.State.Health.Status,'healthy');
assert.equal(JSON.parse(docker(['image','inspect','--format','{{json .Id}}','checkupino-admin:form-actions-accepted-2026-10-18'])),container.Image);
const running=docker(['ps','--format','{{.Names}}']).trim().split(/\r?\n/).sort();
assert.deepEqual(running,['checkupino_app','checkupino_db','checkupino_nginx','checkupino_redis','checkupino_prod-admin-1','checkupino_media-media-master-1','checkupino_media-media-volume-1','checkupino_media-media-filer-1','checkupino_media-media-s3-1'].sort());
assert.equal(readFileSync('docs/ai-context/TASK_LOG.md','utf8').split('\n').length,150);
for(const path of [...sources,...docs,'docs/deployment/form-action-row-2026-10-18.md',
  'scripts/media/verify-form-action-row-static.mjs','scripts/media/verify-form-action-row-browser.mjs',
  'scripts/media/form-action-row-browser-cases.mjs','scripts/media/verify-form-action-row-summary.mjs'])changed.add(path);
const proof={acceptance:'passed',checked_at:new Date().toISOString(),image:container.Image,
  retained_image_tag:'checkupino-admin:form-actions-accepted-2026-10-18',rollback_image:parent.image,
  frontend,served_assets:staticProof.assets.length,native:{rows:36,actors:[2,3,4],languages:['en','fa'],widths:[1440,390],requests:browser.requests.length},
  data_and_protected_fingerprints_preserved:true,business_writes:0,jobs_consumed:0,running_services:running,
  sources:Object.fromEntries([...changed].map(path=>[path,hash(path)])),evidence,captures,
  scope:'Six existing form components; native action alignment/cancel checks cover hospital, shared catalog administration, own profile name, doctor locations/service prices/professional/working hours. Reservation busy/abort/stale controls covered by existing source tests; no live save or root-specific native acceptance inferred. Only static admin recreated.'};
writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({acceptance:'passed',image:proof.image,rows:36,assets:proof.served_assets,frontend}));
