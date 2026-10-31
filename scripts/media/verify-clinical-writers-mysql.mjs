import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { admitScheduleDatabase, scheduleScope as s } from './schedule-acceptance-guard.mjs';

assert.ok(process.argv.length === 2 || process.argv.length === 3 && ['--preflight','--inspect'].includes(process.argv[2]), 'Only --preflight/--inspect are accepted; no target/account/command overrides.');
const preflight = process.argv[2] === '--preflight';
const inspection = process.argv[2] === '--inspect';
const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
const evidencePath = 'docs/deployment/evidence/clinical-writers-mysql-2026-10-22.json';
assert.ok(preflight || inspection || !existsSync(evidencePath), 'Accepted evidence exists; never replay or overwrite.');
const execute = (args, timeout = 15000) => {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 262144 });
  assert.equal(result.status, 0, 'Bounded Docker inspection failed; raw environment/SQL output suppressed.');
  return result.stdout;
};
const inspect = (kind, name) => JSON.parse(execute([kind, 'inspect', name, '--format', '{{json .}}']));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const plan = JSON.parse(readFileSync('scripts/media/clinical-writer-mysql-cases.json', 'utf8'));
assert.equal(plan.length, 19); assert.equal(new Set(plan.map(c => c.name)).size, 19);
const operations = ['doctor_create','patient_create','hospital_create','hospital_deactivate','attach','prices','weekly','book'];
const outcomes = ['committed','conflict','audit_rolled_back','duplicate_constraint_refused','hospital_unavailable','slot_unavailable'];
for (const item of plan) {
  assert.match(item.name,/^[a-z_]+$/);
  assert.ok(Object.keys(item).every(k=>['name','leader','follower','expected','different_admin','other_location','audit_failure'].includes(k)));
  assert.ok(operations.includes(item.leader) && operations.includes(item.follower));
  assert.equal(item.expected.length,2); assert.ok(item.expected.every(value=>outcomes.includes(value)));
  for (const key of ['different_admin','other_location','audit_failure']) if (key in item) assert.equal(typeof item[key],'boolean');
}
for (const image of [s.phpImage,s.mysqlImage]) assert.equal(execute(['image','inspect',image,'--format','{{.Id}}']).trim(),image);
const inherited={};
for(const path of ['docs/deployment/evidence/clinical-onboarding-acceptance-2026-10-18.json','docs/deployment/evidence/form-action-row-acceptance-2026-10-18.json']){
  const receipt=JSON.parse(readFileSync(path,'utf8'));assert.equal(receipt.acceptance,'passed');Object.assign(inherited,receipt.sources);
}
const productionPaths = ['app/Services/HospitalAdministration.php','app/Services/AdminIdentityService.php',
  'app/Services/DoctorLocationService.php','app/Services/DoctorPracticeService.php','app/Services/DoctorScheduleService.php',
  'app/Services/SchedulingService.php','app/Services/BookingService.php','app/Services/AuditLogger.php',
  'app/Http/Controllers/Api/Admin/ClinicalAccountController.php','app/Http/Controllers/Api/Admin/HospitalController.php',
  'routes/api.php','composer.json','composer.lock'];
const protectedSources = Object.fromEntries(productionPaths.map(path=>{
  if(inherited[path])assert.equal(sha(path),inherited[path],'Accepted production source changed: '+path);
  return [path,sha(path)];
}));
const harnessPaths=['docker-compose.schedule-acceptance.yml','scripts/media/start-schedule-acceptance.ps1',
  'scripts/media/schedule-acceptance-guard.mjs','scripts/media/schedule-acceptance-guard.test.mjs',
  'scripts/media/clinical-writer-mysql-cases.json','scripts/media/probe-clinical-writers-mysql.php','scripts/media/verify-clinical-writers-mysql.mjs'];
const harnessSources=Object.fromEntries(harnessPaths.map(path=>[path,sha(path)]));
if(preflight){
  console.log(JSON.stringify({acceptance:'preflight_passed',cases:plan.length,project:s.project,internal_tmpfs_only:true,production_source_unchanged:true,
    scope:'Read-only source/matrix/local-image checks only. No database connection, container startup, schema operation, business save or job consumption. MySQL execution remains unaccepted.'}));
  process.exit(0);
}
const members=()=>execute(['ps','-a','--filter','label=com.docker.compose.project='+s.project,'--format','{{.Names}}']).trim().split(/\r?\n/);
const db=inspect('container',s.container),net=inspect('network',s.network);
const password=admitScheduleDatabase(db,net,members());
const untouchedContainers=()=>execute(['ps','-a','--no-trunc','--format','{{json .}}']).trim().split(/\r?\n/).map(line=>JSON.parse(line))
  .filter(item=>item.Names!==s.container).map(item=>({id:item.ID,name:item.Names,image:item.Image,state:item.State})).sort((a,b)=>a.name.localeCompare(b.name));
const before=untouchedContainers();
const args=['run','--rm','--pull','never','--network',s.network,'--read-only','--init','--user','33:33','--cap-drop','ALL','--security-opt','no-new-privileges:true',
  '--memory','512m','--memory-swap','512m','--cpus','1','--pids-limit','32','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
  '--tmpfs','/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
  '--mount',`type=bind,source=${root},target=/var/www,readonly`,'--workdir','/var/www'];
const temp='/tmp/checkupino-clinical-writers';
const config={CHECKUPINO_CLINICAL_MYSQL_REHEARSAL:'true',APP_ENV:'testing',APP_DEBUG:'false',APP_KEY:'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
  DB_CONNECTION:'mysql',DB_HOST:'mysql-acceptance',DB_PORT:'3306',DB_DATABASE:s.database,DB_USERNAME:s.user,DB_PASSWORD:password,DB_URL:'',DB_SOCKET:'',
  CACHE_STORE:'array',SESSION_DRIVER:'array',QUEUE_CONNECTION:'database',MAIL_MAILER:'array',LOG_CHANNEL:'null',BCRYPT_ROUNDS:'4',
  MEDICAL_SCAN_ENABLED:'false',MEDICAL_STORAGE_DRIVER:'local',MEDICAL_LOCAL_STORAGE_ROOT:temp+'/private',LARAVEL_STORAGE_PATH:temp,
  APP_CONFIG_CACHE:temp+'/config.php',VIEW_COMPILED_PATH:temp+'/framework/views'};
for(const [key,value] of Object.entries(config))args.push('--env',key+'='+value);
args.push(s.phpImage,'php','scripts/media/probe-clinical-writers-mysql.php',inspection?'inspect':'parent');
const probe=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:270000,maxBuffer:262144});
// Only structured, allowlisted diagnostics leave the private test container.
const partial=[],diagnostics=[],observed=[];
for(const line of (probe.stderr??'').split(/\r?\n/)){
  let value;try{value=JSON.parse(line);}catch{continue;}
  if(value.clinical_writer_case_result && plan.some(c=>c.name===value.clinical_writer_case_result.name))partial.push(value.clinical_writer_case_result);
  if(value.clinical_writer_pair_observed && plan.some(c=>c.name===value.clinical_writer_pair_observed.name))observed.push(value.clinical_writer_pair_observed);
  if(value.clinical_writer_failure===true && /^[a-z_-]+$/.test(value.stage??'') && /^[A-Za-z\\]+$/.test(value.class??''))diagnostics.push({
    stage:value.stage,class:value.class,line:Number.isInteger(value.line)?value.line:null,
    file:typeof value.file==='string' && /^(app|vendor|scripts)\/[A-Za-z0-9_./-]+$/.test(value.file)?value.file:null,
    mysql_code:[1062,1213,1205].includes(Number(value.mysql_code))?Number(value.mysql_code):null,
    assertion:value.class==='ClinicalWriterAssertion' && typeof value.assertion==='string'?value.assertion.slice(0,240):null});
}
if(probe.status!==0){
  const path='docs/deployment/evidence/clinical-writers-mysql-failed-'+Date.now()+'-2026-10-22.json';
  writeFileSync(path,JSON.stringify({acceptance:'failed',checked_at:new Date().toISOString(),exit_code:probe.status,diagnostics,partial_cases:partial,observed_pairs:observed,
    sources:harnessSources,protected_sources:protectedSources,scope:'No acceptance claim. Database preserved for diagnosis; no automatic reset/retry/cleanup or raw credentials/SQL.'},null,2)+'\n',{flag:'wx'});
  throw new Error('Isolated clinical writer check failed; inspect '+path+'. Do not replay a populated database.');
}
assert.ok(!probe.stdout.includes(password),'Credential output refused.');
const result=JSON.parse(probe.stdout);
if(inspection){
  assert.equal(result.acceptance,'read_only_inspection_passed');assert.equal(result.business_writes,0);
  assert.equal(result.cached_user_queries,0);assert.equal(result.persisted_hospital_revision_stable,true);assert.equal(result.attribute_order_changes_revision,true);
  assert.deepEqual(untouchedContainers(),before);
  console.log(JSON.stringify(result));process.exit(0);
}
assert.equal(result.acceptance,'passed');assert.equal(result.database,s.database);assert.equal(result.isolation,'REPEATABLE-READ');
assert.equal(result.cases.length,plan.length);assert.deepEqual(result.cases.map(c=>c.name),plan.map(c=>c.name));
for(let i=0;i<plan.length;i++){
  const actual=result.cases[i];assert.equal(actual.atomic_state_audit_and_booked_money_verified,true);
  assert.deepEqual([actual.results.leader.outcome,actual.results.follower.outcome],plan[i].expected);
}
assert.equal(result.default_queue_sentinel_unchanged,true);assert.equal(result.medical_jobs,0);
assert.deepEqual(untouchedContainers(),before,'An unrelated container changed.');
admitScheduleDatabase(inspect('container',s.container),inspect('network',s.network),members());
for(const [path,hash]of Object.entries({...protectedSources,...harnessSources}))assert.equal(sha(path),hash);
writeFileSync(evidencePath,JSON.stringify({...result,checked_at:new Date().toISOString(),container:s.container,image:s.mysqlImage,php_image:s.phpImage,
  internal_tmpfs_only:true,unrelated_containers_unchanged:true,production_source_unchanged:true,protected_sources:protectedSources,sources:harnessSources},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({acceptance:'passed',cases:result.cases.length,database:s.database,live_business_writes:0,jobs_consumed:0,evidence:evidencePath}));
