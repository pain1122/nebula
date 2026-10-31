import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

assert.equal(process.argv.length, 2, 'No account/runtime/evidence overrides accepted.');
const directory = 'docs/deployment/evidence/';
const target = directory + 'clinical-experience-acceptance-2026-10-17.json';
assert.ok(!existsSync(target), 'Inspect accepted evidence instead of overwriting.');
const json = name => JSON.parse(readFileSync(directory + name, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const prior = json('panel-release-acceptance-2026-10-17.json');
const staff = json('staff-directory-acceptance-2026-10-16.json');
const staticProof = json('clinical-experience-static-accepted-2026-10-17.json');
const full = json('clinical-experience-browser-2026-10-17.json');
const final = json('clinical-experience-browser-final-2026-10-17.json');
const checkpoint = json('clinical-experience-pre-browser-2026-10-17.json');
for (const proof of [prior, staticProof, full, final]) assert.equal(proof.acceptance, 'passed');
assert.equal(staticProof.assets.length, 65);
assert.equal(final.image, staticProof.image);
assert.equal(full.checks.filter(s => s.startsWith('Own dashboard/current identity')).length, 16);
assert.equal(final.checks.filter(s => s.startsWith('Own dashboard/current identity')).length, 4);
for (const proof of [full, final]) {
  for (const key of ['hashes', 'catalog_hashes', 'finance_hashes']) {
    assert.deepEqual(proof.baseline[key], checkpoint.snapshot[key]);
    assert.deepEqual(proof.final[key], checkpoint.snapshot[key]);
  }
  for (const key of ['exceptions', 'external', 'blocked']) assert.deepEqual(proof[key], []);
  assert.ok(proof.responses.every(row => row.status < 500));
  assert.ok(proof.networkFailures.every(row => row.canceled));
  assert.ok(proof.requests.every(row => ['GET', 'OPTIONS'].includes(row.method) || row.method === 'POST' && ['/login', '/logout'].includes(row.path)));
}
for (const key of ['protected', 'reservation_reports', 'setting_values', 'target_stable']) assert.equal(checkpoint.historical_whole_table_matches[key], true);
assert.equal(checkpoint.historical_audit_records_preserved, true);
assert.equal(checkpoint.historical_outbox_records_preserved, true);
const quality = readFileSync(directory + 'clinical-experience-quality-fixed-2026-10-17.log', 'utf8');
assert.match(quality, /Test Files\s+72 passed/); assert.match(quality, /Tests\s+740 passed/);
assert.ok(quality.includes('Quality ratchets pass:')); assert.ok(quality.includes('All matched files use Prettier code style!'));
for (const [name, count] of [['clinical-experience-final-delta-2026-10-17.json', 83], ['clinical-experience-layout-delta-2026-10-17.json', 19]]) {
  const result = json(name); assert.equal(result.numPassedTests, count); assert.equal(result.numFailedTests, 0);
}
const phpBuffer = readFileSync(directory + 'clinical-experience-backend-2026-10-17.log');
const phpLog = phpBuffer.toString(phpBuffer[0] === 255 && phpBuffer[1] === 254 ? 'utf16le' : 'utf8');
assert.match(phpLog, /37 passed \(242 assertions\)/);
const dependencies = json('panel-release-session-quality-2026-10-17.json');
for (const path of ['frontend/package.json', 'frontend/package-lock.json', 'frontend/vite.config.ts']) assert.equal(sha(path), dependencies.sources[path]);
for (const path of ['frontend/src/index.tsx', 'frontend/src/modules/checkupino/auth/history.ts', 'frontend/src/modules/checkupino/auth/history.test.ts']) assert.equal(sha(path), prior.sources[path]);

const featurePaths = [
  'app/Services/MedicalAttachmentPolicy.php', 'app/Http/Requests/Doctor/StoreReservationMedicalRequest.php', 'app/Http/Controllers/Api/DoctorMedicalRequestController.php', 'routes/api.php', 'tests/Feature/Api/ReservationMedicalRequestApiTest.php',
  'frontend/src/pages/DashboardEcommerce/ClinicalDashboard.tsx', 'frontend/src/pages/DashboardEcommerce/ProductDashboard.tsx', 'frontend/src/pages/Booking/PatientBooking.tsx',
  'frontend/src/pages/Questionnaire/PatientQuestionnaire.tsx', 'frontend/src/pages/Questionnaire/QuestionnaireWorkspace.tsx', 'frontend/src/pages/Users/UserProfile.tsx', 'frontend/src/pages/Users/ProfileNameForm.tsx',
  'frontend/src/pages/Medical/MedicalFiles.tsx', 'frontend/src/pages/Medical/DoctorRequestModal.tsx', 'frontend/src/pages/Medical/PatientUploadModal.tsx',
  'frontend/src/modules/checkupino/medical/writeTypes.ts', 'frontend/src/modules/checkupino/medical/writes.ts', 'frontend/src/modules/checkupino/questionnaire/api.ts', 'frontend/src/modules/checkupino/manifest.ts', 'frontend/src/modules/checkupino/auth/panel.ts',
  'frontend/src/panel/registry.ts', 'frontend/src/locales/en.json', 'frontend/src/locales/fa.json',
  'frontend/src/test/ClinicalExperience.test.tsx', 'frontend/src/test/MedicalFiles.test.tsx', 'frontend/src/test/UserProfile.test.tsx', 'frontend/src/test/PatientQuestionnaire.test.tsx', 'frontend/src/test/ProductDashboard.test.tsx', 'frontend/src/test/productRegistry.test.ts',
  'frontend/src/modules/checkupino/auth/authority.test.ts', 'frontend/src/Routes/RouterContract.test.tsx', 'frontend/src/Routes/AuthProtected.test.tsx',
];
const contextPaths = ['CURRENT_TASK.md', 'AI_BOOT.md', 'docs/TODO.md', 'docs/ai-context/CONTINUE_PROMPT.md', 'docs/ai-context/TASK_LOG.md', 'docs/ai-context/modules/admin-panel.md', 'docs/ai-context/modules/auth.md', 'docs/ai-context/modules/doctor-reports.md', 'docs/ai-context/modules/booking.md', 'docs/deployment/clinical-experience-2026-10-17.md'];
const scriptPaths = ['scripts/media/verify-clinical-experience-static.mjs', 'scripts/media/verify-clinical-experience-static-accepted.mjs', 'scripts/media/verify-clinical-experience-browser.mjs', 'scripts/media/verify-clinical-experience-browser-final.mjs', 'scripts/media/clinical-experience-browser-cases.mjs', 'scripts/media/verify-clinical-experience-summary.mjs'];
let unchangedSources = 0;
for (const [path, hash] of Object.entries(staff.sources)) {
  if (featurePaths.includes(path) || contextPaths.includes(path)) continue;
  assert.equal(sha(path), prior.sources[path] ?? hash, 'Unrelated accepted source changed: ' + path); unchangedSources++;
}
for (const proof of [prior, staff]) for (const [path, hash] of Object.entries(proof.evidence)) assert.equal(sha(path), hash, 'Historical evidence changed: ' + path);
for (const [path, hash] of Object.entries(prior.screenshots_sha256)) assert.equal(sha(path), hash, 'Historical capture changed.');
const docker = args => { const r = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 20000 }); assert.equal(r.status, 0, 'Read-only Docker inspection failed.'); return r.stdout.trim(); };
const runtime = json('panel-release-security-runtime-2026-10-17.json');
const containers = JSON.parse(docker(['inspect', ...runtime.containers.map(row => row.name.slice(1))]));
const running = containers.filter(row => row.State.Running).map(row => row.Name.slice(1)).sort(); assert.equal(running.length, 9);
for (const name of ['checkupino_app', 'checkupino_nginx', 'checkupino_db', 'checkupino_redis', 'checkupino_prod-admin-1']) assert.ok(running.includes(name));
for (const name of ['checkupino_scan-scanner-1', 'checkupino_scan-scan-check-1', 'checkupino_scan-scan-worker-1', 'checkupino_content-content-parser-1']) assert.ok(!running.includes(name));
const app = containers.find(row => row.Name === '/checkupino_app'); assert.equal(app.Image, 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
for (const [name, destination] of [['checkupino_content_socket', '/run/medical-content'], ['checkupino_scan_scan_socket', '/run/medical-scan']]) assert.ok(app.Mounts.some(row => row.Name === name && row.Destination === destination && !row.RW));
const admin = containers.find(row => row.Name === '/checkupino_prod-admin-1'); assert.equal(admin.Image, staticProof.image); assert.equal(admin.State.Health.Status, 'healthy');
const tag = 'checkupino-admin:clinical-experience-accepted-2026-10-17';
assert.equal(docker(['image', 'inspect', '--format', '{{.Id}}', tag]), staticProof.image);
assert.equal(docker(['image', 'inspect', '--format', '{{.Id}}', 'checkupino-admin:panel-release-accepted-2026-10-17']), prior.image);
assert.equal(docker(['ps', '-a', '--filter', 'label=com.docker.compose.project=checkupino_schedule_acceptance', '--format', '{{.Names}}']), '');
const browserSource = readFileSync('scripts/media/verify-clinical-experience-browser-final.mjs', 'utf8');
const prefix = ' const php = ', start = browserSource.indexOf(prefix) + prefix.length, end = browserSource.indexOf('\n const result=spawnSync', start);
assert.ok(start >= prefix.length && end > start);
const php = Function('return ' + browserSource.slice(start, end).trim())();
const latest = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 30000 });
assert.equal(latest.status, 0, 'Current read-only data recheck failed.');
const snapshot = JSON.parse(latest.stdout);
for (const key of ['hashes', 'catalog_hashes', 'finance_hashes']) assert.deepEqual(snapshot[key], final.final[key]);
const evidenceNames = readdirSync(directory).filter(name => /^clinical-experience-.*\.(?:json|log)$/.test(name));
const logLines = readFileSync('docs/ai-context/TASK_LOG.md', 'utf8').split('\n').length; assert.equal(logLines, 150);
const proof = {
  acceptance: 'passed', checked_at: new Date().toISOString(), image: staticProof.image, retained_image_tag: tag,
  scope: 'User-requested clinical dashboards, booking/questionnaire presentation, profile modal and server-owned attachment-category/RTL changes; isolated behavior and deployed read-only acceptance.',
  frontend: { full_files: 72, full_tests: 740, affected_behavior_tests: 83, final_layout_tests: 19, full_suite_and_later_deltas_are_separate: true, dependency_and_timeout_settings_unchanged: true },
  backend: { isolated_tests: 37, assertions: 242, sqlite_memory: true, uid33: true, separate_temporary_storage: true },
  full_matrix: { image: full.image, cohorts: 16, groups: full.checks.length, requests: full.requests.length, captures: full.screenshots.length },
  final_patient_delta: { image: final.image, cohorts: 4, groups: final.checks.length, requests: final.requests.length, captures: final.screenshots.length, only_embedded_questionnaire_markup_changed_after_full_matrix: true },
  served_assets: staticProof.assets.length, business_writes: 0, password_confirmations: 0, downloads: 0, jobs_consumed: 0,
  current_manual_rehearsal_inventory: { reservations: 9, medical_requests: 3, files: 4, reports: 2, medical_scan_jobs: 2, questionnaire_submissions: 2, audits: 30, outbox: 8 },
  current_before_after_fingerprints_preserved: true, historical_reports_settings_protected_audits_outbox_preserved: true,
  pending_jobs_must_not_be_drained_to_match_old_checkpoints: true, unchanged_session_history_guard: true,
  running_services: running, helpers_stopped: true, app_image_and_readonly_sockets_preserved: true, backend_compose_ownership_remains_operator: true,
  unrelated_source_bindings_verified_against_latest_accepted_baseline: unchangedSources, prior_staff_evidence_bindings_verified: Object.keys(staff.evidence).length,
  sources: Object.fromEntries([...featurePaths, ...contextPaths, ...scriptPaths].map(path => [path, sha(path)])),
  evidence: Object.fromEntries(evidenceNames.map(name => [directory + name, sha(directory + name)])),
  captures: Object.fromEntries([...full.screenshots, ...final.screenshots].map(path => [path, sha(path)])),
  task_log_physical_lines: logLines,
  separate_gates: ['current_scanner_parser_and_continuous_dedicated_worker', 'exact_authorized_pending_file_job_delivery', 'safe_archive_audio_video_and_large_media', 'thumbnail_upload_processing_publication', 'personally_deferred_successful_profile_save', 'successful_live_admin_mutations_and_download_audit'],
};
writeFileSync(target, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ acceptance: proof.acceptance, image: proof.image, full_tests: 740, backend_tests: 37, native_groups: full.checks.length + final.checks.length, screenshots: proof.full_matrix.captures + proof.final_patient_delta.captures, jobs_consumed: 0, retained_unrelated_sources: unchangedSources }));
