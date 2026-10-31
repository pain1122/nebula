import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../../.local/media-evaluation/', import.meta.url));
const settingsPath = join(directory, 'settings.json');
const serverPath = join(directory, 's3.json');
if (existsSync(settingsPath) || existsSync(serverPath)) {
  if (!existsSync(settingsPath) || !existsSync(serverPath)) {
    throw new Error('Incomplete evaluation settings exist. Resolve them without overwriting credentials.');
  }
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  const server = JSON.parse(readFileSync(serverPath, 'utf8'));
  if (settings.evaluationOnly !== true || settings.bucket !== 'checkupino-medical-eval'
      || server.identities?.length !== 2
      || server.identities.some(identity => identity.name === 'anonymous')) {
    throw new Error('Existing evaluation settings do not match the expected private configuration.');
  }
  console.log('Existing evaluation credentials preserved. No files changed.');
} else {
  const application = { accessKey: randomBytes(16).toString('hex'), secretKey: randomBytes(32).toString('hex') };
  const bootstrap = { accessKey: randomBytes(16).toString('hex'), secretKey: randomBytes(32).toString('hex') };
  const bucket = 'checkupino-medical-eval';
  const settings = { evaluationOnly: true, bucket, region: 'us-east-1', endpoint: 'http://checkupino-media-s3:8333', application, bootstrap };
  const server = { identities: [
    { name: 'medical-evaluation-bootstrap', credentials: [bootstrap], actions: ['Admin', 'Read', 'Write', 'List'] },
    { name: 'medical-evaluation-app', credentials: [application], actions: [`Read:${bucket}`, `Write:${bucket}`, `List:${bucket}`, `Tagging:${bucket}`] },
  ] };
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  writeFileSync(serverPath, JSON.stringify(server, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Fresh synthetic evaluation credentials prepared in the ignored .local/media-evaluation directory.');
}
