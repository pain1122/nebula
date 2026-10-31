import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assessReadiness, cooldownFromLogs, selectAcceptedDemoArtifact } from './check-demo-readiness.mjs';

const fixture = overrides => ({
  now: '2026-10-11T19:00:00Z', cooldownUntil: '2026-10-11T18:16:52Z',
  storyVerified: true, scannerRunning: true, scannerHealthy: true,
  probe: { clean_and_eicar: true, content_valid: true, scanner: {
    scanner_engine: 'clamav', scanner_version: '1.5.4', scanner_database_version: '28150',
    scanner_database_updated_at: '2026-10-11T06:00:00Z',
  } }, ...overrides,
});

const candidateChain = overrides => ({
  deployedImage: 'new-verified-ui',
  legacyArtifact: { acceptance: 'passed', image: 'accepted-rollback' },
  successorArtifact: { acceptance: 'passed', image: 'new-verified-ui', assets: [{ path: '/panel/assets/entry.js', sha256: 'reviewed' }] },
  adminRehearsal: { acceptance: 'passed', image: 'new-verified-ui', checks: Array(11).fill('bounded read group'), baseline: { hashes: { immutable: 'original-checkpoint' } }, final: { hashes: { immutable: 'original-checkpoint' } } },
  clinicalHashes: { immutable: 'original-checkpoint' },
  ...overrides,
});
test('retained original UI stays usable for history rollback without claiming new admin coverage', () => {
  const chain = candidateChain({ deployedImage: 'accepted-rollback', successorArtifact: null, adminRehearsal: null });
  assert.deepEqual(selectAcceptedDemoArtifact(chain), { artifact: chain.legacyArtifact, adminReservationReady: false });
});
test('new admin UI requires served evidence and the same accepted immutable clinical checkpoint', () => {
  const chain = candidateChain();
  assert.deepEqual(selectAcceptedDemoArtifact(chain), { artifact: chain.successorArtifact, adminReservationReady: true });
});
test('unknown, unaccepted and unrehearsed UI candidates fail closed', () => {
  for (const overrides of [{ deployedImage: 'unreviewed' }, { successorArtifact: null }, { adminRehearsal: null }, { legacyArtifact: { acceptance: 'failed' } }, { successorArtifact: { acceptance: 'failed', image: 'new-verified-ui' } }]) {
    assert.throws(() => selectAcceptedDemoArtifact(candidateChain(overrides)));
  }
  const chain = candidateChain();
  for (const rehearsal of [{ ...chain.adminRehearsal, image: 'different-ui' }, { ...chain.adminRehearsal, acceptance: 'failed' }, { ...chain.adminRehearsal, checks: [] }, { ...chain.adminRehearsal, baseline: { hashes: { immutable: 'changed' } } }, { ...chain.adminRehearsal, final: { hashes: { immutable: 'changed' } } }]) {
    assert.throws(() => selectAcceptedDemoArtifact(candidateChain({ adminRehearsal: rehearsal })));
  }
});
test('successor asset manifests stay bounded and unique', () => {
  const chain = candidateChain();
  for (const assets of [[], Array(81).fill({ path: '/panel/assets/entry.js' }), [{ path: '/panel/assets/entry.js' }, { path: '/panel/assets/entry.js' }]]) {
    assert.throws(() => selectAcceptedDemoArtifact(candidateChain({ successorArtifact: { ...chain.successorArtifact, assets } })));
  }
});
test('current stopped scanner leaves the preserved history available, never new upload ready', () => {
  const status = assessReadiness(fixture({ now: '2026-10-11T11:00:00Z', scannerRunning: false, scannerHealthy: false, probe: null }));
  assert.equal(status.existing_history_ready, true); assert.equal(status.fresh_pipeline_ready, false);
  assert.equal(status.fresh_upload_demo_ready, false);
  assert.deepEqual(status.scanner_blockers, ['definition_cooldown_active', 'scanner_stopped', 'current_real_scanner_probe_required']);
  assert.match(status.cooldown_until_tehran, /21:46:52/);
});
test('cooldown boundary is closed even with otherwise passing real probes', () => {
  assert.equal(assessReadiness(fixture({ now: '2026-10-11T18:16:52Z' })).fresh_pipeline_ready, false);
  assert.equal(assessReadiness(fixture({ now: '2026-10-11T18:16:53Z' })).fresh_pipeline_ready, true);
});
test('health or historical evidence cannot replace an actual probe in this invocation', () => {
  assert.equal(assessReadiness(fixture({ probe: null })).fresh_pipeline_ready, false);
  assert.equal(assessReadiness(fixture({ scannerHealthy: false })).fresh_pipeline_ready, false);
  assert.equal(assessReadiness(fixture({ storyVerified: undefined })).existing_history_ready, false);
});
test('a clean-only, wrong-engine, missing-parser or malformed probe fails closed', () => {
  const base = fixture();
  for (const patch of [{ clean_and_eicar: false }, { content_valid: false },
    { scanner: { ...base.probe.scanner, scanner_version: '1.5.3' } },
    { scanner: { ...base.probe.scanner, scanner_database_version: '' } },
    { scanner: { ...base.probe.scanner, scanner_database_updated_at: 'unknown' } }])
    assert.equal(assessReadiness(fixture({ probe: { ...base.probe, ...patch } })).fresh_pipeline_ready, false);
});
test('48-hour age and future-clock tolerance match the scanner contract', () => {
  const base = fixture({ now: '2026-10-13T06:00:00Z' });
  assert.equal(assessReadiness(base).fresh_pipeline_ready, true);
  assert.equal(assessReadiness({ ...base, now: '2026-10-13T06:00:01Z' }).fresh_pipeline_ready, false);
  const probe = fixture().probe;
  probe.scanner.scanner_database_updated_at = '2026-10-11T19:05:00Z';
  assert.equal(assessReadiness(fixture({ probe })).fresh_pipeline_ready, true);
  probe.scanner.scanner_database_updated_at = '2026-10-11T19:05:01Z';
  assert.equal(assessReadiness(fixture({ probe })).fresh_pipeline_ready, false);
});
test('passing pipeline never grants exact-job delivery or full fresh-upload acceptance', () => {
  const status = assessReadiness(fixture());
  assert.equal(status.fresh_pipeline_ready, true); assert.equal(status.fresh_upload_demo_ready, false);
  assert.equal(status.delivery_gate, 'new_authorized_file_and_exact_encrypted_job_binding_required');
});
test('invalid clocks fail instead of silently treating cooldown or freshness as elapsed', () => {
  assert.throws(() => assessReadiness(fixture({ now: 'unknown' })));
  assert.throws(() => assessReadiness(fixture({ cooldownUntil: 'unknown' })));
});
test('latest cooldown wins, old/missing logs never shorten the documented floor', () => {
  const log = 'WARNING: You are still on cool-down until after: 2026-10-08 17:07:34\n'
    + 'WARNING: You are still on cool-down until after: 2026-10-12 18:20:00\n'
    + 'WARNING: You are still on cool-down until after: 2026-10-11 18:16:52\n';
  assert.equal(cooldownFromLogs(log), '2026-10-12T18:20:00.000Z');
  assert.equal(cooldownFromLogs(''), '2026-10-11T18:16:52.000Z');
});
test('malformed upstream cooldown cannot be ignored', () => {
  assert.throws(() => cooldownFromLogs('WARNING: cool-down until after: unknown'));
  assert.throws(() => cooldownFromLogs('WARNING: cool-down until after: 2026-10-40 18:20:00'));
});
test('endpoint, file, clock and job overrides refuse before touching Docker', () => {
  const script = fileURLToPath(new URL('./check-demo-readiness.mjs', import.meta.url));
  for (const option of ['--endpoint=http://example.test', '--job=1', '--now=tomorrow', '--write', '--scanner-probe --scanner-probe']) {
    const result = spawnSync(process.execPath, [script, option], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1); assert.match(result.stderr, /^BLOCKED:/); assert.equal(result.stdout, '');
  }
});
