import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const php = `<?php
require '/var/www/vendor/autoload.php';
$config = Symfony\\Component\\Yaml\\Yaml::parseFile('/var/www/docker-compose.media.yml');
echo json_encode($config, JSON_THROW_ON_ERROR);
`;
const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], {
  input: php, encoding: 'utf8', windowsHide: true, timeout: 15000,
});
assert.equal(result.status, 0, 'YAML parsing must pass as www-data.');
const config = JSON.parse(result.stdout);
assert.equal(config.name, 'checkupino_media');
assert.equal(config.networks.medical_core.internal, true);
assert.equal(config.networks.backend.external, true);
assert.equal(config.networks.backend.name, 'checkupino_checkupino_net');
assert.deepEqual(Object.keys(config.services).sort(), ['media-filer', 'media-master', 'media-s3', 'media-volume']);
for (const [name, service] of Object.entries(config.services)) {
  assert.ok(!service.ports?.length, `${name} must not publish host ports.`);
  assert.ok(service.image.endsWith('@sha256:aba492e2a4e4c90bff795745e8e660affa1f09e7650f5981bd7bccd1a06cd931'));
  assert.equal(service.read_only, true);
  assert.ok(service.security_opt.includes('no-new-privileges:true'));
  if (name !== 'media-s3') assert.deepEqual(service.networks, ['medical_core']);
}
assert.deepEqual(config.services['media-s3'].networks.backend.aliases, ['checkupino-media-s3']);
for (const flag of ['-iam=false', '-port.iceberg=0', '-port.lance=0', '-autoCreateBucket=false', '-allowDeleteBucketNotEmpty=false']) {
  assert.ok(config.services['media-s3'].command.includes(flag));
}
const directory = new URL('../../.local/media-evaluation/', import.meta.url);
const settings = JSON.parse(readFileSync(fileURLToPath(new URL('settings.json', directory)), 'utf8'));
const server = JSON.parse(readFileSync(fileURLToPath(new URL('s3.json', directory)), 'utf8'));
assert.equal(settings.evaluationOnly, true);
assert.equal(settings.bucket, 'checkupino-medical-eval');
assert.equal(server.identities.length, 2);
assert.ok(server.identities.every(identity => identity.name !== 'anonymous'));
const application = server.identities.find(identity => identity.name === 'medical-evaluation-app');
assert.deepEqual(application.credentials, [settings.application]);
assert.deepEqual(application.actions.sort(), ['List', 'Read', 'Tagging', 'Write'].map(action => `${action}:${settings.bucket}`).sort());
const bootstrap = server.identities.find(identity => identity.name === 'medical-evaluation-bootstrap');
assert.deepEqual(bootstrap.credentials, [settings.bootstrap]);
assert.notEqual(settings.application.accessKey, settings.bootstrap.accessKey);
assert.notEqual(settings.application.secretKey, settings.bootstrap.secretKey);
console.log('Evaluation YAML, isolation, immutable image pin and credential scopes pass. No secrets printed.');
