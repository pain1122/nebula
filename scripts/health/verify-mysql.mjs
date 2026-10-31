import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { admitScheduleDatabase, scheduleScope as scope } from '../media/schedule-acceptance-guard.mjs';

assert.ok(process.argv.length === 2 || process.argv.length === 3 && ['--preflight', '--inspect-lock'].includes(process.argv[2]),
  'Only --preflight/--inspect-lock are accepted; no target, account, command or replay overrides.');
const preflight = process.argv[2] === '--preflight';
const diagnostic = process.argv[2] === '--inspect-lock';
const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
const successPath = 'docs/deployment/evidence/patient-health-mysql-2026-10-22.json';
assert.ok(preflight || diagnostic || !existsSync(successPath), 'Accepted health MySQL evidence exists; do not replay or overwrite.');
const execute = args => {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 262144 });
  assert.equal(result.status, 0, 'Bounded Docker inspection failed; raw environment output suppressed.');
  return result.stdout;
};
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const receipt = JSON.parse(readFileSync('docs/deployment/evidence/patient-health-source-2026-10-22.json', 'utf8'));
assert.equal(receipt.acceptance, 'source_gate_passed_activation_not_accepted');
const implementation = Object.fromEntries(Object.entries(receipt.sources).filter(([path]) => /^(app|config|database|tests|routes|frontend|scripts)\//.test(path)));
assert.equal(Object.keys(implementation).length, 20);
for (const [path, expected] of Object.entries(implementation)) assert.equal(hash(path), expected, 'Accepted health implementation changed: ' + path);
const matrix = JSON.parse(readFileSync('scripts/health/mysql-cases.json', 'utf8'));
const expectedNames = ['first_saves', 'later_fact_saves', 'measurement_before_fact', 'fact_before_measurement',
  'duplicate_measurement_delivery', 'late_audit_rollback', 'deactivation_before_save', 'role_revocation_before_save'];
assert.deepEqual(matrix.map(item => item.name), expectedNames);
const operations = ['first', 'fact', 'other_fact', 'measurement', 'deactivate', 'revoke_role'];
const pairs = [['first', 'fact'], ['fact', 'other_fact'], ['measurement', 'fact'], ['fact', 'measurement'],
  ['measurement', 'measurement'], ['measurement', 'other_fact'], ['deactivate', 'measurement'], ['revoke_role', 'fact']];
for (const [index, item] of matrix.entries()) {
  assert.ok(Object.keys(item).every(key => ['name', 'leader', 'follower', 'initialized', 'audit_failure', 'expected'].includes(key)));
  assert.ok(operations.includes(item.leader) && operations.includes(item.follower));
  assert.deepEqual([item.leader, item.follower], pairs[index]);
  assert.equal(typeof item.initialized, 'boolean');
  assert.equal(item.initialized, item.name !== 'first_saves');
  assert.equal(item.audit_failure ?? false, item.name === 'late_audit_rollback');
  const expected = item.name === 'late_audit_rollback' ? ['audit_rolled_back', 'committed']
    : item.name.endsWith('_before_save') ? ['authority_changed', 'forbidden'] : ['committed', 'conflict'];
  assert.deepEqual(item.expected, expected);
}
const harness = ['scripts/health/verify-mysql.mjs', 'scripts/health/probe-mysql.php', 'scripts/health/mysql-cases.json',
  'scripts/media/schedule-acceptance-guard.mjs', 'scripts/media/schedule-acceptance-guard.test.mjs',
  'scripts/media/start-schedule-acceptance.ps1', 'docker-compose.schedule-acceptance.yml', 'composer.json', 'composer.lock'];
const sources = { ...implementation, ...Object.fromEntries(harness.map(path => [path, hash(path)])) };
for (const image of [scope.phpImage, scope.mysqlImage]) assert.equal(execute(['image', 'inspect', image, '--format', '{{.Id}}']).trim(), image);
const members = () => execute(['ps', '-a', '--filter', 'label=com.docker.compose.project=' + scope.project, '--format', '{{.Names}}']).trim().split(/\r?\n/).filter(Boolean);
if (preflight) {
  const projectMembers = members();
  const names = execute(['ps', '-a', '--format', '{{.Names}}']).trim().split(/\r?\n/);
  const networks = execute(['network', 'ls', '--format', '{{.Name}}']).trim().split(/\r?\n/);
  // Existing project is reported, never admitted/reused/reset by preflight.
  const absent = projectMembers.length === 0 && !names.includes(scope.container) && !networks.includes(scope.network);
  console.log(JSON.stringify({ acceptance: 'preflight_passed', cases: matrix.length, project: scope.project,
    disposable_project_absent: absent, implementation_bindings_verified: Object.keys(implementation).length,
    scope: 'Read-only source/matrix/local-image/inventory checks. No SQL, startup, schema, job or business operation. MySQL acceptance remains open.' }));
  process.exit(0);
}
const inspect = (kind, name) => JSON.parse(execute([kind, 'inspect', name, '--format', '{{json .}}']));
const password = admitScheduleDatabase(inspect('container', scope.container), inspect('network', scope.network), members());
const unrelatedContainers = () => execute(['ps', '-a', '--no-trunc', '--format', '{{json .}}']).trim().split(/\r?\n/).filter(Boolean)
  .map(line => JSON.parse(line)).filter(item => item.Names !== scope.container)
  .map(item => ({ id: item.ID, name: item.Names, image: item.Image, state: item.State })).sort((a, b) => a.name.localeCompare(b.name));
const before = unrelatedContainers();
const temp = '/tmp/checkupino-health-mysql';
const args = ['run', '--rm', '--pull', 'never', '--network', scope.network, '--read-only', '--init', '--user', '33:33',
  '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--memory', '512m', '--memory-swap', '512m', '--cpus', '1', '--pids-limit', '32',
  '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
  '--tmpfs', '/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
  '--mount', `type=bind,source=${root},target=/var/www,readonly`, '--workdir', '/var/www'];
const environment = {
  CHECKUPINO_HEALTH_MYSQL: 'true', APP_ENV: 'testing', APP_DEBUG: 'false',
  APP_KEY: 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=', DB_CONNECTION: 'mysql', DB_HOST: 'mysql-acceptance',
  DB_PORT: '3306', DB_DATABASE: scope.database, DB_USERNAME: scope.user, DB_PASSWORD: password, DB_URL: '', DB_SOCKET: '',
  CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'database', MAIL_MAILER: 'array', LOG_CHANNEL: 'null', BCRYPT_ROUNDS: '4',
  MEDICAL_SCAN_ENABLED: 'false', MEDICAL_STORAGE_DRIVER: 'local', MEDICAL_LOCAL_STORAGE_ROOT: temp + '/private',
  LARAVEL_STORAGE_PATH: temp, APP_CONFIG_CACHE: temp + '/config.php', APP_ROUTES_CACHE: temp + '/routes.php', VIEW_COMPILED_PATH: temp + '/framework/views',
};
for (const [key, value] of Object.entries(environment)) args.push('--env', key + '=' + value);
args.push(scope.phpImage, 'php', 'scripts/health/probe-mysql.php', diagnostic ? 'inspect-lock' : 'parent');
const probe = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 210000, maxBuffer: 262144 });
const partial = [], diagnostics = [], observed = [];
for (const line of (probe.stderr ?? '').split(/\r?\n/)) {
  let value; try { value = JSON.parse(line); } catch { continue; }
  if (value.health_mysql_case && expectedNames.includes(value.health_mysql_case.name)) partial.push(value.health_mysql_case);
  if (value.health_mysql_pair_observed && expectedNames.includes(value.health_mysql_pair_observed.name)) observed.push(value.health_mysql_pair_observed);
  if (value.health_mysql_failure === true && /^[a-z_-]+$/.test(value.stage ?? '') && /^[A-Za-z\\]+$/.test(value.class ?? '')) diagnostics.push({
    stage: value.stage, class: value.class, line: Number.isInteger(value.line) ? value.line : null,
    file: typeof value.file === 'string' && /^(app|scripts|vendor)\/[A-Za-z0-9_./-]+$/.test(value.file) ? value.file : null,
    mysql_code: [1062, 1205, 1213].includes(Number(value.mysql_code)) ? Number(value.mysql_code) : null,
    assertion: value.class === 'HealthMysqlAssertion' && typeof value.assertion === 'string' ? value.assertion.slice(0, 200) : null,
  });
}
try {
  assert.equal(probe.status, 0, 'Isolated health process failed.');
  assert.ok(!probe.stdout.includes(password), 'Credential output refused.');
  const result = JSON.parse(probe.stdout);
  if (diagnostic) {
    assert.equal(result.acceptance, 'read_only_lock_diagnostic_passed'); assert.equal(result.business_writes, 0); assert.equal(result.rows_unchanged, true);
    assert.equal(result.observation.locking_user_query_observed, true);
    if (result.audit_shape) for (const field of ['safe_key_set_matches', 'actor_matches', 'reason_is_null', 'typed_metadata_matches']) assert.equal(result.audit_shape[field], true);
    assert.deepEqual(unrelatedContainers(), before);
    const path = 'docs/deployment/evidence/patient-health-lock-diagnostic-' + Date.now() + '-2026-10-22.json';
    writeFileSync(path, JSON.stringify({ ...result, checked_at: new Date().toISOString(), sources }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ ...result, evidence: path })); process.exit(0);
  }
  assert.equal(result.acceptance, 'passed'); assert.equal(result.database, scope.database); assert.equal(result.isolation, 'REPEATABLE-READ');
  assert.deepEqual(result.cases.map(item => item.name), expectedNames);
  for (let index = 0; index < matrix.length; index++) {
    const actual = result.cases[index];
    assert.deepEqual([actual.results.leader.outcome, actual.results.follower.outcome], matrix[index].expected);
    assert.equal(actual.contender_lock_observed, true); assert.equal(actual.exact_atomic_history_audit_verified, true);
  }
  assert.equal(result.snapshots, 13); assert.equal(result.observations, 10); assert.equal(result.audits, 13);
  assert.equal(result.default_queue_sentinel_unchanged, true); assert.equal(result.unrelated_lifecycle_tables_unchanged, true); assert.equal(result.medical_jobs, 0);
  assert.deepEqual(unrelatedContainers(), before, 'Unrelated runtime state changed.');
  admitScheduleDatabase(inspect('container', scope.container), inspect('network', scope.network), members());
  for (const [path, expected] of Object.entries(sources)) assert.equal(hash(path), expected, 'Source changed during acceptance: ' + path);
  writeFileSync(successPath, JSON.stringify({ ...result, checked_at: new Date().toISOString(), image: scope.mysqlImage, php_image: scope.phpImage,
    container: scope.container, internal_tmpfs_only: true, unrelated_containers_unchanged: true, sources,
    scope: 'Isolated health-service acceptance only; no live activation, migration/save, worker or completed writer replay.' }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ acceptance: 'passed', cases: matrix.length, evidence: successPath, live_writes: 0, jobs_consumed: 0 }));
} catch {
  const path = 'docs/deployment/evidence/patient-health-mysql-failed-' + Date.now() + '-2026-10-22.json';
  writeFileSync(path, JSON.stringify({ acceptance: 'failed', checked_at: new Date().toISOString(), exit_code: probe.status,
    partial_cases: partial, observed_pairs: observed, diagnostics, sources,
    scope: 'No acceptance claim. No automatic reset/retry/cleanup; preserve the fixture for diagnosis. Raw SQL, environment and private payloads suppressed.' }, null, 2) + '\n', { flag: 'wx' });
  throw new Error('Health MySQL acceptance failed; inspect ' + path + '. Do not replay a populated database.');
}
