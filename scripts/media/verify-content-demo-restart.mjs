import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const connected = process.argv.includes('--app-connected');
assert(process.argv.slice(2).every(value => value === '--app-connected'));
// Current accepted clinical counts; older one-file/disabled checkpoint guards stay intact.
const accepted=JSON.parse(readFileSync('docs/deployment/evidence/demo-medical-final-readonly-2026-10-11.json','utf8'));
assert.equal(accepted.acceptance,'passed');assert.deepEqual(accepted.final.counts,{requests:2,files:2,reports:2,jobs:0});
const expectedImage = 'sha256:c4809fae4ab094ce353a28995fac698355ada6eab92f10e18ad874da2d2bbf4c';
const parserName = 'checkupino_content-content-parser-1';
const execute = (args, input, timeout = 45000) => {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true, timeout });
  assert.equal(result.status, 0, 'Restricted content runtime check did not complete.');
  return result.stdout;
};
const parser = JSON.parse(execute(['inspect', parserName, '--format', '{{json .}}']));
assert.equal(parser.Image, expectedImage);
assert.equal(parser.Config.User, '33:33');
assert.equal(parser.State.Running, true);
assert.equal(parser.RestartCount, 0);
const host = parser.HostConfig;
assert.equal(host.NetworkMode, 'none');
assert.equal(host.ReadonlyRootfs, true);
assert.equal(host.Privileged, false);
assert.equal(host.PidMode, '');
assert.deepEqual(host.CapDrop, ['ALL']);
assert.ok(!host.CapAdd?.length);
assert.ok(host.SecurityOpt.includes('no-new-privileges:true'));
assert.equal(host.Memory, 536870912);
assert.equal(host.MemorySwap, 536870912);
assert.equal(host.NanoCpus, 1000000000);
assert.equal(host.PidsLimit, 16);
assert.equal(host.RestartPolicy.Name, 'no');
assert.deepEqual(host.Tmpfs, { '/tmp': 'rw,noexec,nosuid,nodev,size=128m,mode=1777' });
assert.equal(parser.Mounts.length, 1);
assert.equal(parser.Mounts[0].Name, 'checkupino_content_socket');
assert.equal(parser.Mounts[0].Destination, '/run/medical-content');
assert.equal(parser.Mounts[0].RW, true);
assert.ok(!Object.keys(parser.NetworkSettings.Ports ?? {}).length);
assert.ok(!parser.Config.Env.some(value => /^(?:APP_KEY|DB_|AWS_|MEDICAL_S3_|REDIS_|MAIL_)/.test(value)));
const initializer = JSON.parse(execute(['inspect', 'checkupino_content-content-init-1', '--format', '{{json .State}}']));
assert.equal(initializer.Status, 'exited');
assert.equal(initializer.ExitCode, 0);

const fixturePhp = '<?php require "/var/www/vendor/autoload.php"; echo base64_encode(Tests\\Fixtures\\SyntheticMedicalFiles::pdf());';
const fixture = execute(['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], fixturePhp).trim();
assert.match(fixture, /^[A-Za-z0-9+/]+=*$/);
const root = connected ? '/var/www' : '/opt/checkupino-content';
const prefix = '<?php require ' + JSON.stringify(root + '/vendor/autoload.php') + ';';
const bootstrap = connected ? '$app=require "/var/www/bootstrap/app.php"; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();' : '';
const body = String.raw`
$bytes=base64_decode(getenv('CHECKUPINO_SYNTHETIC_PDF'),true);
$policy=App\Support\MedicalContentPolicy::fromRules(require __ROOT__.'/config/medical_content.php');
$path='/run/medical-content/content.sock';
$stat=lstat($path);
if(!is_array($stat) || $stat['uid']!==33 || ($stat['mode'] & 0777)!==0600) throw new RuntimeException('Socket ownership check failed.');
$exchange=static function(bool $tamper=false) use($bytes,$policy,$path): void {
    $socket=stream_socket_client('unix://'.$path,$code,$error,2);
    if(!is_resource($socket)) throw new RuntimeException('Socket check failed.');
    stream_set_blocking($socket,false);
    $header=['version'=>1,'nonce'=>bin2hex(random_bytes(16)),'bytes'=>strlen($bytes),'sha256'=>$tamper?str_repeat('0',64):hash('sha256',$bytes),'mime'=>'application/pdf','revision'=>$policy->revision];
    try {
        App\Support\MedicalContentProtocol::write($socket,json_encode($header,JSON_THROW_ON_ERROR)."\n".$bytes,App\Support\MedicalContentProtocol::deadline(5));
        stream_socket_shutdown($socket,STREAM_SHUT_WR);
        if($tamper) {
            if(App\Support\MedicalContentProtocol::read($socket,1,App\Support\MedicalContentProtocol::deadline(5))!=='') throw new RuntimeException('Tamper check failed.');
        } else {
            $reply=App\Support\MedicalContentProtocol::line($socket,App\Support\MedicalContentProtocol::deadline(12));
            App\Support\MedicalContentProtocol::end($socket,App\Support\MedicalContentProtocol::deadline(2));
            App\Support\MedicalContentProtocol::assertReply($reply,$header);
        }
    } finally {fclose($socket);}
};
$exchange(); $exchange(true); $exchange();
$result=['socket_uid'=>33,'socket_mode'=>'0600','synthetic_pdf'=>true,'tamper_rejected'=>true,'following_request_passes'=>true,'content_policy_revision'=>$policy->revision];
if(isset($app)) {
    if($app->environment('testing')) throw new RuntimeException('Expected ordinary app environment.');
    $stream=fopen('php://temp','w+b'); fwrite($stream,$bytes);
    try {$facts=app(App\Services\MedicalContentValidator::class)->validate($stream,'application/pdf');} finally {fclose($stream);}
    if($facts['content_policy_revision']!==$policy->revision) throw new RuntimeException('App content revision check failed.');
    $result['app_remote_validation']=true;
    $result['scanning_enabled']=(bool)config('medical.scanner.enabled');
    $result['private_driver']=config('filesystems.disks.private.driver');
    $result['requests']=Illuminate\Support\Facades\DB::table('reservation_medical_requests')->count();
    $result['files']=Illuminate\Support\Facades\DB::table('reservation_files')->count();
    $result['reports']=Illuminate\Support\Facades\DB::table('reservation_reports')->count();
    $result['jobs']=Illuminate\Support\Facades\DB::table('jobs')->count();
    if($result['scanning_enabled']!==true || $result['private_driver']!=='local' || $result['requests']!==2 || $result['files']!==2 || $result['reports']!==2 || $result['jobs']!==0) throw new RuntimeException('Preserved runtime check failed.');
}
echo json_encode($result,JSON_THROW_ON_ERROR),PHP_EOL;
`;
const php = prefix + bootstrap + body.replace('__ROOT__', JSON.stringify(root));
const container = connected ? 'checkupino_app' : parserName;
if (connected) {
  const mounts = JSON.parse(execute(['inspect', container, '--format', '{{json .Mounts}}']));
  assert.ok(mounts.some(mount => mount.Name === 'checkupino_content_socket' && mount.Destination === '/run/medical-content' && mount.RW === false));
}
const runtime = JSON.parse(execute(['exec', '-i', '--user', '33:33', '--env', 'CHECKUPINO_SYNTHETIC_PDF=' + fixture, container, 'php'], php));
const stage = connected ? 'app' : 'parser';
writeFileSync('docs/deployment/evidence/content-demo-restart-' + stage + '-runtime-2026-10-11.json', JSON.stringify({ verified_at_utc: new Date().toISOString(), image: expectedImage, stage, runtime, scope: 'Synthetic verified bytes/socket checks and selected readonly counts; no clinical/setting/audit/queue writes', controls: { network: 'none', root_read_only: true, uid: 33, capabilities: 'none', no_new_privileges: true, memory_bytes: host.Memory, memory_swap_bytes: host.MemorySwap, cpus: 1, pids: host.PidsLimit, mount: 'dedicated socket only' } }, null, 2) + '\n');
console.log(connected ? 'Deployed parser controls and ordinary app remote-validation/tamper checks pass; existing quarantine/counts preserved.' : 'Deployed parser controls, socket ownership and synthetic valid/tamper/recovery checks pass; app attachment remains separate.');


