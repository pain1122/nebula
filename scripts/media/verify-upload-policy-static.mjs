import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const docker = (args) => {
  const result = spawnSync('docker', args, { windowsHide: true, timeout: 20000, maxBuffer: 10000000 });
  assert.equal(result.status, 0, 'Read-only admin artifact inspection must succeed.');
  return result.stdout;
};
const request = (path, encoding = 'identity') => new Promise((resolve, reject) => {
  const operation = http.get('http://localhost:3000' + path, { headers: { 'Accept-Encoding': encoding } }, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
  });
  operation.setTimeout(25000, () => operation.destroy(new Error('HTTP verification timeout.')));
  operation.on('error', reject);
});
const hash = value => createHash('sha256').update(value).digest('hex');
const container = JSON.parse(docker(['inspect', 'checkupino_prod-admin-1']).toString())[0];
assert.equal(container.State.Status, 'running');
assert.equal(container.State.Health.Status, 'healthy');
const html = await request('/panel/upload-limits');
assert.equal(html.status, 200);
const entryPath = html.body.toString().match(/src="(\/panel\/assets\/index-[^" ]+\.js)"/)?.[1];
assert.ok(entryPath, 'Served SPA entry is required.');
const entry = await request(entryPath);
assert.equal(entry.status, 200);
assert.match(entry.body.toString(), /upload-limits/);
const pageName = entry.body.toString().match(/UploadLimits-[\w-]+\.js/)?.[0];
assert.ok(pageName, 'The approved page must be linked from the actual entry.');
const pagePath = '/panel/assets/' + pageName;
const page = await request(pagePath);
assert.equal(page.status, 200);
const assets = [...new Set([entryPath, pagePath,
  ...[...html.body.toString().matchAll(/(?:src|href)="(\/panel\/assets\/[^" ]+\.(?:js|css))"/g)].map(match => match[1]),
  ...[...page.body.toString().matchAll(/from[ ]*["']\.\/([^"']+\.js)["']/g)].map(match => '/panel/assets/' + match[1]),
])];
const checked = [];
let servedCode = '';
for (const path of assets) {
  const identity = await request(path), gzip = await request(path, 'gzip');
  assert.equal(identity.status, 200);
  assert.equal(gzip.status, 200);
  assert.match(identity.headers['cache-control'], /immutable/);
  const packed = docker(['exec', 'checkupino_prod-admin-1', 'cat', '/usr/share/nginx/html' + path]);
  assert.deepEqual(identity.body, packed, 'Served bytes must match the new container: ' + path);
  if (path.endsWith('.js')) servedCode += identity.body.toString();
  if (identity.body.length >= 1024) assert.equal(gzip.headers['content-encoding'], 'gzip');
  assert.deepEqual(gzip.headers['content-encoding'] === 'gzip' ? gunzipSync(gzip.body) : gzip.body, identity.body);
  if (/\/transport-/.test(path)) assert.match(identity.body.toString(), /http:\/\/localhost:8080/);
  checked.push({ path, bytes: identity.body.length, gzip_bytes: gzip.body.length, sha256: hash(identity.body), container_byte_match: true });
}
for (const marker of ['expected_revision', 'review_required', 'type_limit_overrides', 'uploads.medical', 'uploads.public_media', 'uploads.reload', '1048576']) {
  assert.ok(servedCode.includes(marker), 'Missing policy page/shared behavior: ' + marker);
}
for (const path of ['/', '/panel']) {
  const response = await request(path);
  assert.equal(response.status, 308);
  assert.equal(response.headers.location, '/panel/');
}
for (const path of ['/healthz', '/panel/login', '/panel/users', '/panel/my/reservations', '/panel/doctor/reservations'])
  assert.equal((await request(path)).status, 200);
for (const path of ['/panel/assets/missing-upload-policy.js', '/panel/missing-upload-policy.png', '/outside-upload-policy'])
  assert.equal((await request(path)).status, 404);
const evidence = { checked_at: new Date().toISOString(), acceptance: 'passed', image: container.Image,
  entry: entryPath, upload_page: pagePath, assets: checked,
  scope: 'Actual new container and served artifact equality, page linkage/contract markers, origin, redirects/deep links/assets/cache/compression/404. No reference build or browser acceptance inferred.' };
writeFileSync(fileURLToPath(new URL('../../docs/deployment/evidence/upload-policy-panel-static-2026-10-08.json', import.meta.url)), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ acceptance: evidence.acceptance, image: evidence.image, entry: entryPath, upload_page: pagePath, checked_assets: checked.length }));
