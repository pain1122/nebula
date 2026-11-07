import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { admitScheduleDatabase, scheduleScope as scope } from '../media/schedule-acceptance-guard.mjs';
import { recommendationRoot as root, sourceHash } from './source-bindings.mjs';
import { acceptedCrossSources, crossMatrix } from './cross-source-bindings.mjs';

assert.ok(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--preflight', 'Only --preflight is accepted; no target, account, command or replay overrides.');
process.chdir(root);
const preflight = process.argv[2] === '--preflight';
const successPath = 'docs/deployment/evidence/recommendation-mysql-cross-module-2026-11-08.json';
assert.ok(preflight || !existsSync(successPath), 'Accepted MySQL evidence exists; never replay or overwrite.');
const { sources: implementation, binding } = acceptedCrossSources();
const catalogPath = 'docs/deployment/evidence/recommendation-mysql-catalog-2026-11-07.json';
const cleanupPath = 'docs/deployment/evidence/recommendation-mysql-catalog-cleanup-2026-11-08.json';
const catalog = JSON.parse(readFileSync(catalogPath,'utf8'));
const cleanup = JSON.parse(readFileSync(cleanupPath,'utf8'));
assert.equal(catalog.acceptance,'passed'); assert.equal(catalog.cases.length,8);
assert.equal(cleanup.acceptance,'catalog_acceptance_cleanup_verified');
assert.equal(cleanup.project,scope.project); assert.equal(cleanup.container_absent,true); assert.equal(cleanup.network_absent,true);
for (const [file,expected] of Object.entries(catalog.sources)) assert.equal(sourceHash(file),expected,'Accepted first catalog writer/source changed; do not replay or silently replace it.');
const matrix = crossMatrix();
const names = matrix.map(item => item.name);
const sources = { ...implementation };
sources[catalogPath] = sourceHash(catalogPath); sources[cleanupPath] = sourceHash(cleanupPath);
for (const file of ['scripts/recommendations/verify-cross-module-mysql.mjs', 'scripts/recommendations/probe-cross-module-mysql.php', 'scripts/recommendations/cross-module-cases.json',
  'scripts/media/schedule-acceptance-guard.mjs', 'scripts/media/start-schedule-acceptance.ps1', 'docker-compose.schedule-acceptance.yml']) sources[file] = sourceHash(file);
const execute = args => {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 262144 });
  assert.equal(result.status, 0, 'Bounded Docker inspection failed; raw environment output suppressed.');
  return result.stdout;
};
for (const image of [scope.phpImage, scope.mysqlImage]) assert.equal(execute(['image','inspect',image,'--format','{{.Id}}']).trim(), image);
const members = () => execute(['ps','-a','--filter','label=com.docker.compose.project=' + scope.project,'--format','{{.Names}}']).trim().split(/\r?\n/).filter(Boolean);
if (preflight) {
  const containerNames = execute(['ps','-a','--format','{{.Names}}']).trim().split(/\r?\n/).filter(Boolean);
  const networkNames = execute(['network','ls','--format','{{.Name}}']).trim().split(/\r?\n/).filter(Boolean);
  console.log(JSON.stringify({ acceptance: 'preflight_passed', cases: matrix.length, source_binding: binding,
    disposable_project_absent: members().length === 0 && !containerNames.includes(scope.container) && !networkNames.includes(scope.network), scope: 'Read-only source/matrix/local-image/project inspection; no SQL, startup, schema, fixture, live operation or MySQL acceptance.' }));
  process.exit(0);
}
const inspect = (kind, name) => JSON.parse(execute([kind,'inspect',name,'--format','{{json .}}']));
const password = admitScheduleDatabase(inspect('container', scope.container), inspect('network', scope.network), members());
const unrelated = () => execute(['ps','-a','--no-trunc','--format','{{json .}}']).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
  .filter(item => item.Names !== scope.container).map(item => ({ id: item.ID, name: item.Names, image: item.Image, state: item.State })).sort((a,b) => a.name.localeCompare(b.name));
const before = unrelated(), temp = '/tmp/checkupino-recommendation-cross-mysql';
const args = ['run','--rm','--pull','never','--network',scope.network,'--read-only','--init','--user','33:33','--cap-drop','ALL',
  '--security-opt','no-new-privileges:true','--memory','512m','--memory-swap','512m','--cpus','1','--pids-limit','32',
  '--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
  '--tmpfs','/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
  '--tmpfs','/var/www/storage/app/article-media:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
  '--mount',`type=bind,source=${root},target=/var/www,readonly`,'--workdir','/var/www'];
const environment = { CHECKUPINO_RECOMMENDATION_CROSS_MYSQL:'true', APP_ENV:'testing', APP_DEBUG:'false',
  APP_KEY:'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=', DB_CONNECTION:'mysql', DB_HOST:'mysql-acceptance', DB_PORT:'3306',
  DB_DATABASE:scope.database, DB_USERNAME:scope.user, DB_PASSWORD:password, DB_URL:'', DB_SOCKET:'',
  CACHE_STORE:'array', SESSION_DRIVER:'database', SESSION_CONNECTION:'null', QUEUE_CONNECTION:'database', MAIL_MAILER:'array', LOG_CHANNEL:'null', BCRYPT_ROUNDS:'4',
  MEDICAL_SCAN_ENABLED:'false', MEDICAL_STORAGE_DRIVER:'local', MEDICAL_LOCAL_STORAGE_ROOT:temp + '/private',
  LARAVEL_STORAGE_PATH:temp, APP_CONFIG_CACHE:temp + '/config.php', APP_ROUTES_CACHE:temp + '/routes.php', VIEW_COMPILED_PATH:temp + '/framework/views' };
for (const [key, value] of Object.entries(environment)) args.push('--env', key + '=' + value);
args.push(scope.phpImage, 'php', 'scripts/recommendations/probe-cross-module-mysql.php', 'parent');
const run = spawnSync('docker', args, { encoding:'utf8', windowsHide:true, timeout:330000, maxBuffer:262144 });
const partial = [], observed = [], diagnostics = [], protocols = {};
const outcomeNames = new Set(['committed','conflict','forbidden','matched','unavailable','no_matches','insufficient_information','audit_rolled_back']);
for (const line of (run.stderr ?? '').split(/\r?\n/)) {
  let value; try { value = JSON.parse(line); } catch { continue; }
  if (value.recommendation_cross_case && names.includes(value.recommendation_cross_case.name)) partial.push(value.recommendation_cross_case);
  if (value.recommendation_cross_pair_observed && names.includes(value.recommendation_cross_pair_observed.name)) {
    const pair = value.recommendation_cross_pair_observed;
    observed.push({name:pair.name,results:Object.fromEntries(['leader','follower'].map(side => [side,{
      outcome:outcomeNames.has(pair.results?.[side]?.outcome) ? pair.results[side].outcome : 'unexpected',
      health_reads:[0,1].includes(pair.results?.[side]?.health_reads) ? pair.results[side].health_reads : null,
      barrier:pair.results?.[side]?.barrier === true,
    }]))});
  }
  for (const [key, fields] of Object.entries({integrity:['foreign_key_refusals','cross_rule_withdrawal_refused','canonical_json_verified','populated_rollback_refused'],
    temporal:['grant_expiry_refused','review_expiry_no_health_read','health_variant_states_verified'],
    replacement:['old_review_withdrawal_preserves_current','current_review_withdrawal_no_fallback','original_reviews_immutable']})) {
    const data = value['recommendation_cross_' + key];
    if (data) protocols[key] = Object.fromEntries(fields.map(field => [field, typeof data[field] === 'boolean' || field === 'foreign_key_refusals' && data[field] === 5 ? data[field] : null]));
  }
  if (value.recommendation_mysql_failure === true && /^[a-z_-]+$/.test(value.stage ?? '') && /^[A-Za-z\\]+$/.test(value.class ?? '')) diagnostics.push({
    stage:value.stage, class:value.class, line:Number.isInteger(value.line) ? value.line : null,
    mysql_code:[1062,1205,1213,1452].includes(Number(value.mysql_code)) ? Number(value.mysql_code) : null,
    http_status:[401,403,404,409,422,423,503].includes(value.http_status) ? value.http_status : null,
    application_frame:typeof value.application_frame?.file === 'string' && /^app\/[A-Za-z0-9_./-]+$/.test(value.application_frame.file) && Number.isInteger(value.application_frame.line) ? {file:value.application_frame.file,line:value.application_frame.line} : null,
    assertion:['RecommendationMysqlAssertion','Checkupino\\Acceptance\\Recommendations\\CrossIntegrityAssertion'].includes(value.class) && typeof value.assertion === 'string' ? value.assertion.slice(0,200) : null,
  });
}
try {
  assert.equal(run.status, 0, 'Isolated recommendation process failed.');
  assert.ok(!run.stdout.includes(password));
  const result = JSON.parse(run.stdout);
  assert.equal(result.acceptance, 'passed'); assert.equal(result.database, scope.database); assert.equal(result.isolation, 'REPEATABLE-READ');
  assert.deepEqual(result.cases.map(item => item.name), names);
  result.cases.forEach((item,index) => { assert.deepEqual(item.outcomes,matrix[index].expected); assert.equal(item.contender_lock_observed,true); assert.equal(item.exact_atomic_deltas_verified,true); assert.equal(item.immutable_history_preserved,true); assert.equal(item.private_read_boundaries_verified,true); assert.equal(item.post_state,matrix[index].post_state); });
  assert.equal(result.integrity.foreign_key_refusals,5); assert.equal(result.integrity.cross_rule_withdrawal_refused,true); assert.equal(result.integrity.canonical_json_verified,true); assert.equal(result.integrity.populated_rollback_refused,true);
  assert.deepEqual(result.temporal,{grant_expiry_refused:true,review_expiry_no_health_read:true,health_variant_states_verified:true});
  assert.deepEqual(result.replacement,{old_review_withdrawal_preserves_current:true,current_review_withdrawal_no_fallback:true,original_reviews_immutable:true}); assert.equal(result.unrelated_tables_and_queue_preserved,true);
  assert.deepEqual(unrelated(),before);
  admitScheduleDatabase(inspect('container',scope.container), inspect('network',scope.network), members());
  for (const [file, expected] of Object.entries(sources)) assert.equal(sourceHash(file),expected,'Source changed during isolated acceptance.');
  writeFileSync(successPath,JSON.stringify({ ...result, checked_at:new Date().toISOString(), source_binding:binding, sources,
    image:scope.mysqlImage, php_image:scope.phpImage, internal_tmpfs_only:true, unrelated_runtime_preserved:true },null,2) + '\n',{flag:'wx'});
  console.log(JSON.stringify({acceptance:'passed',cases:matrix.length,evidence:successPath}));
} catch {
  const failurePath = 'docs/deployment/evidence/recommendation-mysql-cross-module-failed-' + Date.now() + '.json';
  writeFileSync(failurePath,JSON.stringify({acceptance:'failed',checked_at:new Date().toISOString(),exit_code:run.status,
    partial_cases:partial,observed_pairs:observed,protocols,diagnostics,sources,scope:'No acceptance claim or automatic reset/replay/cleanup. Raw environment, SQL and private values are suppressed.'},null,2) + '\n',{flag:'wx'});
  throw new Error('MySQL cross-module acceptance failed. Preserve the populated fixture; inspect ' + failurePath);
}
