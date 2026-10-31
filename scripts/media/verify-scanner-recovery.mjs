import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

assert.equal(process.argv.length, 2, 'This guarded disposable rehearsal takes no overrides.');
const deadline = Date.now() + 220000;
let cleaning = false;
const execute = (args, timeout = 15000) => {
  assert.ok(cleaning || Date.now() < deadline, 'Disposable recovery deadline exceeded.');
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 65536 });
  assert.equal(result.status, 0, 'Disposable recovery operation failed; no live lifecycle or definition request is used.');
  return result.stdout.trim();
};
const inspect = name => JSON.parse(execute(['inspect', name, '--format', '{{json .}}']));
const live = inspect('checkupino_scan-scanner-1');
const scannerImage = 'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186';
const scannerId = 'sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186';
const phpImage = 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746';
assert.equal(live.Image, scannerId);
assert.equal(live.State.Running, true);
assert.equal(live.State.Health.Status, 'healthy');
assert.equal(live.RestartCount, 0);
assert.equal(live.State.OOMKilled, false);
const definitions = live.Mounts.find(x => x.Destination === '/var/lib/clamav');
assert.equal(definitions.Type, 'volume');
assert.equal(definitions.Name, 'checkupino_scan_scan_definitions');
execute(['image', 'inspect', phpImage, '--format', '{{.Id}}']);
const token = randomUUID().replaceAll('-', '');
const label = 'checkupino.synthetic.recovery';
const volume = `checkupino-scan-recovery-${token}`;
const daemon = `${volume}-daemon`;
const client = `${volume}-client`;
const created = new Set();
let volumeCreated = false;
const facts = {};
const ownContainer = (name, image) => {
  const d = inspect(name);
  assert.equal(d.Name, '/' + name);
  assert.equal(d.Image, image);
  assert.equal(d.Config.Labels[label], token);
  return d;
};
const ownVolume = () => {
  const v = JSON.parse(execute(['volume', 'inspect', volume, '--format', '{{json .}}']));
  assert.equal(v.Name, volume);
  assert.equal(v.Labels[label], token);
  assert.equal(v.Driver, 'local');
  assert.deepEqual(v.Options, { type: 'tmpfs', device: 'tmpfs', o: 'size=1m,uid=100,gid=100,mode=0755' });
};
const waitReady = async () => {
  const start = Date.now();
  while (Date.now() - start < 75000) {
    const d = ownContainer(daemon, scannerId);
    assert.equal(d.State.Running, true, 'Sandbox daemon exited before acceptance; preserve failure, no retry.');
    assert.equal(d.State.OOMKilled, false);
    if (d.State.Health?.Status === 'healthy') return Number(((Date.now() - start) / 1000).toFixed(3));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Sandbox readiness deadline exceeded; no live scanner retry.');
};
const probe = phase => {
  ownContainer(client, phpImage);
  const r = JSON.parse(execute(['exec', '--user', '33:33', client, 'php', 'scripts/media/probe-scanner-recovery.php', phase], 18000));
  assert.equal(r.acceptance, 'passed');
  assert.equal(r.phase, phase);
  return r;
};
const boundary = (name, image, uid, memory, socketReadonly) => {
  const d = ownContainer(name, image);
  assert.equal(d.Config.User, uid);
  assert.equal(d.HostConfig.ReadonlyRootfs, true);
  assert.equal(d.HostConfig.Privileged, false);
  assert.deepEqual(d.HostConfig.CapDrop, ['ALL']);
  assert.ok(d.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
  assert.equal(d.HostConfig.NetworkMode, 'none');
  assert.equal(Object.keys(d.HostConfig.PortBindings ?? {}).length, 0);
  assert.equal(d.HostConfig.Memory, memory);
  assert.equal(d.HostConfig.MemorySwap, memory);
  assert.equal(d.HostConfig.NanoCpus, name === daemon ? 1000000000 : 500000000);
  assert.equal(d.HostConfig.PidsLimit, name === daemon ? 16 : 8);
  assert.equal(d.HostConfig.RestartPolicy.Name, 'no');
  const socket = d.Mounts.find(x => x.Destination === '/run/medical-scan');
  assert.equal(socket.Name, volume);
  assert.equal(socket.RW, !socketReadonly);
  assert.ok(!d.Mounts.some(x => x.Name === 'checkupino_scan_scan_socket'));
  if (name === daemon) {
    assert.equal(d.Path, 'timeout');
    assert.deepEqual(d.Args, ['200s', 'clamd', '--foreground', '--config-file=/etc/clamav/clamd.conf']);
    assert.equal(d.Mounts.length, 3);
    const db = d.Mounts.find(x => x.Destination === '/var/lib/clamav');
    assert.equal(db.Name, definitions.Name);
    assert.equal(db.RW, false);
    const config = d.Mounts.find(x => x.Destination === '/etc/clamav/clamd.conf');
    assert.equal(config.Type, 'bind');
    assert.equal(config.RW, false);
  } else {
    assert.equal(d.Mounts.length, 2);
    const source = d.Mounts.find(x => x.Destination === '/var/www');
    assert.equal(source.Type, 'bind');
    assert.equal(source.RW, false);
  }
};
try {
  execute(['volume', 'create', '--driver', 'local', '--label', `${label}=${token}`, '--opt', 'type=tmpfs',
    '--opt', 'device=tmpfs', '--opt', 'o=size=1m,uid=100,gid=100,mode=0755', volume]);
  volumeCreated = true;
  ownVolume();
  const env = { CHECKUPINO_SCANNER_RECOVERY_REHEARSAL: 'true', CHECKUPINO_SCANNER_RECOVERY_CLOCK_OFFSET: '0',
    APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
    DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:', DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array',
    MAIL_MAILER: 'array', LOG_CHANNEL: 'null', MEDICAL_SCAN_ENABLED: 'false', MEDICAL_STORAGE_DRIVER: 'local',
    MEDICAL_LOCAL_STORAGE_ROOT: '/tmp/scanner-recovery/private', LARAVEL_STORAGE_PATH: '/tmp/scanner-recovery',
    APP_CONFIG_CACHE: '/tmp/scanner-recovery/config.php', VIEW_COMPILED_PATH: '/tmp/scanner-recovery/framework/views' };
  const args = ['create', '--pull', 'never', '--name', client, '--label', `${label}=${token}`, '--network', 'none',
    '--read-only', '--init', '--user', '33:33', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    '--memory', '256m', '--memory-swap', '256m', '--cpus', '0.5', '--pids-limit', '8',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777',
    '--tmpfs', '/var/www/storage/app/private:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33',
    '--mount', `type=bind,source=${resolve('.')},target=/var/www,readonly`,
    '--mount', `type=volume,source=${volume},target=/run/medical-scan,readonly,volume-nocopy`, '--workdir', '/var/www'];
  for (const [key, value] of Object.entries(env)) args.push('--env', key + '=' + value);
  args.push('--entrypoint', 'sleep', phpImage, '240');
  execute(args);
  created.add(client);
  boundary(client, phpImage, '33:33', 268435456, true);
  execute(['start', client]);
  execute(['create', '--pull', 'never', '--name', daemon, '--label', `${label}=${token}`, '--network', 'none',
    '--read-only', '--init', '--user', '100:100', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    '--memory', '4g', '--memory-swap', '4g', '--cpus', '1', '--pids-limit', '16',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777',
    '--mount', `type=volume,source=${definitions.Name},target=/var/lib/clamav,readonly,volume-nocopy`,
    '--mount', `type=volume,source=${volume},target=/run/medical-scan,volume-nocopy`,
    '--mount', `type=bind,source=${resolve('docker/medical-scan/clamd.conf')},target=/etc/clamav/clamd.conf,readonly`,
    '--health-cmd', 'clamdscan --config-file=/etc/clamav/clamd.conf --ping=1', '--health-interval', '2s',
    '--health-timeout', '2s', '--health-retries', '3', '--health-start-period', '60s',
    '--entrypoint', 'timeout', scannerImage, '200s', 'clamd', '--foreground', '--config-file=/etc/clamav/clamd.conf']);
  created.add(daemon);
  boundary(daemon, scannerId, '100:100', 4294967296, false);
  execute(['start', daemon]);
  console.log('Waiting for disposable offline daemon; live scanner/updater remain untouched.');
  facts.cold_start_seconds = await waitReady();
  facts.initial = probe('active');
  ownContainer(daemon, scannerId);
  execute(['kill', '--signal', 'KILL', daemon]);
  const killed = ownContainer(daemon, scannerId);
  assert.equal(killed.State.Running, false);
  assert.equal(killed.State.OOMKilled, false);
  assert.equal(killed.State.ExitCode, 137);
  facts.crash = probe('stopped');
  assert.equal(facts.crash.socket_inode, facts.initial.socket_inode, 'Real stale socket must survive crash while client keeps tmpfs mounted.');
  ownVolume();
  execute(['start', daemon]);
  console.log('Checking sandbox stale-socket recovery after SIGKILL; no updater or downloads.');
  facts.restart_seconds = await waitReady();
  facts.recovered = probe('active');
  facts.aged_consumer = probe('aged');
  facts.final = probe('active');
  assert.equal(facts.initial.definitions, facts.recovered.definitions);
  assert.equal(facts.recovered.definitions, facts.final.definitions);
  const after = inspect('checkupino_scan-scanner-1');
  assert.equal(after.Id, live.Id);
  assert.equal(after.State.StartedAt, live.State.StartedAt);
  assert.equal(after.State.Health.Status, 'healthy');
  assert.equal(after.RestartCount, 0);
  facts.live_scanner_unchanged = true;
} finally {
  cleaning = true;
  for (const name of [daemon, client]) {
    if (created.has(name)) {
      ownContainer(name, name === daemon ? scannerId : phpImage);
      execute(['rm', '--force', name]);
    }
  }
  if (volumeCreated) {
    ownVolume();
    execute(['volume', 'rm', volume]);
  }
}
assert.equal(execute(['ps', '-a', '--filter', `label=${label}=${token}`, '--format', '{{.Names}}']), '');
assert.equal(execute(['volume', 'ls', '--filter', `label=${label}=${token}`, '--format', '{{.Name}}']), '');
console.log(JSON.stringify({ acceptance: 'passed', ...facts, disposable_cleanup: 'complete',
  limits: ['Offline cached-definition clone, not a live updater failure/restart or network diagnosis',
    'Aged-consumer check injects only caller time; no actual 48-hour daemon aging or clock changes',
    'Synthetic memory streams only; no patient files/database/schema/queue/worker or larger-file load'] }, null, 2));
