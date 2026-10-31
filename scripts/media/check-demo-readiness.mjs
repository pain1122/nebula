import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cooldownFloor = '2026-10-11T18:16:52Z';
const appImage = 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746';
const parserImage = 'sha256:c4809fae4ab094ce353a28995fac698355ada6eab92f10e18ad874da2d2bbf4c';
const scannerImage = 'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186';
const names = ['checkupino_app', 'checkupino_nginx', 'checkupino_db', 'checkupino_redis',
  'checkupino_prod-admin-1', 'checkupino_content-content-parser-1',
  'checkupino_scan-scan-check-1', 'checkupino_scan-scan-worker-1', 'checkupino_scan-scanner-1',
  'checkupino_media-media-master-1', 'checkupino_media-media-volume-1',
  'checkupino_media-media-filer-1', 'checkupino_media-media-s3-1'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const evidence = name => JSON.parse(readFileSync(resolve(root, 'docs/deployment/evidence', name), 'utf8'));
let stage = 'arguments';

// Logs are private inputs. Only the latest deadline is returned, never network identifiers.
export function cooldownFromLogs(logs) {
  let deadline = Date.parse(cooldownFloor);
  for (const line of logs.split('\n').filter(line => /cool-down until after:/i.test(line))) {
    const match = line.match(/cool-down until after:\s*(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\s*$/i);
    assert.ok(match, 'Unrecognized cooldown metadata; stop and inspect locally.');
    const date = match[1].replace(' ', 'T') + 'Z';
    assert.equal(new Date(date).toISOString(), date.replace('Z', '.000Z'), 'Invalid cooldown date.');
    deadline = Math.max(deadline, Date.parse(date));
  }
  return new Date(deadline).toISOString();
}

export function assessReadiness({ now, cooldownUntil, storyVerified, scannerRunning, scannerHealthy, probe }) {
  const time = Date.parse(now), cooldown = Date.parse(cooldownUntil);
  assert.ok(Number.isFinite(time) && Number.isFinite(cooldown), 'Readiness requires valid UTC timestamps.');
  const blockers = [];
  if (storyVerified !== true) blockers.push('accepted_story_not_verified');
  if (time <= cooldown) blockers.push('definition_cooldown_active');
  if (scannerRunning !== true) blockers.push('scanner_stopped');
  else if (scannerHealthy !== true) blockers.push('scanner_not_healthy');
  if (probe == null) blockers.push('current_real_scanner_probe_required');
  else {
    const updated = Date.parse(probe.scanner?.scanner_database_updated_at);
    const age = (time - updated) / 1000;
    if (probe.clean_and_eicar !== true || probe.content_valid !== true
      || probe.scanner?.scanner_engine !== 'clamav' || probe.scanner?.scanner_version !== '1.5.4'
      || !/^\d+$/.test(probe.scanner?.scanner_database_version ?? '')
      || !Number.isFinite(age) || age < -300 || age > 172800) blockers.push('current_real_probe_or_freshness_failed');
  }
  return {
    existing_history_ready: storyVerified === true,
    fresh_pipeline_ready: blockers.length === 0,
    // A probe is never permission to upload or consume a queue. A new file/job needs a new binding.
    fresh_upload_demo_ready: false,
    scanner_blockers: blockers,
    delivery_gate: 'new_authorized_file_and_exact_encrypted_job_binding_required',
    cooldown_until_utc: new Date(cooldown).toISOString(),
    cooldown_until_tehran: new Date(cooldown).toLocaleString('en-GB', { timeZone: 'Asia/Tehran', hour12: false }),
  };
}

const docker = (args, input, timeout = 20000) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 6000000 });
  assert.equal(result.status, 0, 'Scoped Docker inspection failed; no recovery was attempted.');
  return args[0] === 'logs' ? result.stdout + result.stderr : result.stdout;
};
const socketMounts = container => {
  for (const [name, destination] of [['checkupino_content_socket', '/run/medical-content'], ['checkupino_scan_scan_socket', '/run/medical-scan']])
    assert.ok(container.Mounts.some(mount => mount.Name === name && mount.Destination === destination && !mount.RW), 'Read-only socket attachment required.');
};

// A UI successor must carry both served-byte proof and its own read-only role rehearsal.
// The original clinical checkpoint is immutable, and the retained UI remains a valid rollback.
export function selectAcceptedDemoArtifact({ deployedImage, legacyArtifact, successorArtifact, adminRehearsal, clinicalHashes }) {
  assert.equal(legacyArtifact?.acceptance, 'passed', 'Accepted rollback artifact required.');
  if (deployedImage === legacyArtifact.image) return { artifact: legacyArtifact, adminReservationReady: false };
  assert.equal(successorArtifact?.acceptance, 'passed', 'Accepted UI successor required.');
  assert.equal(successorArtifact.image, deployedImage, 'Unknown deployed candidate.');
  assert.equal(adminRehearsal?.acceptance, 'passed', 'Admin role rehearsal required.');
  assert.equal(adminRehearsal.image, deployedImage, 'Admin rehearsal candidate mismatch.');
  assert.equal(adminRehearsal.checks?.length, 11, 'Complete admin read rehearsal required.');
  assert.deepEqual(adminRehearsal.baseline?.hashes, clinicalHashes, 'Admin baseline must preserve clinical checkpoint.');
  assert.deepEqual(adminRehearsal.final?.hashes, clinicalHashes, 'Admin final state must preserve clinical checkpoint.');
  assert.ok(Array.isArray(successorArtifact.assets) && successorArtifact.assets.length > 0 && successorArtifact.assets.length <= 80, 'Bounded successor assets required.');
  assert.equal(new Set(successorArtifact.assets.map(asset => asset.path)).size, successorArtifact.assets.length, 'Duplicate successor asset.');
  return { artifact: successorArtifact, adminReservationReady: true };
}
const isolated = (container, image, memory, pids) => {
  assert.equal(container.Image, image); assert.equal(container.Config.User, '33:33');
  const host = container.HostConfig;
  assert.equal(host.ReadonlyRootfs, true); assert.equal(host.Privileged, false);
  assert.deepEqual(host.CapDrop, ['ALL']); assert.ok(!host.CapAdd?.length);
  assert.ok(host.SecurityOpt?.includes('no-new-privileges:true'));
  assert.equal(host.Memory, memory); assert.equal(host.MemorySwap, memory);
  assert.equal(host.PidsLimit, pids); assert.equal(host.RestartPolicy.Name, 'no');
  assert.ok(!Object.values(container.NetworkSettings.Ports ?? {}).some(Boolean));
};
async function get(url, expectedStatus) {
  const response = await fetch(url, { redirect: 'manual', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  assert.equal(response.status, expectedStatus, 'Local health, role refusal or artifact delivery changed.');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    assert.ok(bytes <= 12000000, 'HTTP response bound exceeded.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Ordinary boot, SELECTs inside a read-only transaction, synthetic in-memory parser/optional engine calls.
// No model save, storage write, upload, credential read, queue consumer or schema operation.
const php = [
  '<?php',
  "require '/var/www/vendor/autoload.php';$app=require '/var/www/bootstrap/app.php';",
  '$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();',
  "if(posix_geteuid()!==33 || $app->configurationIsCached() || config('database.default')!=='mysql'",
  " || config('medical.scanner.enabled')!==true || config('filesystems.disks.private.driver')!=='local') throw new RuntimeException('App contract rejected.');",
  "$queue=config('queue.connections.medical-scan');",
  "if($queue['driver']!=='database' || $queue['queue']!=='medical-scan' || $queue['table']!=='jobs'",
  " || $queue['after_commit']!==false || $queue['retry_after']<=120 || ($queue['connection']??'mysql')!=='mysql'",
  ' || !is_subclass_of(App\\Jobs\\ScanReservationFile::class,Illuminate\\Contracts\\Queue\\ShouldBeEncrypted::class)) throw new RuntimeException("Queue contract rejected.");',
  'use Illuminate\\Support\\Facades\\DB;',
  "DB::statement('SET TRANSACTION READ ONLY');DB::beginTransaction();",
  'try {',
  "$r=App\\Models\\Reservation::with(['user.roles','doctor.user.roles','payment.successfulAttempt'])->findOrFail(8);",
  "if($r->user_id!==4 || $r->doctor->user_id!==5 || $r->status->value!=='completed' || app(App\\Services\\ReservationLifecycleService::class)->canComplete($r)) throw new RuntimeException('Completed synthetic reservation required.');",
  "$tables=['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events','audit_events','questionnaire_submissions','leads'];$hashes=[];",
  "foreach($tables as $table)$hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));",
  "$stable=$r->getAttributes();unset($stable['status'],$stable['completed_at'],$stable['updated_at']);$hashes['target_stable']=hash('sha256',json_encode($stable,JSON_THROW_ON_ERROR));",
  "$hashes['other_reservations']=hash('sha256',json_encode(DB::table('reservations')->where('id','!=',8)->orderBy('id')->get(),JSON_THROW_ON_ERROR));",
  "$hashes['protected']=hash('sha256',json_encode(App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));",
  "$counts=['requests'=>DB::table('reservation_medical_requests')->count(),'files'=>DB::table('reservation_files')->count(),'reports'=>DB::table('reservation_reports')->count(),'jobs'=>DB::table('jobs')->count(),'questionnaire_submissions'=>DB::table('questionnaire_submissions')->count()];",
  "foreach(['/run/medical-content/content.sock'=>33] as $socket=>$uid){$stat=lstat($socket);if(!is_array($stat) || $stat['uid']!==$uid || ($stat['mode']&0777)!==0600)throw new RuntimeException('Parser socket rejected.');}",
  '$bytes=Tests\\Fixtures\\SyntheticMedicalFiles::pdf();',
  "$stream=fopen('php://temp','w+b');fwrite($stream,$bytes);rewind($stream);",
  "try{$content=app(App\\Services\\MedicalContentValidator::class)->validate($stream,'application/pdf');}finally{fclose($stream);}",
  '$probe=null;',
  "if(getenv('CHECKUPINO_READINESS_PROBE')==='1'){",
  "$scan=static function($bytes){$stream=fopen('php://temp','w+b');fwrite($stream,$bytes);rewind($stream);try{return app(App\\Services\\ClamdScanner::class)->scan($stream);}finally{fclose($stream);}};",
  '$clean=$scan($bytes);',
  "$infected=$scan('X5O!P%@AP[4'.chr(92).'PZX54(P^)7CC)7}'.'$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');",
  "if($clean->status!==App\\Enums\\ReservationFileScanStatus::Clean || $infected->status!==App\\Enums\\ReservationFileScanStatus::Infected || $clean->checksumSha256!==hash('sha256',$bytes) || $clean->databaseVersion!==$infected->databaseVersion || $clean->databaseUpdatedAt!==$infected->databaseUpdatedAt)throw new RuntimeException('Fresh real probe rejected.');",
  "$probe=['clean_and_eicar'=>true,'content_valid'=>true,'scanner'=>$clean->auditFacts()];",
  '}',
  "echo json_encode(['hashes'=>$hashes,'counts'=>$counts,'producer_enabled'=>true,'private_driver'=>'local','parser_valid'=>true,'probe'=>$probe,'redis_ping'=>(bool)Illuminate\\Support\\Facades\\Redis::connection()->ping()],JSON_THROW_ON_ERROR);",
  '}finally{DB::rollBack();}',
].join('\n');

async function main() {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || args.length === 1 && args[0] === '--scanner-probe', 'Only optional --scanner-probe is accepted; no host, clock, account or job overrides.');
  assert.equal(realpathSync(process.cwd()), realpathSync(root), 'Run from the Checkupino project root.');
  stage = 'accepted evidence';
  const previous = evidence('demo-appointment-completed-final-2026-10-11.json');
  const rehearsal = evidence('demo-golden-rehearsal-final-2026-10-11.json');
  const legacyArtifact = evidence('demo-appointment-static-2026-10-11.json');
  assert.equal(previous.acceptance, 'passed'); assert.equal(rehearsal.acceptance, 'passed');
  assert.equal(legacyArtifact.acceptance, 'passed'); assert.equal(rehearsal.checks.length, 14);
  stage = 'container identity and isolation';
  const containers = JSON.parse(docker(['inspect', ...names]));
  const find = name => containers.find(container => container.Name === '/' + name);
  const scanner = find('checkupino_scan-scanner-1');
  for (const container of containers.filter(container => container !== scanner)) assert.equal(container.State.Running, true, 'Required demo service stopped.');
  const app = find('checkupino_app'), worker = find('checkupino_scan-scan-worker-1');
  const parser = find('checkupino_content-content-parser-1'), admin = find('checkupino_prod-admin-1');
  const optionalEvidence = name => existsSync(resolve(root, 'docs/deployment/evidence', name)) ? evidence(name) : null;
  const acceptedUiPairs = [
    ['admin-reservation-static-2026-10-11.json', 'admin-reservation-browser-2026-10-11.json'],
    ['admin-reservation-boxes-static-2026-10-11.json', 'admin-reservation-boxes-browser-2026-10-11.json'],
    ['admin-medical-questionnaire-static-2026-10-11.json', 'admin-medical-questionnaire-browser-2026-10-11.json'],
    ['panel-rtl-static-2026-10-12.json', 'panel-rtl-browser-2026-10-12.json'],
    ['panel-mirror-static-2026-10-13.json', 'panel-mirror-browser-2026-10-13.json'],
    ['panel-mirror-final-static-2026-10-13.json', 'panel-mirror-final-browser-2026-10-13.json'],
    ['panel-mirror-release-static-2026-10-13.json', 'panel-mirror-release-browser-2026-10-13.json'],
    ['questionnaire-editor-static-2026-10-13.json', 'questionnaire-editor-browser-2026-10-13.json'],
    ['questionnaire-editor-ready-static-2026-10-13.json', 'questionnaire-editor-ready-browser-2026-10-13.json'],
    ['user-profile-static-2026-10-13.json', 'user-profile-browser-2026-10-13.json'],
    ['reservation-controls-static-2026-10-13.json', 'reservation-controls-browser-2026-10-13.json'],
    ['operational-directory-static-2026-10-13.json', 'operational-directory-browser-2026-10-13.json'],
    ['admin-activity-panel-static-scoped-2026-10-14.json', 'admin-activity-panel-browser-2026-10-14.json'],
    ['admin-catalog-static-2026-10-14.json', 'admin-catalog-browser-2026-10-14.json'],
    ['admin-catalog-ready-static-2026-10-14.json', 'admin-catalog-ready-browser-2026-10-14.json'],
    ['admin-catalog-controls-static-2026-10-15.json', 'admin-catalog-controls-browser-2026-10-15.json'],
    ['admin-schedule-panel-static-2026-10-15.json', 'admin-schedule-panel-browser-2026-10-15.json'],
    ['admin-schedule-controls-static-2026-10-15.json', 'admin-schedule-controls-browser-2026-10-15.json'],
    ['admin-schedule-controls-ready-static-2026-10-15.json', 'admin-schedule-controls-ready-browser-2026-10-15.json'],
    ['admin-payment-panel-static-2026-10-16.json', 'admin-payment-panel-browser-2026-10-16.json'],
    ['admin-payment-controls-static-2026-10-16.json', 'admin-payment-controls-browser-2026-10-16.json'],
  ].map(([artifactName, browserName]) => ({ artifact: optionalEvidence(artifactName), rehearsal: optionalEvidence(browserName) }));
  const matchingUi = acceptedUiPairs.find(pair => pair.artifact?.image === admin.Image);
  const { artifact, adminReservationReady } = selectAcceptedDemoArtifact({
    deployedImage: admin.Image, legacyArtifact,
    successorArtifact: matchingUi?.artifact,
    adminRehearsal: matchingUi?.rehearsal,
    clinicalHashes: previous.final.hashes,
  });
  assert.equal(app.Image, appImage); socketMounts(app);
  assert.equal(admin.Image, artifact.image); assert.equal(admin.State.Health?.Status, 'healthy');
  isolated(worker, appImage, 268435456, 32); socketMounts(worker);
  assert.equal(worker.HostConfig.NanoCpus, 500000000); assert.ok(worker.Mounts.every(mount => !mount.RW));
  assert.deepEqual(Object.keys(worker.NetworkSettings.Networks), ['checkupino_checkupino_net']);
  assert.ok(worker.Config.Cmd.at(-1).endsWith('exec sleep infinity'));
  stage = 'actual idle worker';
  const top = docker(['top', worker.Name.slice(1), '-eo', 'pid,user,args']);
  assert.ok(/(?:^|\n)\s*\d+\s+\S+\s+sleep infinity\s*(?:\r?\n|$)/.test(top), 'Actual idle worker required.');
  assert.ok(!/queue:work|queue:listen|artisan/.test(top), 'Worker is not idle; stop.');
  stage = 'parser and scanner isolation';
  isolated(parser, parserImage, 536870912, 16); assert.equal(parser.HostConfig.NetworkMode, 'none');
  assert.equal(parser.HostConfig.NanoCpus, 1000000000); assert.equal(parser.Mounts.length, 1);
  assert.equal(parser.Mounts[0].Name, 'checkupino_content_socket');
  assert.equal(parser.Mounts[0].Destination, '/run/medical-content');
  assert.ok(!parser.Config.Env.some(value => /^(?:APP_KEY|DB_|AWS_|MEDICAL_S3_|REDIS_|MAIL_)/.test(value)), 'Parser cannot receive app credentials.');
  assert.equal(scanner.Config.Image, scannerImage); assert.equal(scanner.HostConfig.RestartPolicy.Name, 'no');
  stage = 'scanner cooldown';
  const cooldownUntil = cooldownFromLogs(docker(['logs', '--tail', '2000', '--timestamps', scanner.Name.slice(1)]));
  const probeRequested = args.length === 1;
  if (probeRequested) {
    stage = 'scanner probe admission';
    assert.ok(Date.now() > Date.parse(cooldownUntil), 'Cooldown active; real probe was not attempted.');
    assert.ok(scanner.State.Running && scanner.State.Health?.Status === 'healthy', 'Scanner must already be healthy; no start or download attempted.');
  }
  const execArgs = ['exec', '-i', '--user', '33:33'];
  execArgs.push('--env', 'CHECKUPINO_READINESS_PROBE=' + (probeRequested ? '1' : '0'), 'checkupino_app', 'php');
  stage = 'read-only database and parser runtime';
  const runtime = JSON.parse(docker(execArgs, php, probeRequested ? 130000 : 20000));
  stage = 'accepted data fingerprints';
  assert.deepEqual(runtime.hashes, previous.final.hashes, 'Accepted data changed; review the authorized new checkpoint without relaxing this baseline.');
  assert.deepEqual(runtime.counts, { requests: 2, files: 2, reports: 2, jobs: 0, questionnaire_submissions: 1 });
  assert.equal(runtime.redis_ping, true); assert.equal(runtime.parser_valid, true);
  stage = 'local HTTP health and deep links';
  await Promise.all([
    get('http://localhost:8080/up', 200), get('http://localhost:3000/healthz', 200),
    get('http://localhost:8080/api/auth/me', 401),
    ...['/panel/my/reservations/01m44ah0fxjqz5mbpbabe1qj44/medical', '/panel/doctor/reservations/01m44ah0fxjqz5mbpbabe1qj44/medical', '/panel/my/questionnaire'].map(path => get('http://localhost:3000' + path, 200)),
  ]);
  stage = 'served candidate assets';
  for (const asset of artifact.assets) {
    assert.match(asset.path, /^\/panel\/assets\/[A-Za-z0-9_.-]+$/);
    assert.equal(sha(await get('http://localhost:3000' + asset.path, 200)), asset.sha256, 'Served candidate asset changed.');
  }
  stage = 'final read-only data and worker verification';
  const finalRuntime = JSON.parse(docker(['exec', '-i', '--user', '33:33', '--env', 'CHECKUPINO_READINESS_PROBE=0', 'checkupino_app', 'php'], php));
  assert.deepEqual(finalRuntime.hashes, runtime.hashes, 'Data changed during inspection.');
  assert.deepEqual(finalRuntime.counts, runtime.counts);
  const finalTop = docker(['top', worker.Name.slice(1), '-eo', 'pid,user,args']);
  assert.ok(/(?:^|\n)\s*\d+\s+\S+\s+sleep infinity\s*(?:\r?\n|$)/.test(finalTop));
  assert.ok(!/queue:work|queue:listen|artisan/.test(finalTop));
  stage = 'scanner identity after inspection';
  const scannerAfter = JSON.parse(docker(['inspect', scanner.Name.slice(1)]))[0];
  assert.equal(scannerAfter.State.StartedAt, scanner.State.StartedAt, 'Scanner changed during readiness inspection.');
  assert.equal(scannerAfter.State.Running, scanner.State.Running);
  assert.equal(scannerAfter.State.Health?.Status, scanner.State.Health?.Status);
  const cooldownAfter = cooldownFromLogs(docker(['logs', '--tail', '2000', '--timestamps', scanner.Name.slice(1)]));
  const status = assessReadiness({
    now: new Date().toISOString(), cooldownUntil: cooldownAfter, storyVerified: true,
    scannerRunning: scanner.State.Running, scannerHealthy: scanner.State.Health?.Status === 'healthy', probe: runtime.probe,
  });
  console.log(JSON.stringify({
    checked_at: new Date().toISOString(), ...status,
    running_services: containers.filter(container => container.State.Running).length,
    accepted_candidate: admin.Image, verified_assets: artifact.assets.length, admin_reservation_panel_ready: adminReservationReady, counts: runtime.counts,
    worker_idle: true, data_and_protected_fingerprints_preserved: true,
    probe: runtime.probe, last_accepted_definitions: evidence('demo-worker-connected-2026-10-11.json').runtime.scanner,
    last_accepted_definitions_are_current_engine_proof: false,
    scope: 'Read-only recorded synthetic demo checkpoint; no file/evidence writes, downloads of definitions, service activation or job consumption.',
  }, null, 2));
  // Default success means recorded history only. The opt-in must satisfy its stronger current gate.
  process.exitCode = probeRequested && !status.fresh_pipeline_ready ? 2 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error('BLOCKED: ' + stage + ' failed. No recovery, upload or queue consumption was attempted. Inspect the current checkpoint and runbook; do not replay closed writers.');
    process.exitCode = 1;
  });
