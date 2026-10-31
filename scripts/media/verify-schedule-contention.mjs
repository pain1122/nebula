import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { admitScheduleDatabase, scheduleScope as s } from './schedule-acceptance-guard.mjs';

assert.equal(process.argv.length, 2, 'No endpoint, container, account or command overrides accepted.');
const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
const evidencePath = 'docs/deployment/evidence/schedule-contention-2026-10-16.json';
assert.ok(!existsSync(evidencePath), 'Never overwrite acceptance or replay this disposable database.');
const execute = (args, timeout = 15000) => {
  const run = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 131072 });
  // Do not print raw inspect/env/connection output, even on failure.
  assert.equal(run.status, 0, 'Bounded isolated Docker check failed; no completed contention acceptance.');
  return run.stdout;
};
const inspect = (kind, name) => JSON.parse(execute([kind, 'inspect', name, '--format', '{{json .}}']));
const db = inspect('container', s.container);
const net = inspect('network', s.network);
const members = execute(['ps', '-a', '--filter', 'label=com.docker.compose.project=' + s.project, '--format', '{{.Names}}']).trim().split(/\r?\n/);
const password = admitScheduleDatabase(db, net, members);
assert.equal(execute(['image', 'inspect', s.phpImage, '--format', '{{.Id}}']).trim(), s.phpImage);
const accepted = JSON.parse(readFileSync('docs/deployment/evidence/staff-directory-acceptance-2026-10-16.json', 'utf8'));
const scheduleAccepted = JSON.parse(readFileSync('docs/deployment/evidence/admin-schedule-controls-acceptance-2026-10-15.json', 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const protectedPaths = ['app/Services/AdminVisitSlotControl.php', 'app/Services/DoctorVisitSlotControlService.php',
  'app/Services/BookingService.php', 'app/Services/ReservationRescheduleService.php', 'app/Services/AuditLogger.php',
  'app/Services/OutboxPublisher.php', 'routes/api.php', 'composer.json', 'composer.lock', 'frontend/package.json', 'frontend/package-lock.json'];
const protectedSources = Object.fromEntries(protectedPaths.map(path => {
  const prior = accepted.sources[path] ?? scheduleAccepted.sources[path];
  if (prior) assert.equal(sha(path), prior, 'Accepted production source changed: ' + path);
  return [path, sha(path)];
}));
const untouchedContainers = () => execute(['ps', '-a', '--no-trunc', '--format', '{{json .}}']).trim().split(/\r?\n/).map(line => JSON.parse(line))
  .filter(item => item.Names !== s.container).map(item => ({ id: item.ID, name: item.Names, image: item.Image, state: item.State })).sort((a, b) => a.name.localeCompare(b.name));
const before = untouchedContainers();
const args = ['run', '--rm', '--pull', 'never', '--network', s.network, '--read-only', '--init', '--user', '33:33',
  '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--memory', '512m', '--memory-swap', '512m', '--cpus', '1', '--pids-limit', '32',
  '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
  '--tmpfs', '/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
  '--mount', `type=bind,source=${root},target=/var/www,readonly`, '--workdir', '/var/www'];
const config = { CHECKUPINO_SCHEDULE_MYSQL_REHEARSAL: 'true', APP_ENV: 'testing', APP_DEBUG: 'false',
  APP_KEY: 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=', DB_CONNECTION: 'mysql',
  DB_HOST: 'mysql-acceptance', DB_PORT: '3306', DB_DATABASE: s.database, DB_USERNAME: s.user, DB_PASSWORD: password,
  DB_URL: '', DB_SOCKET: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'database', MAIL_MAILER: 'array', LOG_CHANNEL: 'null',
  MEDICAL_SCAN_ENABLED: 'false', MEDICAL_STORAGE_DRIVER: 'local', BCRYPT_ROUNDS: '4',
  MEDICAL_LOCAL_STORAGE_ROOT: '/tmp/checkupino-schedule-contention/private', LARAVEL_STORAGE_PATH: '/tmp/checkupino-schedule-contention',
  APP_CONFIG_CACHE: '/tmp/checkupino-schedule-contention/config.php', VIEW_COMPILED_PATH: '/tmp/checkupino-schedule-contention/framework/views' };
for (const [key, value] of Object.entries(config)) args.push('--env', key + '=' + value);
args.push(s.phpImage, 'php', 'scripts/media/probe-schedule-contention.php', 'parent');
const probe = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 210000, maxBuffer: 131072 });
if (probe.status !== 0) {
  const partialCases = (probe.stderr ?? '').split(/\r?\n/).flatMap(line => {
    let value;
    try { value = JSON.parse(line); } catch { return []; }
    const item = value?.schedule_case_result;
    return item && /^[a-z_]+$/.test(item.name) && item.atomic_audit_payment_outbox_and_immutable_slot_verified === true ? [item] : [];
  });
  const safeDiagnostics = (probe.stderr ?? '').split(/\r?\n/).flatMap(line => {
    let value;
    try { value = JSON.parse(line); } catch { return []; }
    if (value?.schedule_probe_failure !== true || !/^[A-Za-z\\]+$/.test(value.class) || !/^[a-zA-Z0-9_-]+$/.test(value.stage)) return [];
    return [{ class: value.class, stage: value.stage, line: Number.isInteger(value.line) ? value.line : null,
      assertion: value.class === 'ScheduleProbeAssertion' && typeof value.assertion === 'string' ? value.assertion.slice(0, 256) : null }];
  });
  const failurePath = 'docs/deployment/evidence/schedule-contention-failed-' + Date.now() + '-2026-10-16.json';
  writeFileSync(failurePath, JSON.stringify({ acceptance: 'failed', checked_at: new Date().toISOString(), exit_code: probe.status,
    diagnostics: safeDiagnostics, partial_cases: partialCases, database: s.database, sources: { probe: sha('scripts/media/probe-schedule-contention.php'), runner: sha('scripts/media/verify-schedule-contention.mjs') },
    scope: 'No success claim. Raw environment/SQL/credentials omitted. Preserve this disposable database for diagnosis; no automatic replay/reset/cleanup.' }, null, 2) + '\n', { flag: 'wx' });
  throw new Error('Isolated contention probe failed; inspect ' + failurePath + '. No automatic replay.');
}
const output = probe.stdout;
assert.ok(!output.includes(password), 'Credential output refused.');
const result = JSON.parse(output);
assert.equal(result.acceptance, 'passed');
assert.equal(result.database, s.database);
assert.equal(result.isolation, 'REPEATABLE-READ');
assert.equal(result.cases.length, 9);
assert.equal(result.cases.find(item => item.name === 'same_day_admin_revision').targets, 2);
assert.equal(result.cases.find(item => item.name === 'same_week_admin_revision').targets, 3);
assert.equal(result.default_queue_sentinel_unchanged, true);
assert.equal(result.medical_jobs, 0);
for (const item of result.cases) assert.equal(item.atomic_audit_payment_outbox_and_immutable_slot_verified, true);
assert.deepEqual(untouchedContainers(), before, 'An unrelated container changed; no accepted runtime conclusion.');
admitScheduleDatabase(inspect('container', s.container), inspect('network', s.network), members);
for (const [path, hash] of Object.entries(protectedSources)) assert.equal(sha(path), hash);
const paths = ['docker-compose.schedule-acceptance.yml', 'scripts/media/start-schedule-acceptance.ps1',
  'scripts/media/schedule-acceptance-guard.mjs', 'scripts/media/schedule-acceptance-guard.test.mjs',
  'scripts/media/verify-schedule-contention.mjs', 'scripts/media/probe-schedule-contention.php'];
const evidence = { ...result, checked_at: new Date().toISOString(), container: s.container, image: s.mysqlImage, php_image: s.phpImage,
  internal_tmpfs_only: true, live_container_identity_and_state_preserved: true, protected_sources: protectedSources,
  historical_source_bindings_checked: protectedPaths.filter(path => accepted.sources[path] ?? scheduleAccepted.sources[path]),
  sources: Object.fromEntries(paths.map(path => [path, sha(path)])),
  scope: 'Disposable synthetic service contention; existing production source and live container identity/state preserved. No live SQL, business save, download, worker, provider, scanner, build or Compose operation by this runner.' };
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ acceptance: 'passed', evidence: evidencePath, cases: result.cases, limits: result.limits }, null, 2));
