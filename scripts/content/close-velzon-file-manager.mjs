// Read-only closeout. Never admits files, changes content, starts services or consumes jobs.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { snapshot, runtime } from '../health/activation-state.mjs';

assert.equal(process.argv.length, 2);
const directory = 'docs/deployment/evidence/';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const before = read(directory + 'velzon-file-manager-before-2026-10-25.json');
const contentBefore = read(directory + 'velzon-file-manager-content-before-2026-10-25.json');
const image = 'sha256:6fb2ff48153559d09e9d1f1aa57209a2cf8dc0e70048d9daccbb9d33c6791eb7';
const fullImage = 'sha256:b1af96fede8a6393d99d15be1cb645bbe5d81d811dd65679a32cfb68d52ea3fe';
const latest = (prefix, expectedImage = image) => {
  const matches = readdirSync(directory).filter(name => name.startsWith(prefix) && name.endsWith('-2026-10-25.json'))
    .sort().reverse().map(name => ({ path: directory + name, result: read(directory + name) }))
    .filter(row => row.result.acceptance === 'passed' && row.result.image === expectedImage);
  assert.ok(matches.length, 'Current-image passing receipt required: ' + prefix);
  return matches[0];
};
const browser = {path: directory+'velzon-file-manager-browser-1792884450756-2026-10-25.json',result:read(directory+'velzon-file-manager-browser-1792884450756-2026-10-25.json')}, completion=latest('velzon-file-manager-completion-',fullImage), footer = latest('velzon-file-manager-footer-browser-'), assets = latest('velzon-file-manager-static-');
assert.equal(footer.result.checks.length, 9);
assert.equal(footer.result.captures.length, 8);
assert.equal(footer.result.geometries.length, 8);
for(const key of ['blocked','exceptions','external','toolboxMocks'])assert.deepEqual(footer.result[key],[]);
assert.ok(footer.result.requests.every(row => ['GET','OPTIONS'].includes(row.method)||row.method==='POST'&&['/login','/logout'].includes(row.path)));
assert.equal(browser.result.acceptance,'failed');
assert.equal(browser.result.failure,'Browser timeout: product page after toolbox');
assert.equal(browser.result.image,fullImage);
assert.equal(browser.result.checks.length,9);
assert.equal(completion.result.prior_partial_receipt,browser.path);
assert.equal(completion.result.checks.length,2);
for(const key of ['blocked','exceptions','external'])assert.deepEqual(completion.result[key],[]);
assert.deepEqual(completion.result.toolboxMocks.map(row=>row.path).sort(),['/file','/folder']);
assert.equal(browser.result.captures.length, 10);
assert.equal(browser.result.geometries.length, 16);
for (const key of ['blocked', 'exceptions', 'external']) assert.deepEqual(browser.result[key], []);
assert.deepEqual(browser.result.toolboxMocks.map(row => row.path).sort(), ['/file', '/folder']);
assert.ok(browser.result.toolboxMocks.every(row => row.external_network === false));
assert.ok(browser.result.requests.every(row => ['GET', 'OPTIONS'].includes(row.method) || row.method === 'POST' && ['/login', '/logout'].includes(row.path)));
assert.equal(assets.result.assets.length, 47);
const state = snapshot();
assert.deepEqual(state.hashes, before.state.hashes);
assert.deepEqual(completion.result.final_state.hashes, state.hashes);
assert.deepEqual(footer.result.final_state.hashes,state.hashes);
assert.deepEqual(state.health_counts, before.state.health_counts);
assert.equal(state.counts.jobs, 2);
assert.equal(state.counts.audit_events, 49);

const php = `<?php
require '/var/www/vendor/autoload.php';$app=require '/var/www/bootstrap/app.php';$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
if(posix_geteuid()!==33||DB::connection()->getDriverName()!=='mysql')throw new RuntimeException('Refused');
DB::statement('SET TRANSACTION READ ONLY');DB::beginTransaction();try{$hashes=[];$counts=[];
foreach(['article_catalog_state','articles','article_versions','article_terms','article_term_versions','article_version_terms','article_publication_schedules','article_media_assets','article_version_media'] as $t){$rows=DB::table($t)->orderBy('id')->get();$hashes[$t]=hash('sha256',json_encode($rows,JSON_THROW_ON_ERROR));$counts[$t]=$rows->count();}
echo json_encode(['hashes'=>$hashes,'counts'=>$counts,'writes'=>0],JSON_THROW_ON_ERROR);}finally{DB::rollBack();}`;
const result = spawnSync('docker', ['exec', '-i', '--user', '33:33', '--workdir', '/var/www', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 30000 });
assert.equal(result.status, 0, 'Read-only content capture failed');
const content = JSON.parse(result.stdout);
assert.deepEqual(content, contentBefore.state);
const services = runtime();
assert.equal(services.filter(service => service.status === 'running').length, 11);
assert.equal(services.find(service => service.name === 'checkupino_prod-admin-1')?.image, image);
assert.equal(services.find(service => service.name === 'checkupino_prod-admin-1')?.health, 'healthy');
assert.deepEqual(services.filter(service => service.name !== 'checkupino_prod-admin-1'), before.runtime.filter(service => service.name !== 'checkupino_prod-admin-1'));
const tag = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', 'checkupino-admin:velzon-file-manager-accepted-2026-10-25'], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
assert.equal(tag.status, 0);
assert.equal(tag.stdout.trim(), image);
const files = [
  'frontend/src/pages/FileManager/FileManagerFrame.tsx',
  'frontend/src/pages/FileManager/EditorialFileManager.tsx',
  'frontend/src/pages/FileManager/FileManagerCharts.tsx',
  'frontend/src/pages/FileManager/index.tsx',
  'frontend/src/pages/FileManager/embedded-file-manager.css',
  'frontend/src/pages/Administration/content/ArticleFileManager.tsx',
  'frontend/src/locales/en.json', 'frontend/src/locales/fa.json',
  'frontend/src/test/ArticleMedia.test.tsx',
  'scripts/content/verify-velzon-file-manager.mjs',
  'scripts/content/verify-velzon-file-manager-static.mjs',
  'scripts/content/close-velzon-file-manager.mjs',
  'scripts/content/verify-velzon-file-manager-footer.mjs',
  'docs/deployment/velzon-file-manager-embedded-2026-10-25.md',
  'CURRENT_TASK.md', 'AI_BOOT.md', 'docs/ai-context/CONTINUE_PROMPT.md',
  'docs/ai-context/modules/admin-panel.md', 'docs/ai-context/modules/doctor-reports.md',
  'docs/TODO.md', 'docs/ai-context/TASK_LOG.md',
];
assert.equal(readFileSync('docs/ai-context/TASK_LOG.md', 'utf8').split('\n').length, 150);
const bindings = Object.fromEntries(files.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const receipt = { acceptance: 'passed', checked_at: new Date().toISOString(), image, static_receipt: assets.path, browser_partial_receipt: browser.path, browser_completion_receipt:completion.path, footer_receipt: footer.path, full_matrix_image: fullImage,
  source_and_doc_bindings: bindings, state, content, runtime: services, tests: { focused_frontend: 81, served_assets: 47, full_native_cohorts: 8, final_footer_cohorts: 8, native_groups: 20, captures: 18 },
  writes: 0, scope: 'Shared original Velzon frame/chart and real embedded media UI; current data preserved, no business writes, backend Compose, schema/dependency change, scanner restart or job processing. Only the original developer-page legacy GET collections are isolated fixtures; embedded article media uses actual local APIs.' };
const path = directory + 'velzon-file-manager-accepted-2026-10-25.json';
writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ acceptance: 'passed', evidence: path, image, counts: content.counts, audits: state.counts.audit_events, jobs: state.counts.jobs }));
