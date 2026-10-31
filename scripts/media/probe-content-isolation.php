<?php

// Synthetic acceptance only, supplied over argv to a temporary networkless container.
require '/opt/checkupino-content/vendor/autoload.php';

use App\Support\MedicalContentPolicy;
use App\Support\MedicalContentProtocol as Protocol;
use Symfony\Component\Process\Process;

function requireCheck(bool $condition): void
{
    if (! $condition) {
        throw new RuntimeException('Isolated parser acceptance did not pass.');
    }
}

function syntheticPdf(): string
{
    $objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> >>'];
    $pdf = "%PDF-1.4\n% Synthetic content only\n";
    $offsets = [0];
    foreach ($objects as $index => $object) {
        $offsets[] = strlen($pdf);
        $pdf .= ($index + 1)." 0 obj\n".$object."\nendobj\n";
    }
    $xref = strlen($pdf);
    $pdf .= "xref\n0 4\n0000000000 65535 f \n";
    foreach (array_slice($offsets, 1) as $offset) {
        $pdf .= sprintf("%010d 00000 n \n", $offset);
    }

    return $pdf."trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF\n";
}

function exchange(string $bytes, string $mime, string $revision, bool $tamper = false): ?array
{
    $socket = stream_socket_client('unix:///run/medical-content/content.sock', $code, $error, 2);
    requireCheck(is_resource($socket));
    stream_set_blocking($socket, false);
    $header = ['version' => 1, 'nonce' => bin2hex(random_bytes(16)), 'bytes' => strlen($bytes),
        'sha256' => $tamper ? str_repeat('0', 64) : hash('sha256', $bytes), 'mime' => $mime, 'revision' => $revision];
    try {
        Protocol::write($socket, json_encode($header, JSON_THROW_ON_ERROR)."\n".$bytes, Protocol::deadline(5));
        stream_socket_shutdown($socket, STREAM_SHUT_WR);
        if ($tamper) {
            requireCheck(Protocol::read($socket, 1, Protocol::deadline(5)) === '');

            return null;
        }
        $reply = Protocol::line($socket, Protocol::deadline(12));
        Protocol::end($socket, Protocol::deadline(2));
        Protocol::assertReply($reply, $header);

        return $reply;
    } finally {
        fclose($socket);
    }
}

requireCheck(posix_geteuid() === 33 && posix_getegid() === 33);
$status = file_get_contents('/proc/self/status');
requireCheck((bool) preg_match('/^CapEff:\s+0+$/m', $status));
requireCheck((bool) preg_match('/^NoNewPrivs:\s+1$/m', $status));
requireCheck(glob('/sys/class/net/*') === ['/sys/class/net/lo']);
foreach (['/var/www/.env', '/var/www/vendor', '/var/www/app', '/var/www/storage', '/opt/checkupino-content/.env', '/var/run/docker.sock', '/opt/checkupino-content/app/Models', '/opt/checkupino-content/storage'] as $forbidden) {
    requireCheck(! file_exists($forbidden));
}
$writeProbe = '/opt/checkupino-content/.synthetic-write-probe';
$written = @file_put_contents($writeProbe, 'synthetic');
if ($written !== false) {
    unlink($writeProbe);
}
requireCheck($written === false);
requireCheck(trim(file_get_contents('/sys/fs/cgroup/memory.max')) === '536870912');
requireCheck(trim(file_get_contents('/sys/fs/cgroup/pids.max')) === '16');
requireCheck(trim(file_get_contents('/sys/fs/cgroup/memory.swap.max')) === '0');
$policy = MedicalContentPolicy::fromRules(require '/opt/checkupino-content/config/medical_content.php');
$server = new Process([PHP_BINARY, '-d', 'memory_limit=96M', '/opt/checkupino-content/scripts/media/serve-medical-content.php']);
$before = glob('/tmp/checkupino-content-*');
try {
    $server->start();
    $deadline = microtime(true) + 3;
    while (! file_exists('/run/medical-content/content.sock') && microtime(true) < $deadline && $server->isRunning()) {
        usleep(10000);
    }
    requireCheck($server->isRunning());
    $pdf = syntheticPdf();
    requireCheck(exchange($pdf, 'application/pdf', $policy->revision)['validator'] === 'qpdf-12.4.2/medical-v1');
    $image = imagecreatetruecolor(2, 2);
    foreach (['image/png' => 'imagepng', 'image/jpeg' => 'imagejpeg'] as $mime => $encode) {
        ob_start();
        $encode($image);
        $bytes = ob_get_clean();
        requireCheck(str_starts_with(exchange($bytes, $mime, $policy->revision)['validator'], 'gd-'));
    }
    imagedestroy($image);
    requireCheck(exchange($pdf, 'application/pdf', $policy->revision, true) === null);
    requireCheck(exchange($pdf, 'application/pdf', $policy->revision)['validator'] === 'qpdf-12.4.2/medical-v1');
    requireCheck(glob('/tmp/checkupino-content-*') === $before);
    echo json_encode(['uid' => 33, 'network' => 'none', 'capabilities' => 'none', 'no_new_privileges' => true,
        'root_read_only' => true, 'application_secrets_absent' => true, 'memory_bytes' => 536870912, 'pids' => 16, 'swap_bytes' => 0,
        'pdf_png_jpeg' => true, 'tamper_rejected' => true, 'subsequent_request_passes' => true, 'temporary_files_removed' => true,
        'content_policy_revision' => $policy->revision], JSON_THROW_ON_ERROR), PHP_EOL;
} finally {
    $server->stop(0);
}
