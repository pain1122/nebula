import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {admitScheduleDatabase,scheduleScope as scope} from '../media/schedule-acceptance-guard.mjs';

assert.ok(process.argv.length===2 || process.argv.length===3 && process.argv[2]==='--preflight','Only read-only --preflight is accepted; no target/replay overrides.');
const preflight=process.argv[2]==='--preflight';
const root=fileURLToPath(new URL('../../',import.meta.url));process.chdir(root);
const successPath='docs/deployment/evidence/article-mysql-2026-10-23.json';
assert.ok(preflight || !existsSync(successPath),'Accepted article MySQL evidence exists; never replay or overwrite.');
const go=args=>{const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:262144});assert.equal(r.status,0,'Bounded Docker inspection failed; raw environment suppressed.');return r.stdout;};
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const inherited=JSON.parse(readFileSync('docs/deployment/evidence/article-panel-2026-10-23.json','utf8'));
const sources={};for(const [p,h]of Object.entries({...inherited.implementation_sources,...inherited.retained_sources}))if(/^(app|config|database|routes|tests)\//.test(p)){assert.equal(sha(p),h,'Accepted backend changed: '+p);sources[p]=h;}
for(const p of ['scripts/content/probe-mysql.php','scripts/content/mysql-cases.json','scripts/content/verify-mysql.mjs','scripts/media/schedule-acceptance-guard.mjs','scripts/media/start-schedule-acceptance.ps1','docker-compose.schedule-acceptance.yml','composer.json','composer.lock'])sources[p]=sha(p);
const matrix=JSON.parse(readFileSync('scripts/content/mysql-cases.json','utf8'));
assert.equal(matrix.length,11);assert.equal(new Set(matrix.map(c=>c.name)).size,11);
const operations=['create','draft','term_update','term_retire','publish','archive','copy_version','revoke_role'];
for(const c of matrix){assert.match(c.name,/^[a-z_]+$/);assert.ok(operations.includes(c.leader)&&operations.includes(c.follower));assert.deepEqual(c.expected,c.audit_failure?['audit_rolled_back','committed']:c.leader==='revoke_role'?['authority_changed','forbidden']:['committed','conflict']);}
for(const image of [scope.phpImage,scope.mysqlImage])assert.equal(go(['image','inspect',image,'--format','{{.Id}}']).trim(),image);
const members=()=>go(['ps','-a','--filter','label=com.docker.compose.project='+scope.project,'--format','{{.Names}}']).trim().split(/\r?\n/).filter(Boolean);
if(preflight){console.log(JSON.stringify({acceptance:'preflight_passed',cases:matrix.length,backend_bindings:Object.keys(sources).length,disposable_project_absent:members().length===0,scope:'Read-only source/local-image/project checks; no startup, SQL, migration, test or live operation.'}));process.exit(0);}
const inspect=(kind,name)=>JSON.parse(go([kind,'inspect',name,'--format','{{json .}}']));
const password=admitScheduleDatabase(inspect('container',scope.container),inspect('network',scope.network),members());
const unrelated=()=>go(['ps','-a','--no-trunc','--format','{{json .}}']).trim().split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s)).filter(c=>c.Names!==scope.container).map(c=>({id:c.ID,name:c.Names,image:c.Image,state:c.State})).sort((a,b)=>a.name.localeCompare(b.name));
const before=unrelated(),temp='/tmp/checkupino-content-mysql';
const args=['run','--rm','--pull','never','--network',scope.network,'--read-only','--init','--user','33:33','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','512m','--memory-swap','512m','--cpus','1','--pids-limit','32','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777','--tmpfs','/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33','--mount',`type=bind,source=${root},target=/var/www,readonly`,'--workdir','/var/www'];
const env={CHECKUPINO_CONTENT_MYSQL:'true',ARTICLE_ADMIN_ENABLED:'true',APP_ENV:'testing',APP_DEBUG:'false',APP_KEY:'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',DB_CONNECTION:'mysql',DB_HOST:'mysql-acceptance',DB_PORT:'3306',DB_DATABASE:scope.database,DB_USERNAME:scope.user,DB_PASSWORD:password,DB_URL:'',DB_SOCKET:'',CACHE_STORE:'array',SESSION_DRIVER:'array',QUEUE_CONNECTION:'database',MAIL_MAILER:'array',LOG_CHANNEL:'null',BCRYPT_ROUNDS:'4',MEDICAL_SCAN_ENABLED:'false',MEDICAL_STORAGE_DRIVER:'local',MEDICAL_LOCAL_STORAGE_ROOT:temp+'/private',LARAVEL_STORAGE_PATH:temp,APP_CONFIG_CACHE:temp+'/config.php',APP_ROUTES_CACHE:temp+'/routes.php',VIEW_COMPILED_PATH:temp+'/framework/views'};
for(const [key,value]of Object.entries(env))args.push('--env',key+'='+value);
args.push(scope.phpImage,'php','scripts/content/probe-mysql.php','parent');
const run=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:210000,maxBuffer:262144});
const partial=[],failures=[];
for(const line of (run.stderr??'').split(/\r?\n/)){let value;try{value=JSON.parse(line);}catch{continue;}if(value.content_mysql_case)partial.push(value.content_mysql_case);if(value.content_mysql_failure)failures.push(value);}
try{
  assert.equal(run.status,0,'Isolated content process failed.');assert.ok(!run.stdout.includes(password));
  const result=JSON.parse(run.stdout);assert.equal(result.acceptance,'passed');assert.equal(result.database,scope.database);assert.equal(result.isolation,'REPEATABLE-READ');assert.deepEqual(result.cases.map(c=>c.name),matrix.map(c=>c.name));
  result.cases.forEach((c,i)=>{assert.deepEqual(c.outcomes,matrix[i].expected);assert.equal(c.contender_lock_observed,true);assert.equal(c.atomic_versions_audits_catalog_verified,true);});assert.equal(result.unrelated_tables_and_queue_preserved,true);
  assert.deepEqual(unrelated(),before);admitScheduleDatabase(inspect('container',scope.container),inspect('network',scope.network),members());for(const[p,h]of Object.entries(sources))assert.equal(sha(p),h);
  writeFileSync(successPath,JSON.stringify({...result,checked_at:new Date().toISOString(),image:scope.mysqlImage,php_image:scope.phpImage,internal_tmpfs_only:true,unrelated_runtime_preserved:true,sources,scope:'Exact disposable service interleavings only; no live article migration/save, helper activation or job consumption.'},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({acceptance:'passed',cases:matrix.length,evidence:successPath}));
}catch{
  const path='docs/deployment/evidence/article-mysql-failed-'+Date.now()+'-2026-10-23.json';writeFileSync(path,JSON.stringify({acceptance:'failed',checked_at:new Date().toISOString(),exit_code:run.status,partial_cases:partial,diagnostics:failures,sources,scope:'No automatic reset/replay; raw SQL/private payloads/environment suppressed.'},null,2)+'\n',{flag:'wx'});throw new Error('Content MySQL acceptance failed. Inspect '+path+'; do not replay a populated schema.');
}
