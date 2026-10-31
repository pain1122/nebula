import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const docker = (args, input) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, timeout: 20000 });
  assert.equal(result.status, 0, 'Read-only Docker verification must succeed.');
  return result.stdout;
};
const names = ['master', 'volume', 'filer', 's3'].map(name => `checkupino_media-media-${name}-1`);
const containers = JSON.parse(docker(['inspect', ...names]));
const services = containers.map(container => {
  assert.equal(container.State.Status, 'running');
  assert.equal(container.RestartCount, 0);
  assert.ok(container.Config.Image.endsWith('@sha256:aba492e2a4e4c90bff795745e8e660affa1f09e7650f5981bd7bccd1a06cd931'));
  assert.equal(container.HostConfig.ReadonlyRootfs, true);
  assert.ok(Object.values(container.NetworkSettings.Ports).every(binding => binding === null));
  const networks = Object.keys(container.NetworkSettings.Networks).sort();
  const gateway = container.Name.endsWith('media-s3-1');
  assert.deepEqual(networks, gateway
    ? ['checkupino_checkupino_net', 'checkupino_media_medical_core']
    : ['checkupino_media_medical_core']);
  const status = docker(['exec', container.Name.slice(1), 'cat', '/proc/1/status']);
  assert.match(status, /Uid:\s+1000\s+1000\s+1000\s+1000/);
  assert.match(status, /CapEff:\s+0+\s/);
  assert.match(status, /NoNewPrivs:\s+1/);
  return {
    name: container.Name.slice(1), state: container.State.Status, restarts: container.RestartCount,
    image: container.Config.Image, uid: 1000, effectiveCapabilities: 0, noNewPrivileges: true,
    readOnlyRoot: true, publishedPorts: [], networks,
    memoryLimitBytes: container.HostConfig.Memory,
  };
});
const core = JSON.parse(docker(['network', 'inspect', 'checkupino_media_medical_core']))[0];
assert.equal(core.Internal, true);
const php = `<?php
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
$ping = Illuminate\\Support\\Facades\\Redis::ping();
echo json_encode([
    'environment' => $app->environment(),
    'livePrivateDriver' => config('filesystems.disks.private.driver'),
    'databaseConnected' => Illuminate\\Support\\Facades\\DB::connection()->getPdo() !== null,
    'redisConnected' => in_array($ping, [true, 'PONG', '+PONG'], true),
    'medicalRowsIncludingArchived' => App\\Models\\ReservationFile::withTrashed()->count(),
    's3AdapterVersion' => Composer\\InstalledVersions::getPrettyVersion('league/flysystem-aws-s3-v3'),
    'awsSdkVersion' => Composer\\InstalledVersions::getPrettyVersion('aws/aws-sdk-php'),
], JSON_THROW_ON_ERROR);
`;
const backend = JSON.parse(docker(['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], php));
assert.equal(backend.environment, 'local');
assert.equal(backend.livePrivateDriver, 'local');
assert.equal(backend.databaseConnected, true);
assert.equal(backend.redisConnected, true);
const health = [];
for (const url of ['http://localhost:8080/up', 'http://localhost:3000/healthz']) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  assert.equal(response.status, 200);
  await response.body?.cancel();
  health.push({ url, status: response.status });
}
const evidence = {
  checkedAt: new Date().toISOString(), scope: 'Isolated synthetic SeaweedFS evaluation only',
  services, internalCoreNetwork: true, backend, health,
  limits: ['Internal HTTP only; no production transport encryption acceptance',
    'No actual antivirus or medical UI acceptance', 'No live medical driver activation',
    'No HIPAA compliance, encrypted spool/storage/backups or availability acceptance'],
};
const path = fileURLToPath(new URL('../../docs/deployment/evidence/seaweedfs-runtime-2026-10-05.json', import.meta.url));
writeFileSync(path, JSON.stringify(evidence, null, 2) + '\n');
console.log('Runtime isolation, unprivileged processes, database/Redis and both HTTP health checks pass. Redacted evidence saved.');
