import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const php = `<?php
require '/var/www/vendor/autoload.php';
echo json_encode(Symfony\\Component\\Yaml\\Yaml::parseFile('/var/www/docker-compose.scan.yml'), JSON_THROW_ON_ERROR);
`;
const parsed = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], {
  input: php, encoding: 'utf8', windowsHide: true, timeout: 15000,
});
assert.equal(parsed.status, 0, 'Scanner YAML must parse as www-data.');
const config = JSON.parse(parsed.stdout);
assert.equal(config.name, 'checkupino_scan');
assert.deepEqual(Object.keys(config.services).sort(), ['scan-check', 'scan-init', 'scan-worker', 'scanner']);
for (const service of Object.values(config.services)) {
  assert.equal(service.read_only, true);
  assert.ok(!service.ports?.length);
  assert.deepEqual(service.cap_drop, ['ALL']);
  assert.ok(service.security_opt.includes('no-new-privileges:true'));
}
const scanner = config.services.scanner;
assert.equal(scanner.restart, 'no', 'Failed definition refresh must not trigger automatic evaluation restarts.');
assert.deepEqual(scanner.tmpfs, ['/tmp:size=128m,mode=1777']);
assert.equal(scanner.image, 'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186');
assert.equal(scanner.user, '100:100');
assert.deepEqual(scanner.networks, ['definition_updates']);
assert.ok(scanner.volumes.every(mount => !mount.startsWith('./:') && !mount.includes('.env') && !mount.includes('.local')));
assert.equal(config.services['scan-init'].network_mode, 'none');
assert.deepEqual(config.services['scan-worker'].profiles, ['worker']);
const command = config.services['scan-worker'].command.join(' ');
assert.ok(command.includes('queue:work medical-scan --queue=medical-scan '));
assert.ok(!command.includes('--queue=default') && !command.includes('--queue=medical-scan,'));
for (const name of ['scan-check', 'scan-worker']) {
  assert.deepEqual(config.services[name].tmpfs, ['/tmp:size=128m,mode=1777']);
  assert.equal(config.services[name].user, '33:33');
  assert.deepEqual(config.services[name].networks, ['backend']);
  assert.ok(config.services[name].volumes.includes('scan_socket:/run/medical-scan:ro'));
  assert.ok(config.services[name].volumes.includes('content_socket:/run/medical-content:ro'));
  assert.ok(config.services[name].volumes.includes('./:/var/www:ro'));
  assert.equal(config.services[name].pull_policy, 'never');
  assert.equal(config.services[name].environment.MEDICAL_LOCAL_STORAGE_ROOT, '/var/www/storage/app/private');
}
assert.equal(config.networks.backend.name, 'checkupino_checkupino_net');
assert.equal(config.networks.backend.external, true);
assert.equal(config.volumes.content_socket.external, true);
assert.equal(config.volumes.content_socket.name, 'checkupino_content_socket');
const clamd = readFileSync('docker/medical-scan/clamd.conf', 'utf8');
assert.ok(!/^TCPSocket\s/m.test(clamd));
for (const directive of ['MaxThreads 1', 'MaxQueue 2', 'FailIfCvdOlderThan 2', 'AlertExceedsMax yes', 'AlertEncrypted yes', 'StreamMaxLength 10M']) {
  assert.ok(clamd.split(/\r?\n/).includes(directive));
}
const freshclam = readFileSync('docker/medical-scan/freshclam.conf', 'utf8');
assert.ok(freshclam.includes('DatabaseMirror database.clamav.net'));
assert.ok(freshclam.includes('Checks 12'));
console.log('Scanner YAML, pinned image, socket isolation, credentials exclusion and dedicated worker command pass. No Compose operation ran.');
