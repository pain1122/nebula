import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const tag = 'checkupino-content-isolation:2026-10-08';
const inspect = spawnSync('docker', ['image', 'inspect', tag, '--format', '{{.Id}}'], { encoding: 'utf8', windowsHide: true });
assert.equal(inspect.status, 0, 'Build the prepared isolated parser image first.');
const image = inspect.stdout.trim();
assert.match(image, /^sha256:[a-f0-9]{64}$/);
const files = ['app/Services/MedicalContentValidator.php', 'app/Support/MedicalContentPolicy.php', 'app/Support/MedicalContentProtocol.php', 'config/medical_content.php', 'scripts/media/serve-medical-content.php', 'scripts/media/validate-medical-image.php', 'vendor/composer/installed.json'];
const hashes = Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
const hashPhp = '$files=' + JSON.stringify(files).replaceAll('"', "'") + '; $hashes=[]; foreach($files as $file) $hashes[$file]=hash_file("sha256", "/opt/checkupino-content/".$file); echo json_encode($hashes, JSON_THROW_ON_ERROR);';
const common = ['run', '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--init', '--user', '33:33', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--memory', '512m', '--memory-swap', '512m', '--cpus', '1.0', '--pids-limit', '16', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777', '--tmpfs', '/run/medical-content:rw,noexec,nosuid,nodev,size=1m,mode=0700,uid=33,gid=33', '--entrypoint', 'php', image];
// Keep embedded PHP quotes out of Windows command-line argument conversion.
const encodedPhp = code => "eval(base64_decode('" + Buffer.from(code).toString('base64') + "'));";
const hashRun = spawnSync('docker', [...common, '-r', encodedPhp(hashPhp)], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
assert.equal(hashRun.status, 0, 'Isolated image source identity check did not complete.');
assert.deepEqual(JSON.parse(hashRun.stdout), hashes, 'Rebuild the isolation image after source changes.');
const code = readFileSync('scripts/media/probe-content-isolation.php', 'utf8').replace(/^<\?php\s*/, '');
const caughtProbe = "try { eval(base64_decode('" + Buffer.from(code).toString('base64') + "')); } catch (Throwable $failure) { fwrite(STDERR, 'Synthetic isolation probe failed at source line '.$failure->getLine().PHP_EOL); exit(1); }";
const probe = spawnSync('docker', [...common, '-d', 'memory_limit=96M', '-d', 'display_errors=0', '-d', 'log_errors=0', '-r', encodedPhp(caughtProbe)], { encoding: 'utf8', windowsHide: true, timeout: 45000 });
assert.equal(probe.status, 0, 'Restricted synthetic isolation probe did not pass; no live service was replaced. ' + probe.stderr);
const runtime = JSON.parse(probe.stdout);
writeFileSync('docs/deployment/evidence/content-isolation-image-2026-10-08.json', JSON.stringify({ verified_at_utc: new Date().toISOString(), image, source_hashes: hashes, runtime, scope: 'Temporary no-network/no-mount synthetic parser container; no live database, storage or queue' }, null, 2) + '\n');
console.log('Isolated image identity, no-network/no-secret boundary, native PDF/PNG/JPEG, tamper rejection and spool cleanup pass; no live deployment or worker.');
