import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { admitScheduleDatabase, scheduleScope as scope } from '../media/schedule-acceptance-guard.mjs';
import { acceptedRecommendationSources, recommendationRoot as root, sourceHash } from './source-bindings.mjs';

assert.ok(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--preflight', 'Only --preflight is accepted; no target, account, command or replay overrides.');
process.chdir(root);
const preflight = process.argv[2] === '--preflight';
const successPath = 'docs/deployment/evidence/recommendation-mysql-catalog-2026-11-07.json';
assert.ok(preflight || !existsSync(successPath), 'Accepted MySQL evidence exists; never replay or overwrite.');
const { sources: implementation, binding } = acceptedRecommendationSources();
const matrix = JSON.parse(readFileSync('scripts/recommendations/mysql-cases.json', 'utf8'));
const names = ['concurrent_draft_versions', 'exact_duplicate_delivery', 'approval_before_edit', 'edit_before_approval',
  'grant_revoke_before_publish', 'review_withdraw_before_publish', 'retire_before_publish', 'late_audit_rollback'];
assert.deepEqual(matrix.map(item => item.name), names);
const pairs = [['draft','draft'], ['draft','draft'], ['approve','draft'], ['draft','approve'], ['revoke','publish'], ['withdraw','publish'], ['retire','publish'], ['draft','draft']];
for (const [index, item] of matrix.entries()) {
  assert.deepEqual([item.leader, item.follower], pairs[index]);
  assert.equal(item.mode, index < 2 || index === 7 ? 'draft' : index < 4 ? 'assigned' : 'reviewed');
  assert.deepEqual(item.expected, index === 1 ? ['committed','committed'] : index === 3 ? ['committed','forbidden'] : index === 7 ? ['audit_rolled_back','committed'] : ['committed','conflict']);
  assert.equal(item.duplicate ?? false, index === 1);
  assert.equal(item.audit_failure ?? false, index === 7);
  assert.equal(item.versions, [0,1,3,7].includes(index) ? 1 : 0);
  assert.equal(item.reviews, [2,5].includes(index) ? 1 : 0);
}
const sources = { ...implementation };
for (const file of ['scripts/recommendations/verify-mysql.mjs', 'scripts/recommendations/probe-mysql.php', 'scripts/recommendations/mysql-cases.json',
  'scripts/media/schedule-acceptance-guard.mjs', 'scripts/media/start-schedule-acceptance.ps1', 'docker-compose.schedule-acceptance.yml']) sources[file] = sourceHash(file);
const execute = args => {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 262144 });
  assert.equal(result.status, 0, 'Bounded Docker inspection failed; raw environment output suppressed.');
  return result.stdout;
};
for (const image of [scope.phpImage, scope.mysqlImage]) assert.equal(execute(['image','inspect',image,'--format','{{.Id}}']).trim(), image);
const members = () => execute(['ps','-a','--filter','label=com.docker.compose.project=' + scope.project,'--format','{{.Names}}']).trim().split(/\r?\n/).filter(Boolean);
if (preflight) {
  console.log(JSON.stringify({ acceptance: 'preflight_passed', cases: matrix.length, source_binding: binding,
    disposable_project_absent: members().length === 0, scope: 'Read-only source/matrix/local-image/project inspection; no SQL, startup, schema, fixture, live operation or MySQL acceptance.' }));
  process.exit(0);
}
const inspect = (kind, name) => JSON.parse(execute([kind,'inspect',name,'--format','{{json .}}']));
const password = admitScheduleDatabase(inspect('container', scope.container), inspect('network', scope.network), members());
const unrelated = () => execute(['ps','-a','--no-trunc','--format','{{json .}}']).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
  .filter(item => item.Names !== scope.container).map(item => ({ id: item.ID, name: item.Names, image: item.Image, state: item.State })).sort((a,b) => a.name.localeCompare(b.name));
const before = unrelated(), temp = '/tmp/checkupino-recommendation-mysql';
const args = ['run','--rm','--pull','never','--network',scope.network,'--read-only','--init','--user','33:33','--cap-drop','ALL',
  '--security-opt','no-new-privileges:true','--memory','512m','--memory-swap','512m','--cpus','1','--pids-limit','32',
  '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
  '--tmpfs','/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
  '--tmpfs','/var/www/storage/app/article-media:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
  '--mount',`type=bind,source=${root},target=/var/www,readonly`,'--workdir','/var/www'];
const environment = { CHECKUPINO_RECOMMENDATION_MYSQL:'true', APP_ENV:'testing', APP_DEBUG:'false',
  APP_KEY:'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=', DB_CONNECTION:'mysql', DB_HOST:'mysql-acceptance', DB_PORT:'3306',
  DB_DATABASE:scope.database, DB_USERNAME:scope.user, DB_PASSWORD:password, DB_URL:'', DB_SOCKET:'',
  CACHE_STORE:'array', SESSION_DRIVER:'array', QUEUE_CONNECTION:'database', MAIL_MAILER:'array', LOG_CHANNEL:'null', BCRYPT_ROUNDS:'4',
  MEDICAL_SCAN_ENABLED:'false', MEDICAL_STORAGE_DRIVER:'local', MEDICAL_LOCAL_STORAGE_ROOT:temp + '/private',
  LARAVEL_STORAGE_PATH:temp, APP_CONFIG_CACHE:temp + '/config.php', APP_ROUTES_CACHE:temp + '/routes.php', VIEW_COMPILED_PATH:temp + '/framework/views' };
for (const [key, value] of Object.entries(environment)) args.push('--env', key + '=' + value);
args.push(scope.phpImage, 'php', 'scripts/recommendations/probe-mysql.php', 'parent');
const run = spawnSync('docker', args, { encoding:'utf8', windowsHide:true, timeout:210000, maxBuffer:262144 });
const partial = [], observed = [], diagnostics = [];
for (const line of (run.stderr ?? '').split(/\r?\n/)) {
  let value; try { value = JSON.parse(line); } catch { continue; }
  if (value.recommendation_mysql_case && names.includes(value.recommendation_mysql_case.name)) partial.push(value.recommendation_mysql_case);
  if (value.recommendation_mysql_pair_observed && names.includes(value.recommendation_mysql_pair_observed.name)) observed.push(value.recommendation_mysql_pair_observed);
  if (value.recommendation_mysql_failure === true && /^[a-z_-]+$/.test(value.stage ?? '') && /^[A-Za-z\\]+$/.test(value.class ?? '')) diagnostics.push({
    stage:value.stage, class:value.class, line:Number.isInteger(value.line) ? value.line : null,
    mysql_code:[1062,1205,1213].includes(Number(value.mysql_code)) ? Number(value.mysql_code) : null,
    http_status:[401,403,404,409,422,423,503].includes(value.http_status) ? value.http_status : null,
    application_frame:typeof value.application_frame?.file === 'string' && /^app\/[A-Za-z0-9_./-]+$/.test(value.application_frame.file) && Number.isInteger(value.application_frame.line) ? value.application_frame : null,
    assertion:value.class === 'RecommendationMysqlAssertion' && typeof value.assertion === 'string' ? value.assertion.slice(0,200) : null,
  });
}
try {
  assert.equal(run.status, 0, 'Isolated recommendation process failed.');
  assert.ok(!run.stdout.includes(password));
  const result = JSON.parse(run.stdout);
  assert.equal(result.acceptance, 'passed'); assert.equal(result.database, scope.database); assert.equal(result.isolation, 'REPEATABLE-READ');
  assert.deepEqual(result.cases.map(item => item.name), names);
  result.cases.forEach((item,index) => { assert.deepEqual(item.outcomes,matrix[index].expected); assert.equal(item.contender_lock_observed,true); assert.equal(item.atomic_versions_audits_catalog_verified,true); });
  assert.equal(result.empty_rollback_verified,true); assert.equal(result.unrelated_tables_and_queue_preserved,true);
  assert.deepEqual(unrelated(),before);
  admitScheduleDatabase(inspect('container',scope.container), inspect('network',scope.network), members());
  for (const [file, expected] of Object.entries(sources)) assert.equal(sourceHash(file),expected,'Source changed during isolated acceptance.');
  writeFileSync(successPath,JSON.stringify({ ...result, checked_at:new Date().toISOString(), source_binding:binding, sources,
    image:scope.mysqlImage, php_image:scope.phpImage, internal_tmpfs_only:true, unrelated_runtime_preserved:true },null,2) + '\n',{flag:'wx'});
  console.log(JSON.stringify({acceptance:'passed',cases:matrix.length,evidence:successPath}));
} catch {
  const failurePath = 'docs/deployment/evidence/recommendation-mysql-catalog-failed-' + Date.now() + '.json';
  writeFileSync(failurePath,JSON.stringify({acceptance:'failed',checked_at:new Date().toISOString(),exit_code:run.status,
    partial_cases:partial,observed_pairs:observed,diagnostics,sources,scope:'No acceptance claim or automatic reset/replay/cleanup. Raw environment, SQL and private values are suppressed.'},null,2) + '\n',{flag:'wx'});
  throw new Error('MySQL catalog acceptance failed. Preserve the populated fixture; inspect ' + failurePath);
}
