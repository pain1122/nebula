import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const docker = args => {
  const run = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 65536 });
  assert.equal(run.status, 0, 'Restricted scanner egress diagnosis did not complete; definition state is unchanged.');
  return run.stdout;
};
const networkName = 'checkupino_scan_definition_updates';
const network = JSON.parse(docker(['network', 'inspect', networkName, '--format', '{{json .}}']));
assert.equal(network.Name, networkName);
assert.equal(network.Labels['com.docker.compose.project'], 'checkupino_scan');
const scanner = JSON.parse(docker(['inspect', 'checkupino_scan-scanner-1', '--format', '{{json .}}']));
assert.equal(scanner.State.Status, 'exited');
assert.equal(scanner.RestartCount, 0);
assert.equal(scanner.HostConfig.RestartPolicy.Name, 'no');
assert.ok(!scanner.Config.Env.some(value => /^(?:http|https|all)_proxy=.+/i.test(value)), 'Resolve configured updater proxy details before diagnosing direct transport.');
assert.ok(!/^\s*HTTPProxy(?:Server|Port|Username|Password)\s/m.test(readFileSync('docker/medical-scan/freshclam.conf', 'utf8')));
const info = JSON.parse(docker(['info', '--format', '{{json .}}']));
const proxyHost = value => {
  if (!value) return null;
  try { return new URL(value.includes('://') ? value : 'http://' + value).hostname; } catch { return 'configured-unparsed'; }
};
const base = 'sha256:a48b0c0b60fc1e5b59685dd0d6a6fece0aec8119b9b5f854dbd1f3f2497b3094';
const trace = docker(['run', '--rm', '--pull', 'never', '--network', networkName, '--read-only', '--init', '--user', '33:33', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--memory', '64m', '--memory-swap', '64m', '--cpus', '0.25', '--pids-limit', '8', '--entrypoint', 'curl', base, '--silent', '--show-error', '--fail', '--proto', '=https', '--tlsv1.2', '--noproxy', '*', '--connect-timeout', '5', '--max-time', '15', '--max-filesize', '4096', 'https://www.cloudflare.com/cdn-cgi/trace']);
assert.ok(Buffer.byteLength(trace) <= 4096);
const fields = Object.fromEntries(trace.trim().split(/\r?\n/).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
assert.match(fields.loc, /^[A-Z]{2}$/);
assert.match(fields.colo, /^[A-Z]{3}$/);
assert.ok(fields.ip && fields.tls, 'Expected bounded official trace metadata.');
const evidence = { verified_at_utc: new Date().toISOString(), scope: 'One official Cloudflare HTTPS trace from the scanner Docker network using direct HTTP transport; no definition/CDN download, FreshClam startup, clinical data or proxy change', network: networkName, egress_country: fields.loc, cloudflare_colo: fields.colo, tls: fields.tls, public_ip_received_but_not_logged_or_persisted: true, docker_daemon_proxy_hosts: { http: proxyHost(info.HttpProxy ?? info.HTTPProxy), https: proxyHost(info.HttpsProxy ?? info.HTTPSProxy) }, original_scanner: { state: scanner.State.Status, exit_code: scanner.State.ExitCode, restarts: scanner.RestartCount, restart_policy: scanner.HostConfig.RestartPolicy.Name }, limitations: ['Docker Desktop daemon proxy names do not identify the external route or prove a VPN', 'Cloudflare trace describes this bounded request; it does not establish the exact ClamAV CDN denial rule or signature access', 'No public IP, credentials or patient information persisted'] };
writeFileSync('docs/deployment/evidence/scanner-egress-diagnosis-2026-10-08.json', JSON.stringify(evidence, null, 2) + '\n');
console.log('Bounded scanner-network metadata diagnosis: egress country ' + fields.loc + ', Cloudflare colo ' + fields.colo + '; public IP withheld. Scanner remains stopped; no definition request.');
