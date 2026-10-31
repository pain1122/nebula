import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const deliver=process.argv.length===3&&process.argv[2]==='--deliver';
assert.ok(process.argv.length===2||deliver,'Only optional --deliver is accepted; default is inspection.');
const path='docs/deployment/evidence/demo-medical-job-'+(deliver?'delivery':'inspection')+'-2026-10-11.json';
assert.ok(!deliver||!existsSync(path),'A delivery was already attempted. Inspect state; never replay this helper automatically.');
const producer=JSON.parse(readFileSync('docs/deployment/evidence/demo-producer-runtime-2026-10-11.json','utf8'));
const upload=JSON.parse(readFileSync('docs/deployment/evidence/demo-upload-accepted-2026-10-11.json','utf8'));
assert.equal(producer.acceptance,'passed');assert.equal(upload.acceptance,'passed');
const inspect=spawnSync('docker',['inspect','checkupino_scan-scan-worker-1'],{encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(inspect.status,0);
const worker=JSON.parse(inspect.stdout)[0];
assert.equal(worker.Image,producer.image);assert.equal(worker.State.Running,true);assert.equal(worker.Config.User,'33:33');
assert.equal(worker.HostConfig.ReadonlyRootfs,true);assert.equal(worker.HostConfig.Memory,268435456);assert.equal(worker.HostConfig.MemorySwap,268435456);
assert.equal(worker.HostConfig.PidsLimit,32);assert.equal(worker.HostConfig.RestartPolicy.Name,'no');assert.ok(worker.Config.Cmd.at(-1).endsWith('exec sleep infinity'));
assert.deepEqual(worker.HostConfig.CapDrop,['ALL']);assert.ok(worker.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
assert.ok(worker.Mounts.every(mount=>!mount.RW));assert.deepEqual(Object.keys(worker.NetworkSettings.Networks),['checkupino_checkupino_net']);
if(deliver){const proof=JSON.parse(readFileSync('docs/deployment/evidence/demo-medical-job-inspection-2026-10-11.json','utf8'));assert.equal(proof.acceptance,'passed');assert.equal(proof.runtime.file,upload.receipt.public_id);writeFileSync(path,JSON.stringify({acceptance:'started',started_at:new Date().toISOString(),file:upload.receipt.public_id,scope:'One bounded medical-scan delivery; inspect after any interruption, never replay automatically.'},null,2)+'\n');}
const result=spawnSync('docker',['exec','--user','33:33','checkupino_scan-scan-worker-1','php','/var/www/scripts/media/deliver-demo-medical-job.php',deliver?'--deliver':'--inspect'],{encoding:'utf8',windowsHide:true,timeout:170000,maxBuffer:1000000});
let runtime;
try{assert.equal(result.status,0,'Bounded job guard/delivery failed. No automatic retry; inspect state.');runtime=JSON.parse(result.stdout);assert.equal(runtime.acceptance,'passed');assert.equal(runtime.stage,deliver?'delivered':'inspected');assert.equal(runtime.file,upload.receipt.public_id);}
catch(error){if(deliver)writeFileSync(path,JSON.stringify({acceptance:'failed',checked_at:new Date().toISOString(),file:upload.receipt.public_id,scope:'Do not replay. Queue/file state may have changed; verify ordinary recovery separately.'},null,2)+'\n');throw error;}
writeFileSync(path,JSON.stringify({acceptance:'passed',checked_at:new Date().toISOString(),image:worker.Image,runtime,scope:deliver?'One normal Laravel encrypted medical-scan job, real scanner/content/service audit. No default queue, old-file requeue or direct clean update.':'Read-only queue/file payload inspection plus session advisory lock; no consumption.'},null,2)+'\n');console.log(JSON.stringify(runtime));
