import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const execute = (args, timeout = 15000) => {
  const run = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 65536 });
  assert.equal(run.status, 0, 'Isolated MySQL operation failed; no live database or Compose operation is used.');
  return run.stdout;
};
assert.equal(process.argv.length, 2, 'This guarded rehearsal takes no overrides.');
const name = 'checkupino_medical_acceptance-mysql-acceptance-1';
const db = JSON.parse(execute(['inspect', name, '--format', '{{json .}}']));
const image = 'sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b';
assert.equal(db.Image, image);
assert.equal(db.Config.Labels['com.docker.compose.project'], 'checkupino_medical_acceptance');
assert.equal(db.Config.Labels['com.docker.compose.service'], 'mysql-acceptance');
assert.equal(db.State.Running, true);
assert.equal(db.State.Health.Status, 'healthy');
assert.equal(db.State.OOMKilled, false);
assert.equal(db.RestartCount, 0);
assert.equal(db.Config.User, '999:999');
assert.equal(db.HostConfig.RestartPolicy.Name, 'no');
assert.equal(db.HostConfig.ReadonlyRootfs, true);
assert.equal(db.HostConfig.Privileged, false);
assert.equal(db.HostConfig.Memory, 1073741824);
assert.equal(db.HostConfig.MemorySwap, 1073741824);
assert.equal(db.HostConfig.NanoCpus, 1000000000);
assert.equal(db.HostConfig.PidsLimit, 64);
assert.deepEqual(db.HostConfig.CapDrop, ['ALL']);
assert.ok(db.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
assert.equal(Object.keys(db.HostConfig.PortBindings ?? {}).length, 0);
assert.ok(!db.Mounts.some(mount => mount.Type === 'bind' || mount.Type === 'volume'));
assert.ok(db.HostConfig.Tmpfs['/var/lib/mysql']);
assert.deepEqual(db.HostConfig.Tmpfs, {
  '/var/lib/mysql': 'size=512m,mode=0700,uid=999,gid=999',
  '/var/run/mysqld': 'size=4m,mode=0755,uid=999,gid=999',
  '/tmp': 'size=32m,mode=1777',
});
const network = 'checkupino_medical_acceptance_acceptance';
assert.deepEqual(Object.keys(db.NetworkSettings.Networks), [network]);
const net = JSON.parse(execute(['network', 'inspect', network, '--format', '{{json .}}']));
assert.equal(net.Internal, true);
assert.equal(net.Labels['com.docker.compose.project'], 'checkupino_medical_acceptance');
const env = Object.fromEntries(db.Config.Env.map(item => { const at = item.indexOf('='); return [item.slice(0, at), item.slice(at + 1)]; }));
assert.equal(env.MYSQL_DATABASE, 'checkupino_medical_acceptance');
assert.equal(env.MYSQL_USER, 'medical_acceptance');
assert.ok(typeof env.MYSQL_PASSWORD === 'string' && /^[a-f0-9]{32}$/.test(env.MYSQL_PASSWORD), 'An operator-generated temporary password is required; its value is never logged.');
const phpImage = 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746';
execute(['image', 'inspect', phpImage, '--format', '{{.Id}}']);
const args = ['run', '--rm', '--pull', 'never', '--network', network, '--read-only', '--init', '--user', '33:33',
  '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--memory', '512m', '--memory-swap', '512m', '--cpus', '1', '--pids-limit', '16',
  '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777',
  '--tmpfs', '/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
  '--mount', `type=bind,source=${resolve('.')},target=/var/www,readonly`, '--workdir', '/var/www'];
const config = { CHECKUPINO_MEDICAL_MYSQL_REHEARSAL: 'true', APP_ENV: 'testing', APP_DEBUG: 'false',
  APP_KEY: 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=', DB_CONNECTION: 'mysql',
  DB_HOST: 'mysql-acceptance', DB_PORT: '3306', DB_DATABASE: env.MYSQL_DATABASE, DB_USERNAME: env.MYSQL_USER, DB_PASSWORD: env.MYSQL_PASSWORD,
  DB_URL: '', DB_SOCKET: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', MAIL_MAILER: 'array', LOG_CHANNEL: 'null',
  MEDICAL_SCAN_ENABLED: 'false', MEDICAL_STORAGE_DRIVER: 'local', BCRYPT_ROUNDS: '4',
  MEDICAL_LOCAL_STORAGE_ROOT: '/tmp/medical-upload-races/private', LARAVEL_STORAGE_PATH: '/tmp/medical-upload-races',
  APP_CONFIG_CACHE: '/tmp/medical-upload-races/config.php', VIEW_COMPILED_PATH: '/tmp/medical-upload-races/framework/views' };
for (const [key, value] of Object.entries(config)) args.push('--env', key + '=' + value);
args.push(phpImage, 'php', 'scripts/media/probe-upload-races.php', 'parent');
const output = execute(args, 150000);
let result;
try { result = JSON.parse(output); } catch { throw new Error('No completed upload-race evidence; an exit code alone is not acceptance.'); }
assert.equal(result.acceptance, 'passed');
assert.equal(result.database, 'checkupino_medical_acceptance');
assert.equal(result.cases.length, 2);
assert.equal(result.default_queue_sentinel_unchanged, true);
assert.equal(result.medical_scan_jobs, 0);
assert.equal(result.medical_admission_locks_remaining, 0);
console.log(JSON.stringify(result, null, 2));
console.log('Disposable MySQL races passed; live DB/storage/queues and Compose untouched. Test DB remains tmpfs until operator cleanup.');
