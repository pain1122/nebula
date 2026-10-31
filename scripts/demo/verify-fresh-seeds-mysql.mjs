import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { admitScheduleDatabase, scheduleScope as s } from '../media/schedule-acceptance-guard.mjs';

assert.ok(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--preflight', 'Only --preflight is accepted.');
const preflight = process.argv[2] === '--preflight';
const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
const evidence = 'docs/deployment/evidence/fresh-populated-seeds-mysql-2026-11-01.json';
assert.ok(preflight || !existsSync(evidence), 'Accepted receipt exists; do not replay.');
const execute = (args, timeout = 15000) => {
  const value = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 262144 });
  assert.equal(value.status, 0, 'Docker inspection failed; environment output suppressed.');
  return value.stdout;
};
const inspect = (kind, name) => JSON.parse(execute([kind, 'inspect', name, '--format', '{{json .}}']));
for (const pin of [s.phpImage, s.mysqlImage]) assert.equal(execute(['image', 'inspect', pin, '--format', '{{.Id}}']).trim(), pin);
const scanner = inspect('container', 'checkupino_scan-scanner-1');
const parser = inspect('container', 'checkupino_content-content-parser-1');
assert.equal(scanner.Image, 'sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186');
assert.equal(scanner.State.Health.Status, 'healthy');
assert.equal(parser.Image, 'sha256:c4809fae4ab094ce353a28995fac698355ada6eab92f10e18ad874da2d2bbf4c');
assert.equal(parser.State.Running, true);
for (const name of ['checkupino_scan_scan_socket', 'checkupino_content_socket']) execute(['volume', 'inspect', name, '--format', '{{.Name}}']);
const paths = ['scripts/demo/verify-populated-seeds.php', 'scripts/demo/verify-fresh-seeds-mysql.mjs',
  'scripts/media/schedule-acceptance-guard.mjs', 'database/seeders/DatabaseSeeder.php',
  'database/seeders/VerifiedDemoMediaSeeder.php', 'database/seeders/ArticleDemoSeeder.php',
  'database/seeders/PatientExperienceDemoSeeder.php', 'database/seeders/ReservationPaymentDemoSeeder.php'];
const hashes = () => Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const sources = hashes();
if (preflight) {
  console.log(JSON.stringify({ execution: 'preflight_passed', project: s.project, real_media_required: true,
    scope: 'Read-only source/image/socket/runtime checks; no database connection or startup.' }));
  process.exit(0);
}
const members = () => execute(['ps', '-a', '--filter', 'label=com.docker.compose.project=' + s.project, '--format', '{{.Names}}']).trim().split(/\r?\n/);
const password = admitScheduleDatabase(inspect('container', s.container), inspect('network', s.network), members());
const inventory = () => execute(['ps', '-a', '--no-trunc', '--format', '{{json .}}']).trim().split(/\r?\n/)
  .map(line => JSON.parse(line)).filter(row => row.Names !== s.container)
  .map(row => ({ id: row.ID, name: row.Names, image: row.Image, state: row.State })).sort((a, b) => a.name.localeCompare(b.name));
const before = inventory();
const temp = '/tmp/checkupino-seed-runtime';
const args = ['run', '--rm', '--pull', 'never', '--network', s.network, '--read-only', '--init', '--user', '33:33',
  '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--memory', '768m', '--memory-swap', '768m', '--cpus', '1', '--pids-limit', '32',
  '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=256m,mode=1777',
  '--tmpfs', '/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
  '--tmpfs', '/var/www/storage/app/article-media:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
  '--mount', `type=bind,source=${root},target=/var/www,readonly`, '--workdir', '/var/www',
  '--mount', 'type=volume,source=checkupino_scan_scan_socket,target=/run/medical-scan,readonly',
  '--mount', 'type=volume,source=checkupino_content_socket,target=/run/medical-content,readonly'];
const env = { CHECKUPINO_SEED_RUNTIME: 'true', CHECKUPINO_SEED_MYSQL: 'true', APP_ENV: 'testing', APP_DEBUG: 'false',
  APP_KEY: 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=', DB_CONNECTION: 'mysql', DB_HOST: 'mysql-acceptance',
  DB_PORT: '3306', DB_DATABASE: s.database, DB_USERNAME: s.user, DB_PASSWORD: password, DB_URL: '', DB_SOCKET: '',
  CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'database', MAIL_MAILER: 'array', LOG_CHANNEL: 'null', BCRYPT_ROUNDS: '4',
  MEDICAL_STORAGE_DRIVER: 'local', ARTICLE_MEDIA_STORAGE_DRIVER: 'local', LARAVEL_STORAGE_PATH: temp,
  APP_CONFIG_CACHE: temp + '/config.php', APP_ROUTES_CACHE: temp + '/routes.php', VIEW_COMPILED_PATH: temp + '/framework/views' };
for (const [key, value] of Object.entries(env)) args.push('--env', key + '=' + value);
args.push(s.phpImage, 'sh', '-c', 'mkdir -p /tmp/checkupino-seed-runtime/framework/cache /tmp/checkupino-seed-runtime/framework/views /tmp/checkupino-seed-runtime/framework/sessions /tmp/checkupino-seed-runtime/logs && touch /tmp/checkupino-seed-runtime/empty.environment && exec php scripts/demo/verify-populated-seeds.php');
const run = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 262144 });
mkdirSync('docs/deployment/evidence', { recursive: true });
if (run.status !== 0) {
  const path = 'docs/deployment/evidence/fresh-populated-seeds-mysql-failed-' + Date.now() + '.json';
  let diagnostic;
  try { diagnostic = JSON.parse(run.stderr.trim().split(/\r?\n/).find(line => line.startsWith('{'))); } catch { diagnostic = { execution: 'failed' }; }
  // Keep only stage/class/line; never persist raw SQL or credentials from a database exception.
  writeFileSync(path, JSON.stringify({ execution: 'failed', checked_at: new Date().toISOString(), sources,
    stage: diagnostic.stage, class: diagnostic.class, line: diagnostic.line, exit_code: run.status,
    scope: 'Disposable database retained; no automatic reset, replay or cleanup.' }, null, 2) + '\n', { flag: 'wx' });
  throw new Error('Disposable verification failed; inspect ' + path + '. Do not replay a populated schema.');
}
assert.ok(!run.stdout.includes(password), 'Credential output refused.');
const result = JSON.parse(run.stdout);
assert.equal(result.execution, 'passed'); assert.equal(result.driver, 'mysql');
assert.equal(result.real_scanner, true); assert.equal(result.remote_parser, true);
assert.equal(result.owned_jobs_processed, 2); assert.equal(result.repeat_preserved, true); assert.equal(result.live_database_writes, 0);
assert.equal(result.repeat_exact_rows_preserved, true);
assert.deepEqual(inventory(), before, 'An unrelated container changed.');
admitScheduleDatabase(inspect('container', s.container), inspect('network', s.network), members());
assert.deepEqual(hashes(), sources, 'Source changed during acceptance.');
writeFileSync(evidence, JSON.stringify({ ...result, checked_at: new Date().toISOString(), sources,
  internal_tmpfs_only: true, unrelated_containers_unchanged: true }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ execution: 'passed', counts: result.counts, scanner_database: result.scanner_database,
  live_database_writes: 0, evidence, cleanup: 'operator-owned guarded cleanup required' }));
