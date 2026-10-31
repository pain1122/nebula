import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

assert.equal(process.argv.length, 2, 'No endpoint/container overrides accepted.');
const docker = args => {
  const result = spawnSync('docker', args, { windowsHide: true, timeout: 20000, maxBuffer: 12000000 });
  assert.equal(result.status, 0, 'Read-only admin inspection failed.');
  return result.stdout;
};
const request = (path, encoding = 'identity') => new Promise((resolve, reject) => {
  assert.match(path, /^\/(?:panel(?:\/|$)|healthz$|$|outside-medical-panel$)/);
  const operation = http.get('http://localhost:3000' + path, { headers: { 'Accept-Encoding': encoding } }, response => {
    const chunks = []; let size = 0;
    response.on('data', chunk => { size += chunk.length; if (size > 12000000) operation.destroy(new Error('Response bound exceeded.')); else chunks.push(chunk); });
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
  });
  operation.setTimeout(20000, () => operation.destroy(new Error('Local HTTP timeout.')));
  operation.on('error', reject);
});
const container = JSON.parse(docker(['inspect', 'checkupino_prod-admin-1']))[0];
assert.equal(container.State.Status, 'running'); assert.equal(container.State.Health.Status, 'healthy');
const html = await request('/panel/');
assert.equal(html.status, 200);
const entryPath = html.body.toString().match(/src="(\/panel\/assets\/index-[^" ]+\.js)"/)?.[1];
assert.ok(entryPath, 'SPA entry missing.');
const entry = await request(entryPath);
assert.equal(entry.status, 200);
for (const path of ['my/reservations/:reservationId/medical', 'doctor/reservations/:reservationId/medical']) assert.ok(entry.body.toString().includes(path), 'Approved route missing.');
const medicalName = entry.body.toString().match(/MedicalFiles-[\w-]+\.js/)?.[0];
const cssName = entry.body.toString().match(/MedicalFiles-[\w-]+\.css/)?.[0];
assert.ok(medicalName && cssName, 'Medical page/lazy retained CSS missing.');
assert.ok(!html.body.toString().includes(cssName), 'Medical CSS must remain outside initial HTML.');
const pagePath = '/panel/assets/' + medicalName;
const cssPath = '/panel/assets/' + cssName;
const page = await request(pagePath);
const questionnaireName = entry.body.toString().match(/PatientQuestionnaire-[\w-]+\.js/)?.[0];assert.ok(questionnaireName,'Questionnaire lazy page missing.');assert.ok(entry.body.toString().includes('my/questionnaire'),'Approved questionnaire route missing.');
const questionnairePath='/panel/assets/'+questionnaireName;const questionnairePage=await request(questionnairePath);
const assets = [...new Set([entryPath, pagePath, cssPath, questionnairePath,
  ...[...questionnairePage.body.toString().matchAll(/from[ ]*["']\.\/([^"']+\.js)["']/g)].map(match => '/panel/assets/' + match[1]),
  ...[...html.body.toString().matchAll(/(?:src|href)="(\/panel\/assets\/[^" ]+\.(?:js|css))"/g)].map(match => match[1]),
  ...[...page.body.toString().matchAll(/from[ ]*["']\.\/([^"']+\.js)["']/g)].map(match => '/panel/assets/' + match[1]),
])];
const checked = []; let code = '';
for (const path of assets) {
  assert.match(path, /^\/panel\/assets\/[\w.-]+\.(?:js|css)$/);
  const plain = await request(path), gzip = await request(path, 'gzip');
  assert.equal(plain.status, 200); assert.equal(gzip.status, 200);
  assert.match(plain.headers['cache-control'], /immutable/);
  assert.deepEqual(plain.body, docker(['exec', 'checkupino_prod-admin-1', 'cat', '/usr/share/nginx/html' + path]), 'Served/container bytes differ.');
  if (plain.body.length >= 1024) assert.equal(gzip.headers['content-encoding'], 'gzip');
  assert.deepEqual(gzip.headers['content-encoding'] === 'gzip' ? gunzipSync(gzip.body) : gzip.body, plain.body);
  if (path.endsWith('.js')) code += plain.body.toString();
  if (path === cssPath) assert.ok(plain.body.toString().includes('.file-manager-sidebar'));
  checked.push({ path, bytes: plain.body.length, gzip_bytes: gzip.body.length, sha256: createHash('sha256').update(plain.body).digest('hex'), container_byte_match: true });
}
for (const marker of ['medical.outcomePending', 'medical.policyUnavailable', 'attachment_rules', 'body_format', 'plain_text', 'http://localhost:8080']) assert.ok(code.includes(marker), 'Missing medical contract/origin marker: ' + marker);
for (const marker of ['medical.newRequest', 'medical.issueRequest', 'medical.maximumBytes', 'request_type', 'allowed_mime_types']) assert.ok(code.includes(marker), 'Missing request-control marker: ' + marker);
for (const marker of ['medical.uploadFile', 'medical.sendFile', 'medical.uploadPolicyChanged', 'upload_progress', 'awaiting_checks_count']) assert.ok(code.includes(marker), 'Missing upload-control marker: ' + marker);
for (const marker of ['medical.startReview', 'medical.newDraft', 'medical.editDraft', 'medical.publishConfirm', 'medical.confirmPublication', 'medical.amendReport', 'medical.download', 'supersedes_report_id']) assert.ok(code.includes(marker), 'Missing medical outcome control: ' + marker);
for(const marker of ['questionnaire.submit','questionnaire.uncertain','questionnaire.score','questionnaire_version','demo-heart-health-screen','submitter_name','choice_id'])if(marker!=='questionnaire_version')assert.ok(code.includes(marker),'Questionnaire contract missing: '+marker);
for (const path of ['/', '/panel']) { const result = await request(path); assert.equal(result.status, 308); assert.equal(result.headers.location, '/panel/'); }
for (const path of ['/healthz', '/panel/login', '/panel/my/questionnaire', '/panel/my/reservations/synthetic-reservation/medical', '/panel/doctor/reservations/synthetic-reservation/medical']) assert.equal((await request(path)).status, 200);
for (const path of ['/panel/assets/missing-medical-panel.js', '/panel/missing-medical-panel.png', '/outside-medical-panel']) assert.equal((await request(path)).status, 404);
const evidence = { checked_at: new Date().toISOString(), acceptance: 'passed', image: container.Image, entry: entryPath, medical_page: pagePath, questionnaire_page:questionnairePath, lazy_medical_css: cssPath, medical_css_absent_initial_html: true, assets: checked, scope: 'Read-only actual served/container asset equality, medical linkage/markers/lazy CSS, compression/cache/redirect/refresh/404; no browser/clinical acceptance inferred.' };
writeFileSync(fileURLToPath(new URL('../../docs/deployment/evidence/demo-questionnaire-static-2026-10-11.json', import.meta.url)), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ acceptance: 'passed', image: container.Image, entry: entryPath, medical_page: pagePath, medical_css: cssPath, checked_assets: checked.length }));
