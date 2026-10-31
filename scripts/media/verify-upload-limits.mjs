import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Synthetic transport checks only. No authenticated upload or medical record write.
// The private FPM probe lives outside public/ and is removed in the PHP finally block.
const php = String.raw`<?php
function requireCheck(bool $ok): void {
    if (!$ok) { throw new RuntimeException('Synthetic upload transport check failed.'); }
}
function writeAll($socket, string $bytes): void {
    for ($offset = 0; $offset < strlen($bytes); $offset += $written) {
        $written = fwrite($socket, substr($bytes, $offset));
        requireCheck(is_int($written) && $written > 0);
    }
}
function record($socket, int $type, string $bytes): void {
    writeAll($socket, pack('CCnnCC', 1, $type, 1, strlen($bytes), 0, 0).$bytes);
}
function readExact($socket, int $count): string {
    $bytes = '';
    while (strlen($bytes) < $count) {
        $part = fread($socket, $count - strlen($bytes));
        requireCheck(is_string($part) && $part !== '');
        $bytes .= $part;
    }
    return $bytes;
}
function paramLength(int $length): string {
    return $length < 128 ? chr($length) : pack('N', $length | 0x80000000);
}
function fpmProbe(string $script, string $body): array {
    $socket = stream_socket_client('tcp://127.0.0.1:9000', $errorCode, $errorText, 2);
    requireCheck(is_resource($socket));
    stream_set_timeout($socket, 20);
    try {
        record($socket, 1, pack('nCx5', 1, 0));
        $params = '';
        foreach ([
            'SCRIPT_FILENAME' => $script, 'SCRIPT_NAME' => '/synthetic-upload-probe.php',
            'REQUEST_METHOD' => 'POST', 'SERVER_PROTOCOL' => 'HTTP/1.1',
            'CONTENT_TYPE' => 'multipart/form-data; boundary=CheckupinoSyntheticBoundary',
            'CONTENT_LENGTH' => (string) strlen($body),
            // Expected input-size warnings belong in stderr/logs, not probe JSON.
            // This value affects only this internal synthetic FastCGI request.
            'PHP_VALUE' => "display_errors=0\nlog_errors=1",
        ] as $name => $value) {
            $params .= paramLength(strlen($name)).paramLength(strlen($value)).$name.$value;
        }
        record($socket, 4, $params);
        record($socket, 4, '');
        for ($offset = 0; $offset < strlen($body); $offset += 65535) {
            record($socket, 5, substr($body, $offset, 65535));
        }
        record($socket, 5, '');
        $output = '';
        do {
            $header = unpack('Cversion/Ctype/nrequest/nlength/Cpadding/Creserved', readExact($socket, 8));
            requireCheck($header['version'] === 1 && $header['request'] === 1);
            $content = $header['length'] ? readExact($socket, $header['length']) : '';
            if ($header['padding']) { readExact($socket, $header['padding']); }
            if ($header['type'] === 6) { $output .= $content; }
            if ($header['type'] === 3) {
                $end = unpack('Nstatus/Cprotocol', $content);
                requireCheck($end['status'] === 0 && $end['protocol'] === 0);
            }
        } while ($header['type'] !== 3);
        $parts = explode("\r\n\r\n", $output, 2);
        requireCheck(count($parts) === 2);
        return json_decode($parts[1], true, flags: JSON_THROW_ON_ERROR);
    } finally { fclose($socket); }
}
$base = tempnam('/tmp', 'checkupino-upload-probe-');
requireCheck(is_string($base));
$script = $base.'.php';
requireCheck(!file_exists($script));
requireCheck(rename($base, $script));
try {
    $source = <<<'PROBE'
<?php
header('Content-Type: application/json');
$file = $_FILES['file'] ?? null;
echo json_encode([
    'sapi' => PHP_SAPI, 'uid' => posix_geteuid(),
    'uploadMaxFilesize' => ini_get('upload_max_filesize'),
    'postMaxSize' => ini_get('post_max_size'), 'memoryLimit' => ini_get('memory_limit'),
    'file' => $file ? ['error' => $file['error'], 'bytes' => $file['size'],
        'actualBytes' => is_uploaded_file($file['tmp_name']) ? filesize($file['tmp_name']) : null] : null,
], JSON_THROW_ON_ERROR);
PROBE;
    requireCheck(file_put_contents($script, $source) !== false);
    $prefix = "--CheckupinoSyntheticBoundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"synthetic.pdf\"\r\nContent-Type: application/pdf\r\n\r\n";
    $suffix = "\r\n--CheckupinoSyntheticBoundary--\r\n";
    $max = 10 * 1024 * 1024;
    $atLimit = fpmProbe($script, $prefix.str_pad("%PDF-1.4\n% synthetic transport fixture\n", $max, ' ').$suffix);
    requireCheck($atLimit['sapi'] === 'fpm-fcgi' && $atLimit['uid'] === 33);
    requireCheck($atLimit['uploadMaxFilesize'] === '10M' && $atLimit['postMaxSize'] === '12M');
    requireCheck($atLimit['memoryLimit'] === '128M');
    requireCheck($atLimit['file'] === ['error' => 0, 'bytes' => $max, 'actualBytes' => $max]);
    $overFile = fpmProbe($script, $prefix.str_repeat(' ', $max + 1).$suffix);
    requireCheck($overFile['file']['error'] === UPLOAD_ERR_INI_SIZE);
    $overPost = fpmProbe($script, str_repeat(' ', 12 * 1024 * 1024 + 1));
    requireCheck($overPost['file'] === null);
    echo json_encode(['atFileLimit' => $atLimit, 'overFileLimit' => $overFile,
        'overPostLimit' => $overPost], JSON_THROW_ON_ERROR), PHP_EOL;
} finally {
    if (is_file($script)) { requireCheck(unlink($script)); }
}
`;

const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], {
  input: php, encoding: 'utf8', windowsHide: true, timeout: 60000,
});
assert.equal(result.status, 0, 'Private FPM synthetic parsing checks must pass.');
const fpm = JSON.parse(result.stdout);

const endpoint = 'http://localhost:8080/api/reservations/synthetic-limit-reservation/medical-requests/synthetic-limit-request/files';
const multipart = new FormData();
multipart.set('file', new Blob([Buffer.alloc(10 * 1024 * 1024, 32)], { type: 'application/pdf' }), 'synthetic.pdf');
const guest = await fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json' },
  body: multipart, signal: AbortSignal.timeout(30000) });
assert.equal(guest.status, 401, 'A permitted body must still be denied without authentication.');
await guest.body?.cancel();
const oversized = await fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/octet-stream' },
  body: Buffer.alloc(12 * 1024 * 1024 + 1, 32), signal: AbortSignal.timeout(30000) });
assert.equal(oversized.status, 413, 'Nginx must reject a body one byte above 12 MiB.');
await oversized.body?.cancel();

const evidence = {
  dateAsiaTehran: '2026-10-07', checkedAtUtc: new Date().toISOString(),
  scope: 'Synthetic development-backend upload transport only; no medical row or authenticated upload',
  fpm, http: { guestAtFileLimit: guest.status, oneByteOverBodyLimit: oversized.status },
  privateProbeRemoved: true,
  limitations: ['No actual scanner/worker acceptance', 'No deployed medical workflow or real-patient acceptance',
    'No production-backend image acceptance', 'Quotas, throttling and concurrency remain open'],
};
writeFileSync(fileURLToPath(new URL('../../docs/deployment/evidence/demo-upload-limits-runtime-2026-10-07.json', import.meta.url)),
  JSON.stringify(evidence, null, 2) + '\n');
console.log('Private www-data FPM file/body boundaries and HTTP 401/413 pass; synthetic evidence saved.');
