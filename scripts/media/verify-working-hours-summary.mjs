import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

assert.equal(process.argv.length, 2, 'No overrides accepted.');
const directory = 'docs/deployment/evidence/';
const target = directory + 'working-hours-acceptance-2026-10-18.json';
assert.ok(!existsSync(target), 'Accepted evidence must not be replayed.');
const json = name => JSON.parse(readFileSync(directory + name, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const log = name => {
  const bytes = readFileSync(directory + name);
  return bytes[0] === 255 && bytes[1] === 254 ? bytes.toString('utf16le') : bytes.toString('utf8');
};
const docker = args => {
  const run = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 20000 });
  assert.equal(run.status, 0, 'Read-only runtime inspection failed.');
  return run.stdout;
};
const prior = json('doctor-panel-acceptance-2026-10-18.json');
const first = json('working-hours-browser-2026-10-18.json');
const browser = json('working-hours-final-browser-2026-10-18.json');
const assets = json('working-hours-final-static-2026-10-18.json');
for (const proof of [prior, first, browser, assets]) assert.equal(proof.acceptance, 'passed');
assert.equal(browser.image, assets.image);
for (const proof of [first, browser]) {
  assert.deepEqual(proof.baseline.hashes, proof.final.hashes);
  assert.deepEqual(proof.baseline.catalog_hashes, proof.final.catalog_hashes);
  assert.deepEqual(proof.baseline.finance_hashes, proof.final.finance_hashes);
  assert.equal(proof.blocked.length, 0);
  assert.equal(proof.exceptions.length, 0);
  assert.equal(proof.external.length, 0);
  assert.ok(proof.requests.every(r => ['GET', 'OPTIONS'].includes(r.method) || ['POST'].includes(r.method) && ['/login', '/logout'].includes(r.path)));
}
assert.deepEqual(first.baseline.hashes, browser.baseline.hashes);
assert.deepEqual(first.baseline.catalog_hashes, browser.baseline.catalog_hashes);
assert.deepEqual(first.baseline.finance_hashes, browser.baseline.finance_hashes);
assert.equal(browser.checks.length, 9);
assert.equal(browser.screenshots.length, 24);
const source = json('working-hours-source-delta-2026-10-18.json');
const layout = json('working-hours-layout-delta-2026-10-18.json');
for (const proof of [source, layout]) {
  assert.equal(proof.success, true);
  assert.equal(proof.numFailedTestSuites, 0);
  assert.equal(proof.numFailedTests, 0);
  assert.ok(proof.testResults.every(suite => suite.status === 'passed'));
}
assert.equal(source.numPassedTests, 29);
assert.equal(layout.numPassedTests, 34);
assert.match(log('working-hours-quality-2026-10-18.log'), /75 passed \(75\)/);
assert.match(log('working-hours-quality-2026-10-18.log'), /777 passed \(777\)/);
assert.match(log('working-hours-quality-2026-10-18.log'), /All matched files use Prettier code style/);
assert.match(log('working-hours-backend-2026-10-18.log'), /9 passed \(92 assertions\)/);
assert.match(log('working-hours-backend-final-delta-2026-10-18.log'), /1 passed/);

const features = [
  'frontend/src/pages/Users/DoctorPractice.tsx', 'frontend/src/pages/Users/WorkingHoursEditor.tsx',
  'frontend/src/modules/checkupino/profiles/workingHours.ts', 'frontend/src/modules/checkupino/profiles/workingHours.test.ts',
  'frontend/src/modules/checkupino/overlays/Overlay.tsx', 'frontend/src/modules/checkupino/overlays/Overlay.test.tsx',
  'frontend/src/test/DoctorPractice.test.tsx', 'frontend/src/locales/en.json', 'frontend/src/locales/fa.json',
  'tests/Feature/Api/DoctorPanelExperienceTest.php',
];
const contexts = ['CURRENT_TASK.md', 'AI_BOOT.md', 'docs/TODO.md', 'docs/ai-context/CONTINUE_PROMPT.md',
  'docs/ai-context/TASK_LOG.md', 'docs/ai-context/modules/admin-panel.md', 'docs/ai-context/modules/booking.md',
  'docs/ai-context/modules/doctor-reports.md', 'docs/deployment/doctor-working-hours-2026-10-18.md'];
const scripts = ['scripts/media/verify-working-hours-static.mjs', 'scripts/media/verify-working-hours-browser.mjs',
  'scripts/media/working-hours-browser-cases.mjs', 'scripts/media/verify-working-hours-final-static.mjs',
  'scripts/media/verify-working-hours-final-browser.mjs', 'scripts/media/working-hours-final-browser-cases.mjs',
  'scripts/media/verify-working-hours-summary.mjs'];
const changed = new Set([...features, ...contexts]);
let retainedSources = 0, retainedEvidence = 0;
for (const [path, hash] of Object.entries(prior.sources)) {
  if (!changed.has(path)) { assert.equal(sha(path), hash, 'Unrelated source changed: ' + path); retainedSources++; }
}
for (const group of [prior.evidence, prior.captures, prior.superseded_captures]) {
  for (const [path, hash] of Object.entries(group)) { assert.equal(sha(path), hash, 'Historical artifact changed: ' + path); retainedEvidence++; }
}
assert.equal(readFileSync('docs/ai-context/TASK_LOG.md', 'utf8').split('\n').length, 150);
const admin = JSON.parse(docker(['inspect', 'checkupino_prod-admin-1']))[0];
assert.equal(admin.Image, assets.image);
assert.equal(admin.State.Health.Status, 'healthy');
assert.equal(JSON.parse(docker(['image', 'inspect', 'checkupino-admin:working-hours-accepted-2026-10-18']))[0].Id, assets.image);
assert.equal(JSON.parse(docker(['image', 'inspect', 'checkupino-admin:doctor-panel-accepted-2026-10-18']))[0].Id, prior.image);
const app = JSON.parse(docker(['inspect', 'checkupino_app']))[0];
assert.equal(app.Image, 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
for (const destination of ['/run/medical-content', '/run/medical-scan']) assert.ok(app.Mounts.some(m => m.Destination === destination && m.RW === false));
const running = docker(['ps', '--format', '{{.Names}}']).trim().split(/\r?\n/).filter(name => name.startsWith('checkupino')).sort();
assert.equal(running.length, 9);
for (const name of ['checkupino_scan-scanner-1', 'checkupino_scan-scan-check-1', 'checkupino_scan-scan-worker-1', 'checkupino_content-content-parser-1']) {
  assert.equal(JSON.parse(docker(['inspect', name]))[0].State.Running, false);
}
assert.equal(docker(['ps', '--all', '--filter', 'label=com.docker.compose.project=checkupino_schedule_acceptance', '--format', '{{.Names}}']).trim(), '');
const evidenceNames = ['working-hours-quality-2026-10-18.log', 'working-hours-source-delta-2026-10-18.json',
  'working-hours-layout-delta-2026-10-18.json', 'working-hours-backend-2026-10-18.log', 'working-hours-backend-final-delta-2026-10-18.log',
  'working-hours-admin-build-2026-10-18.log', 'working-hours-final-admin-build-2026-10-18.log',
  'working-hours-static-2026-10-18.json', 'working-hours-final-static-2026-10-18.json',
  'working-hours-browser-2026-10-18.json', 'working-hours-final-browser-2026-10-18.json',
  'doctor-panel-acceptance-2026-10-18.json'];
const result = {
  acceptance: 'passed', checked_at: new Date().toISOString(), image: assets.image,
  retained_image_tag: 'checkupino-admin:working-hours-accepted-2026-10-18', rollback_image: prior.image,
  frontend: { full_files: 75, full_tests: 777, source_delta_tests: 29, final_layout_delta_tests: 34 },
  backend: { tests: 9, assertions: 92, final_materialization_delta: 'passed' },
  native: { cohorts: 8, groups: browser.checks.length, requests: browser.requests.length, captures: browser.screenshots.length },
  first_native: { image: first.image, groups: first.checks.length, captures: first.screenshots.length },
  runtime: running, unrelated_source_bindings_preserved: retainedSources, historical_artifacts_preserved: retainedEvidence,
  data_and_protected_fingerprints_preserved: true, business_writes: 0, password_confirmations: 0, jobs_consumed: 0,
  helpers_stopped: true, app_image_and_readonly_sockets_preserved: true, task_log_physical_lines: 150,
  sources: Object.fromEntries([...features, ...contexts, ...scripts].map(path => [path, sha(path)])),
  evidence: Object.fromEntries(evidenceNames.map(name => [directory + name, sha(directory + name)])),
  captures: Object.fromEntries(browser.screenshots.map(path => [path, sha(path)])),
  scope: 'Doctor own weekly shift/rest/service editor at existing profile, compiled into existing service rules. No live schedule replacement, dependency, schema, URL, backend Compose, scanner or queue action. Native drafts canceled; positive persistence/materialization isolated in SQLite. Existing short stored rules remain faithful until an ordinary reviewed save. New writer live/MySQL acceptance remains separate.',
};
writeFileSync(target, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ acceptance: result.acceptance, image: result.image, native: result.native, retained_sources: retainedSources, historical_artifacts: retainedEvidence }));
