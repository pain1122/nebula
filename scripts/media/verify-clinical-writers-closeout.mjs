import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scheduleScope as s } from './schedule-acceptance-guard.mjs';

assert.equal(process.argv.length,2,'No target/account/command overrides accepted.');
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const output='docs/deployment/evidence/clinical-writers-closeout-2026-10-22.json';
assert.ok(!existsSync(output),'Closeout exists; inspect accepted evidence instead of overwriting.');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const proofPath='docs/deployment/evidence/clinical-writers-mysql-2026-10-22.json';
const proof=JSON.parse(readFileSync(proofPath,'utf8'));
assert.equal(proof.acceptance,'passed');assert.equal(proof.cases.length,19);
assert.equal(proof.mysql,'8.0.46');assert.equal(proof.isolation,'REPEATABLE-READ');
assert.equal(proof.default_queue_sentinel_unchanged,true);assert.equal(proof.medical_jobs,0);
assert.equal(proof.production_source_unchanged,true);assert.equal(proof.unrelated_containers_unchanged,true);
assert.equal(proof.cases.reduce((n,c)=>n+c.committed_audits,0),22);
assert.equal(proof.cases.filter(c=>c.booking_created).length,3);
for(const [path,expected] of Object.entries({...proof.sources,...proof.protected_sources}))assert.equal(hash(path),expected,'Accepted source changed: '+path);
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(r.status,0,'Read-only Docker inspection failed.');return r.stdout;};
assert.equal(docker(['ps','-a','--filter','label=com.docker.compose.project='+s.project,'--format','{{.Names}}']).trim(),'','Disposable project still exists.');
assert.ok(!docker(['ps','-a','--format','{{.Names}}']).trim().split(/\r?\n/).includes(s.container),'Exact disposable container still exists.');
assert.ok(!docker(['network','ls','--format','{{.Name}}']).trim().split(/\r?\n/).includes(s.network),'Disposable network still exists.');
const runtime=[];
for(const name of ['checkupino_db','checkupino_redis','checkupino_app','checkupino_nginx','checkupino_prod-admin-1',
  'checkupino_media-media-master-1','checkupino_media-media-volume-1','checkupino_media-media-filer-1','checkupino_media-media-s3-1']){
  const value=JSON.parse(docker(['inspect','--format','{{json .}}',name]));assert.equal(value.State.Running,true);
  if(name==='checkupino_app')assert.equal(value.Image,s.phpImage);
  if(name==='checkupino_prod-admin-1'){
    const accepted=JSON.parse(readFileSync('docs/deployment/evidence/form-action-row-acceptance-2026-10-18.json','utf8'));
    assert.equal(value.Image,accepted.image);assert.equal(value.State.Health.Status,'healthy');
  }
  runtime.push({name,id:value.Id,image:value.Image});
}
for(const name of ['checkupino_scan-scanner-1','checkupino_scan-scan-check-1','checkupino_scan-scan-worker-1',
  'checkupino_scan-scan-init-1','checkupino_content-content-parser-1','checkupino_content-content-init-1']){
  assert.equal(JSON.parse(docker(['inspect','--format','{{json .State.Running}}',name])),false,'Helper unexpectedly running.');
}
assert.match(readFileSync('docs/deployment/evidence/clinical-writers-source-2026-10-22.log','utf8'),/OK \(9 tests, 75 assertions\)/);
assert.equal(readFileSync('docs/ai-context/TASK_LOG.md','utf8').split('\n').length,150);
const paths=['CURRENT_TASK.md','docs/TODO.md','docs/ai-context/CONTINUE_PROMPT.md','docs/ai-context/modules/booking.md',
  'docs/ai-context/TASK_LOG.md','docs/deployment/clinical-writers-mysql-2026-10-22.md','scripts/media/verify-clinical-writers-closeout.mjs',
  'docs/deployment/evidence/clinical-writers-source-2026-10-22.log',...Object.keys(proof.sources),...Object.keys(proof.protected_sources)];
const result={acceptance:'passed',checked_at:new Date().toISOString(),mysql_cases:19,synthetic_audits:22,synthetic_bookings:3,
  database_project:s.project,exact_test_container_absent:true,exact_test_network_absent:true,cleanup_verified:true,
  cleanup_execution:'Explicitly delegated guarded removal stopped at inspection because targets were already absent; no deletion bypass or recreation.',
  runtime,helpers_stopped:true,live_business_writes:0,jobs_consumed:0,
  execution_evidence:{path:proofPath,sha256:hash(proofPath)},sources:Object.fromEntries([...new Set(paths)].map(path=>[path,hash(path)])),
  scope:'Read-only closeout verifies exact absence after a delegated cleanup attempt found targets already absent. No actor is attributed to the earlier removal. Accepted MySQL service/controller concurrency scope, no full UI/live-save/scanner or friendly duplicate HTTP-response acceptance. Production source unchanged; historical failures retained.'};
writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({acceptance:'passed',cases:19,cleanup_verified:true,running_services:runtime.length,evidence:output}));
