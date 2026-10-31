// Current editorial recovery only; the older whole-demo guard remains unchanged.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {base64 as png} from './synthetic-image.mjs';
import {snapshot, runtime} from '../health/activation-state.mjs';
import {cooldownFromLogs} from '../media/check-demo-readiness.mjs';

assert.equal(process.argv.length,2,'No host, clock, file, job or policy overrides.');
const run=(args, options={})=>{
  const r=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:6000000,...options});
  assert.equal(r.status,0,'Restricted editorial runtime check refused; no retry or recovery attempted.');
  return args[0]==='logs'?r.stdout+r.stderr:r.stdout;
};
const before=snapshot();
const accepted=JSON.parse(readFileSync('docs/deployment/evidence/article-seamless-2026-10-24.json','utf8'));
assert.deepEqual(before.hashes,accepted.state.hashes,'Business/protected checkpoint changed; reconcile rather than replay.');
for(const [path,hash] of Object.entries(accepted.source).filter(([p])=>p.startsWith('app/')||p==='routes/api.php'))
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,'Accepted application source changed.');
const names=['checkupino_app','checkupino_scan-scanner-1','checkupino_content-content-parser-1','checkupino_scan-scan-worker-1'];
const [app,scanner,parser,worker]=JSON.parse(run(['inspect',...names]));
assert.equal(app.Image,'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');assert.equal(app.State.Running,true);
assert.equal(scanner.Config.Image,'clamav/clamav:1.5.4@sha256:7659dcb0db47941d3cf8336af84bbb63c7e70b76fc00601774358412b42ed186');
assert.equal(scanner.State.Running,true,'Start only the existing scanner through the operator.');assert.equal(scanner.State.Health?.Status,'healthy');
assert.equal(scanner.RestartCount,0);assert.equal(scanner.HostConfig.RestartPolicy.Name,'no');assert.equal(scanner.HostConfig.ReadonlyRootfs,true);assert.deepEqual(scanner.HostConfig.CapDrop,['ALL']);assert.equal(scanner.Config.User,'100:100');
const cooldown=cooldownFromLogs(run(['logs','--tail','2000','--timestamps',names[1]]));assert.ok(Date.now()>Date.parse(cooldown),'Cooldown active; no engine contact.');
assert.equal(parser.Image,'sha256:c4809fae4ab094ce353a28995fac698355ada6eab92f10e18ad874da2d2bbf4c');assert.equal(parser.State.Running,true);
const h=parser.HostConfig;assert.equal(h.NetworkMode,'none');assert.equal(h.ReadonlyRootfs,true);assert.equal(h.Privileged,false);assert.equal(h.PidMode,'');assert.deepEqual(h.CapDrop,['ALL']);assert.ok(!h.CapAdd?.length);assert.ok(h.SecurityOpt.includes('no-new-privileges:true'));
assert.equal(h.Memory,536870912);assert.equal(h.MemorySwap,536870912);assert.equal(h.NanoCpus,1000000000);assert.equal(h.PidsLimit,16);assert.equal(h.RestartPolicy.Name,'no');assert.equal(parser.Config.User,'33:33');
assert.deepEqual(h.Tmpfs,{'/tmp':'rw,noexec,nosuid,nodev,size=128m,mode=1777'});assert.equal(parser.Mounts.length,1);assert.equal(parser.Mounts[0].Name,'checkupino_content_socket');assert.equal(parser.Mounts[0].Destination,'/run/medical-content');assert.equal(parser.Mounts[0].RW,true);
assert.ok(!parser.Config.Env.some(v=>/^(?:APP_KEY|DB_|AWS_|MEDICAL_S3_|REDIS_|MAIL_)/.test(v)));assert.equal(Object.keys(parser.NetworkSettings.Ports??{}).length,0);
assert.equal(worker.State.Running,false);assert.match(worker.Config.Cmd.join(' '),/exec sleep infinity/);
for(const [name,destination] of [['checkupino_content_socket','/run/medical-content'],['checkupino_scan_scan_socket','/run/medical-scan']])
  assert.ok(app.Mounts.some(m=>m.Name===name&&m.Destination===destination&&!m.RW));
const boundary=JSON.parse(run(['exec','--user','33:33','--workdir','/var/www',names[0],'php','scripts/content/inspect-media-activation.php','--expect-enabled']));
for(const table of ['article_media_assets','article_version_media','article_publication_schedules'])assert.equal(boundary.counts[table],0,'Positive acceptance already started; reconcile instead of replay.');
const probe=JSON.parse(run(['exec','--user','33:33','--workdir','/var/www','--env','CHECKUPINO_EDITORIAL_SYNTHETIC_PNG='+png,names[0],'php','scripts/content/probe-media-runtime.php','--synthetic-only'],{timeout:90000}));
assert.equal(probe.acceptance,'passed');assert.equal(probe.writes,0);assert.equal(probe.jobs,before.counts.jobs);assert.equal(probe.clean_png,true);assert.equal(probe.eicar_infected,true);assert.equal(probe.corrupt_png_rejected,true);assert.equal(probe.following_valid_png_passes,true);
const after=snapshot();assert.deepEqual(after.hashes,before.hashes);assert.deepEqual(after.health_counts,before.health_counts);
const path='docs/deployment/evidence/article-media-real-runtime-'+Date.now()+'-2026-10-24.json';
writeFileSync(path,JSON.stringify({acceptance:'passed',checked_at:new Date().toISOString(),probe,boundary,state:after,runtime:runtime(),cooldown_until_utc:cooldown,source:Object.fromEntries(['scripts/content/probe-media-runtime.php','scripts/content/verify-media-runtime.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),scope:'Real current ClamAV clean/EICAR/checksum/freshness and isolated GD PNG/corrupt-CRC/recovery from the ordinary UID33 application; synthetic memory only, no uploads/verdict writes/definition requests/queue consumption.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({acceptance:'passed',evidence:path,scanner:probe.scanner,parser:probe.content,corrupt_png_rejected:true,jobs_preserved:after.counts.jobs}));
