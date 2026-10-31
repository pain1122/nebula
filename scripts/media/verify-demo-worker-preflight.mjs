import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const connected = process.argv.length === 3 && process.argv[2] === '--worker-connected';
assert.ok(process.argv.length === 2 || connected, 'Only --worker-connected is accepted.');
const image = 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746';
const run = (args, input, timeout = 45000) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 4000000 });
  assert.equal(result.status, 0, 'Scoped read-only Docker check failed. No service was started.');
  return result.stdout;
};
const workerConfig = JSON.parse(run(['compose', '--project-name', 'checkupino_scan', '--file', 'docker-compose.scan.yml', '--file', 'docker-compose.scan-demo.yml', '--profile', 'worker', 'config', '--format', 'json']));
const definition = workerConfig.services['scan-worker'];
assert.equal(definition.image, image);
assert.equal(definition.restart, 'no');
assert.equal(definition.user, '33:33');
assert.equal(definition.read_only, true);
assert.equal(Number(definition.mem_limit), 268435456);
assert.equal(Number(definition.memswap_limit), 268435456);
assert.equal(definition.pids_limit, 32);
assert.ok(definition.command.at(-1).endsWith('exec sleep infinity'));
assert.ok(!definition.command.join(' ').includes('queue:work'));
assert.deepEqual(definition.cap_drop, ['ALL']);
assert.ok(definition.volumes.every(mount => mount.read_only));
const producerConfig = JSON.parse(run(['compose', '--project-name', 'checkupino', '--file', 'docker-compose.yml', '--file', 'docker-compose.content-client.yml', '--file', 'docker-compose.scan-producer.yml', 'config', '--format', 'json']));
assert.equal(producerConfig.services.app.image, image);
assert.equal(producerConfig.services.app.environment.MEDICAL_SCAN_ENABLED, 'true');
for (const target of ['/run/medical-scan', '/run/medical-content']) assert.ok(producerConfig.services.app.volumes.some(mount => mount.target === target && mount.read_only));
const inspect = name => JSON.parse(run(['inspect', name]))[0];
const app = inspect('checkupino_app');
assert.equal(app.Image, image); assert.equal(app.State.Running, true);
const scanner = inspect('checkupino_scan-scanner-1');
assert.equal(scanner.Config.Image, 'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186');
assert.equal(scanner.State.Health.Status, 'healthy');
const parser = inspect('checkupino_content-content-parser-1');
assert.equal(parser.Image, 'sha256:c4809fae4ab094ce353a28995fac698355ada6eab92f10e18ad874da2d2bbf4c');
assert.equal(parser.State.Running, true); assert.equal(parser.HostConfig.NetworkMode, 'none');
const container = connected ? 'checkupino_scan-scan-worker-1' : 'checkupino_scan-scan-check-1';
const worker = inspect(container);
assert.equal(worker.Image, image); assert.equal(worker.State.Running, true);
assert.equal(worker.Config.User, '33:33'); assert.equal(worker.HostConfig.ReadonlyRootfs, true);
assert.deepEqual(worker.HostConfig.CapDrop, ['ALL']);
assert.ok(worker.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
assert.deepEqual(Object.keys(worker.NetworkSettings.Networks), ['checkupino_checkupino_net']);
assert.ok(!Object.values(worker.NetworkSettings.Ports ?? {}).some(Boolean));
assert.ok(worker.Mounts.every(mount => !mount.RW));
for (const [name, target] of [['checkupino_scan_scan_socket', '/run/medical-scan'], ['checkupino_content_socket', '/run/medical-content']]) assert.ok(worker.Mounts.some(mount => mount.Name === name && mount.Destination === target && !mount.RW));
if (connected) {
  assert.equal(worker.HostConfig.Memory, 268435456); assert.equal(worker.HostConfig.MemorySwap, 268435456);
  assert.equal(worker.HostConfig.NanoCpus, 500000000); assert.equal(worker.HostConfig.PidsLimit, 32);
  assert.equal(worker.HostConfig.RestartPolicy.Name, 'no');
  assert.ok(worker.Config.Cmd.at(-1).endsWith('exec sleep infinity'));
}
const php = String.raw`<?php
require 'vendor/autoload.php'; $app=require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(posix_geteuid()!==33 || $app->configurationIsCached() || config('database.default')!=='mysql'
 || config('medical.scanner.enabled')!==true || config('filesystems.disks.private.driver')!=='local') throw new RuntimeException('Worker configuration rejected.');
$queue=config('queue.connections.medical-scan');
if($queue['driver']!=='database' || $queue['queue']!=='medical-scan' || $queue['table']!=='jobs'
 || $queue['after_commit']!==false || $queue['retry_after']<=120 || ($queue['connection']??'mysql')!=='mysql'
 || !is_subclass_of(App\Jobs\ScanReservationFile::class,Illuminate\Contracts\Queue\ShouldBeEncrypted::class)) throw new RuntimeException('Queue contract rejected.');
Illuminate\Support\Facades\DB::statement('START TRANSACTION READ ONLY');
try {
 $r=App\Models\Reservation::findOrFail(8);
 if($r->user_id!==4 || $r->doctor->user_id!==5 || App\Models\ReservationMedicalRequest::count()!==2
 || App\Models\ReservationFile::count()!==1 || App\Models\ReservationReport::count()!==0
 || Illuminate\Support\Facades\DB::table('jobs')->count()!==0) throw new RuntimeException('Preserved empty-queue checkpoint required.');
 $original=App\Models\ReservationFile::firstOrFail();
 if($original->public_id!=='01M4DN9XK0Z7CKQ2GFBHSACA6H' || $original->scan_status!==App\Enums\ReservationFileScanStatus::Quarantined) throw new RuntimeException('Original quarantine must be retained.');
 $bytes=Tests\Fixtures\SyntheticMedicalFiles::pdf();
 $scan=function($bytes) { $stream=fopen('php://temp','w+b'); fwrite($stream,$bytes); rewind($stream); try{return app(App\Services\ClamdScanner::class)->scan($stream);}finally{fclose($stream);} };
 $clean=$scan($bytes);
 $infected=$scan('X5O!P%@AP[4'.chr(92).'PZX54(P^)7CC)7}'.'$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
 if($clean->status!==App\Enums\ReservationFileScanStatus::Clean || $infected->status!==App\Enums\ReservationFileScanStatus::Infected || $clean->checksumSha256!==hash('sha256',$bytes)) throw new RuntimeException('Real engine acceptance failed.');
 $stream=fopen('php://temp','w+b'); fwrite($stream,$bytes); rewind($stream);
 try{$content=app(App\Services\MedicalContentValidator::class)->validate($stream,'application/pdf');}finally{fclose($stream);}
 echo json_encode(['acceptance'=>'passed','uid'=>33,'mysql_read_only'=>true,'counts'=>['requests'=>2,'files'=>1,'reports'=>0,'jobs'=>0],
 'private_driver'=>'local','queue'=>'medical-scan','encrypted_delivery'=>true,'clean_and_eicar'=>true,'scanner'=>$clean->auditFacts(),'content_policy_revision'=>$content['content_policy_revision'],
 'clinical_writes'=>false,'job_consumption'=>false],JSON_THROW_ON_ERROR);
}finally{Illuminate\Support\Facades\DB::statement('ROLLBACK');}
`;
const producer = JSON.parse(run(['exec', '-i', '--user', '33:33', 'checkupino_app', 'php'], String.raw`<?php require 'vendor/autoload.php';$app=require 'bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();echo json_encode(['scan'=>config('medical.scanner.enabled'),'driver'=>config('filesystems.disks.private.driver')],JSON_THROW_ON_ERROR);`));
assert.equal(producer.scan, false); assert.equal(producer.driver, 'local');
const runtime = JSON.parse(run(['exec', '-i', '--user', '33:33', container, 'php'], php));
assert.equal(runtime.acceptance, 'passed'); assert.equal(runtime.clinical_writes, false);
writeFileSync('docs/deployment/evidence/demo-worker-' + (connected ? 'connected' : 'preflight') + '-2026-10-11.json', JSON.stringify({checked_at: new Date().toISOString(), acceptance:'passed', stage: connected ? 'idle dedicated worker' : 'source plus existing check runtime', image, runtime, producer_dispatch_enabled:false, scope:'No Compose activation, queue processing, upload or clinical mutation; bounded worker remains a separate operation.'}, null, 2)+'\n');
console.log(JSON.stringify({acceptance:'passed', stage:connected?'worker-connected':'preflight', scanner:runtime.scanner, content:true, jobs:0, producer_dispatch_enabled:false}));
