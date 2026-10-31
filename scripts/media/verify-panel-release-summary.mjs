import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

assert.equal(process.argv.length, 2, 'No runtime, account or evidence overrides accepted.');
const directory = 'docs/deployment/evidence/';
const target = directory + 'panel-release-acceptance-2026-10-17.json';
assert.ok(!existsSync(target), 'Inspect accepted evidence instead of overwriting.');
const read = name => JSON.parse(readFileSync(directory + name, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const staticProof = read('panel-release-security-static-2026-10-17.json');
const runtime = read('panel-release-security-runtime-2026-10-17.json');
const uiStatic = read('panel-release-ready-static-2026-10-17.json');
const pointer = read('panel-release-pointer-2026-10-17.json');
const quality = read('panel-release-session-quality-2026-10-17.json');
const access = read('panel-release-access-2026-10-17.json');
const smoke = read('panel-release-session-smoke-2026-10-17.json');
const initialQuality = read('panel-release-quality-initial-2026-10-17.json');
const medicalDelta = read('panel-release-medical-delta-2026-10-17.json');
const staff = read('staff-directory-acceptance-2026-10-16.json');
const recovery = read('doctor-slot-recovery-acceptance-2026-10-17.json');
for (const value of [staticProof, runtime, pointer, quality, medicalDelta, staff, recovery, access, smoke]) assert.equal(value.acceptance, 'passed');
assert.equal(medicalDelta.focused_gate.tests, 64);
for (const value of [quality, medicalDelta]) for (const [path, hash] of Object.entries(value.sources)) assert.equal(sha(path), hash, 'Source gate no longer matches.');
assert.equal(initialQuality.acceptance, 'failed');
assert.equal(quality.tests, 733); assert.equal(quality.files, 71); assert.equal(quality.exit_code, 0);
for (const binding of [quality.log, quality.full_suite, quality.full_suite.log]) assert.equal(sha(binding.path), binding.sha256, 'Quality evidence binding changed.');
const fullQuality = JSON.parse(readFileSync(quality.full_suite.path, 'utf8'));
for (const [path, hash] of Object.entries(fullQuality.sources)) {
  if (path === 'frontend/src/modules/checkupino/auth/history.test.ts') continue;
  assert.equal(sha(path), hash, 'Full-suite production or retained source changed.');
}
assert.equal(read('panel-release-static-2026-10-17.json').image, staff.image);
assert.equal(pointer.image, uiStatic.image);
assert.equal(access.image, staticProof.image); assert.equal(smoke.image, staticProof.image);
for (const proof of [access, smoke]) {
  assert.deepEqual(proof.baseline.hashes, pointer.baseline.hashes);
  assert.deepEqual(proof.final.hashes, pointer.final.hashes);
  assert.deepEqual(proof.baseline.catalog_hashes, proof.final.catalog_hashes);
  assert.deepEqual(proof.baseline.finance_hashes, proof.final.finance_hashes);
  for (const key of ['exceptions', 'external', 'blocked']) assert.deepEqual(proof[key], []);
  assert.ok(proof.responses.every(row => row.status < 500));
  assert.ok(proof.networkFailures.every(row => row.canceled));
}
assert.ok(access.historyEvents.some(row => row.type === 'pageshow' && row.persisted && row.path.endsWith('/medical') && row.rootPresent && row.rootHidden));
assert.ok(access.checks.some(text => text.startsWith('Actual persisted medical Back restore')));
assert.equal(smoke.releaseVisits.length, 16);
for (const id of [1, 2, 5, 4]) for (const lang of ['en', 'fa']) for (const width of [1440, 390]) assert.ok(smoke.releaseVisits.some(row => row.actor === `role-${id}-${lang}-${width}`));
assert.equal(runtime.admin_image, staticProof.image); assert.equal(staticProof.assets.length, 64);
assert.equal(runtime.checks.length, 31); assert.equal(runtime.guest.length, 11);
assert.deepEqual(pointer.baseline.hashes, pointer.final.hashes);
assert.deepEqual(pointer.baseline.hashes, runtime.baseline);
assert.deepEqual(pointer.baseline.catalog_hashes, pointer.final.catalog_hashes);
assert.deepEqual(pointer.baseline.finance_hashes, pointer.final.finance_hashes);
assert.deepEqual(runtime.baseline, runtime.final); assert.deepEqual(runtime.schedule_baseline, runtime.schedule_final);
assert.deepEqual(runtime.payment_history_before, runtime.payment_history_after);
assert.equal(pointer.baseline.status, 'completed'); assert.equal(pointer.final.status, 'completed');
assert.equal(pointer.phase, 'guest');
for (const key of ['exceptions', 'external', 'blocked']) assert.deepEqual(pointer[key], [], key);
assert.ok(pointer.networkFailures.every(row => row.canceled));
assert.equal(pointer.calendarLabels.length, 8);
assert.ok(pointer.responses.every(row => row.status < 500), 'Unexpected server failure.');
assert.ok(pointer.requests.every(row => ['GET', 'OPTIONS'].includes(row.method) || row.method === 'POST' && ['/login', '/logout'].includes(row.path)));
for (const role of ['admin-1', 'admin-2', 'clinical-5', 'clinical-4']) {
  for (const lang of ['en', 'fa']) for (const width of [1440, 390]) {
    assert.ok(pointer.releaseVisits.some(row => row.actor === `${role}-${lang}-${width}`), 'Missing role/language/viewport cohort.');
  }
}
assert.ok(pointer.checks.some(text => text.startsWith('Unassigned doctor cannot read')));
assert.ok(pointer.checks.some(text => text.startsWith('Guest clinical/editor deep links')));
assert.ok(pointer.geometryChecks.length >= 2);
for (const row of pointer.releaseVisits) {
  assert.ok(row.geometry.scrollWidth <= row.geometry.width + 1);
  assert.equal(row.geometry.dir, row.geometry.locale === 'fa' ? 'rtl' : 'ltr');
}
assert.ok(pointer.screenshots.length >= 50);
const contextPaths = ['CURRENT_TASK.md', 'docs/TODO.md', 'AI_BOOT.md', 'docs/ai-context/CONTINUE_PROMPT.md', 'docs/ai-context/modules/booking.md', 'docs/ai-context/modules/admin-panel.md', 'docs/ai-context/modules/auth.md', 'docs/ai-context/TASK_LOG.md'];
const changedPaths = ['frontend/src/pages/DashboardEcommerce/AppointmentCalendar.tsx', 'frontend/src/test/AppointmentCalendar.test.tsx', 'frontend/src/pages/Medical/MedicalFiles.tsx', 'frontend/src/index.tsx', 'frontend/src/modules/checkupino/auth/history.ts', 'frontend/src/modules/checkupino/auth/history.test.ts'];
let retainedSources = 0;
for (const [path, hash] of Object.entries(staff.sources)) {
  if (contextPaths.includes(path) || changedPaths.includes(path)) continue;
  assert.equal(sha(path), hash, 'Unrelated accepted source changed: ' + path); retainedSources++;
}
assert.equal(retainedSources, 157);
for (const [path, hash] of Object.entries(staff.evidence)) assert.equal(sha(path), hash, 'Prior immutable evidence changed.');
for (const [path, hash] of Object.entries(recovery.runtime_and_protected_sources_verified)) assert.equal(sha(path), hash, 'Doctor recovery binding changed.');
const execute = args => {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(result.status, 0, 'Read-only final runtime inspection failed.'); return result.stdout;
};
const containers = JSON.parse(execute(['inspect', ...runtime.containers.map(row => row.name.slice(1))]));
const running = containers.filter(row => row.State.Running).map(row => row.Name.slice(1)).sort();
assert.equal(running.length, 9);
for (const name of ['checkupino_app', 'checkupino_nginx', 'checkupino_db', 'checkupino_redis']) assert.ok(running.includes(name));
for (const name of ['checkupino_scan-scanner-1', 'checkupino_scan-scan-check-1', 'checkupino_scan-scan-worker-1', 'checkupino_content-content-parser-1']) assert.ok(!running.includes(name));
const app = containers.find(row => row.Name === '/checkupino_app');
assert.equal(app.Image, 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
for (const [name, destination] of [['checkupino_content_socket', '/run/medical-content'], ['checkupino_scan_scan_socket', '/run/medical-scan']]) assert.ok(app.Mounts.some(m => m.Name === name && m.Destination === destination && !m.RW));
const admin = containers.find(row => row.Name === '/checkupino_prod-admin-1');
assert.equal(admin.Image, staticProof.image); assert.equal(admin.State.Health.Status, 'healthy');
const acceptedTag = 'checkupino-admin:panel-release-accepted-2026-10-17';
assert.equal(execute(['image', 'inspect', '--format', '{{.Id}}', acceptedTag]).trim(), staticProof.image, 'Accepted retained image tag changed.');
assert.equal(execute(['ps', '-a', '--filter', 'label=com.docker.compose.project=checkupino_schedule_acceptance', '--format', '{{.Names}}']).trim(), '');
assert.equal(execute(['network', 'ls', '--filter', 'label=com.docker.compose.project=checkupino_schedule_acceptance', '--format', '{{.Name}}']).trim(), '');
const failures = readdirSync(directory).filter(name => /^panel-release-pointer-2026-10-17-failed-\d+\.json$/.test(name));
const extraRecords = readdirSync(directory).filter(name => /^(?:panel-release-quality-2026-10-17-failed-\d+|panel-release-session-quality-2026-10-17-failed-\d+|panel-release-access-2026-10-17-failed-\d+|panel-medical-layout-probe-2026-10-17-failed-\d+)\.json$/.test(name));
const evidenceNames = ['panel-release-static-2026-10-17.json', 'panel-release-runtime-2026-10-17.json', 'panel-release-final-static-2026-10-17.json', 'panel-release-final-runtime-2026-10-17.json', 'panel-release-ready-static-2026-10-17.json', 'panel-release-ready-runtime-2026-10-17.json', 'panel-release-security-static-2026-10-17.json', 'panel-release-security-runtime-2026-10-17.json', 'panel-release-session-quality-2026-10-17.json', 'panel-release-access-2026-10-17.json', 'panel-release-session-smoke-2026-10-17.json', 'panel-release-pointer-2026-10-17.json', 'panel-release-quality-2026-10-17.json', 'panel-release-quality-initial-2026-10-17.json', 'panel-release-observed-defect-2026-10-17.json', 'panel-release-medical-delta-2026-10-17.json', 'panel-medical-layout-probe-2026-10-17.json', 'staff-directory-acceptance-2026-10-16.json', 'doctor-slot-recovery-acceptance-2026-10-17.json', ...failures, ...extraRecords];
const sourcePaths = ['scripts/media/verify-panel-release-static.mjs', 'scripts/media/verify-panel-release-runtime.mjs', 'scripts/media/verify-panel-release-final-static.mjs', 'scripts/media/verify-panel-release-final-runtime.mjs', 'scripts/media/verify-panel-release-security-static.mjs', 'scripts/media/verify-panel-release-security-runtime.mjs', 'scripts/media/verify-panel-release-pointer.mjs', 'scripts/media/verify-panel-release-access.mjs', 'scripts/media/verify-panel-release-session-smoke.mjs', 'scripts/media/verify-panel-release-summary.mjs', 'docs/deployment/panel-release-rehearsal-2026-10-17.md', ...contextPaths, ...changedPaths];
evidenceNames.push('panel-release-summary-count-correction-2026-10-17.json');
const logLines = readFileSync('docs/ai-context/TASK_LOG.md', 'utf8').split('\n').length;
assert.equal(logLines, 150);
const proof = {
  acceptance: 'passed', checked_at: new Date().toISOString(), image: staticProof.image, retained_image_tag: acceptedTag,
  acceptance_scope: 'Integrated current demo/admin source, served artifact and read-only presentation acceptance.',
  frontend_quality: { files: quality.files, tests: quality.tests, unchanged_default_timeouts: true, initial_failure_retained: true, post_layout_delta_tests: 64, current_history_tests: 5, full_suite_and_typed_mock_delta_bound_separately: true },
  served_assets: 64, uid33_runtime_checks: 31, guest_refusals: 11,
  completed_page_checks: pointer.releaseVisits.length, browser_groups: pointer.checks.length,
  explicit_api_checks: pointer.apiChecks.length, browser_requests: pointer.requests.length,
  ui_matrix_image: pointer.image, final_smoke_cohorts: 16, final_access_groups: access.checks.length,
  final_smoke_groups: smoke.checks.length, final_candidate_requests: access.requests.length + smoke.requests.length,
  screenshots: pointer.screenshots.length + smoke.screenshots.length, mirror_cases: pointer.geometryChecks.length,
  roles: ['root-admin', 'admin', 'doctor', 'patient'], additional_checks: ['unassigned-doctor', 'guest'],
  languages: ['en', 'fa'], viewport_widths: [1440, 390],
  business_financial_catalog_schedule_and_protected_fingerprints_preserved: true,
  unexpected_js_errors: 0, unexpected_server_errors: 0, external_requests: 0, blocked_business_attempts: 0,
  live_business_writes: 0, password_confirmations: 0, clinical_downloads: 0, jobs_consumed: 0,
  app_readonly_sockets_preserved: true, helpers_remain_stopped: true, running_services: running,
  disposable_test_project_absent: true, operator_retains_backend_compose_ownership: true,
  backend_source_changed: false, frontend_source_changed: true, intentional_source_changes: changedPaths,
  static_admin_only_rebuilt: true, responsive_farsi_weekday_overflow_fixed: true,
  file_manager_report_overflow_fixed: true, plain_text_report_direction_auto: true,
  actual_persisted_restore_hidden_before_revalidation: true, logout_browser_back_refuses_cached_private_screen: true,
  earlier_ui_images_are_not_session_history_privacy_acceptance: true,
  unrelated_retained_source_bindings: retainedSources, immutable_prior_evidence_bindings: Object.keys(staff.evidence).length,
  evidence: Object.fromEntries(evidenceNames.map(name => [directory + name, sha(directory + name)])),
  screenshots_sha256: Object.fromEntries([...pointer.screenshots, ...smoke.screenshots].map(path => [path, sha(path)])),
  sources: Object.fromEntries(sourcePaths.map(path => [path, sha(path)])), task_log_physical_lines: logLines,
  separate_open_gates: ['successful_live_admin_mutations', 'verified_download_audit', 'personally_deferred_profile_save', 'fresh_scanner_and_exact_file_job_delivery', 'real_provider_refund_policy_and_execution', 'production_and_real_patient_readiness'],
};
writeFileSync(target, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ acceptance: proof.acceptance, pages: proof.completed_page_checks, browser_groups: proof.browser_groups, requests: proof.browser_requests, screenshots: proof.screenshots, tests: quality.tests, live_business_writes: 0 }));
