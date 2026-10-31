<?php

namespace Tests\Feature\Services;

use App\Services\MedicalContentValidator;
use App\Support\MedicalContentPolicy;
use App\Support\MedicalContentProtocol as Protocol;
use DomainException;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;
use Tests\Fixtures\SyntheticMedicalFiles;
use Tests\TestCase;

class MedicalContentIsolationTest extends TestCase
{
    private ?Process $server = null;

    private ?string $directory = null;

    protected function tearDown(): void
    {
        $this->server?->stop(0);
        if ($this->directory !== null) {
            foreach (glob($this->directory.'/*') ?: [] as $path) {
                unlink($path);
            }
            rmdir($this->directory);
        }
        parent::tearDown();
    }

    public function test_unavailable_isolated_parser_never_falls_back_to_installed_native_tools(): void
    {
        config(['medical_parser.test_inline' => false, 'medical_parser.socket' => '/tmp/checkupino-absent-'.bin2hex(random_bytes(8)).'.sock']);
        $this->rejects(SyntheticMedicalFiles::pdf());
    }

    public function test_production_ignores_test_inline_execution_setting(): void
    {
        $this->app->instance('env', 'production');
        config(['medical_parser.test_inline' => true, 'medical_parser.socket' => '/tmp/checkupino-absent-'.bin2hex(random_bytes(8)).'.sock']);
        $this->rejects(SyntheticMedicalFiles::pdf());
    }

    public function test_real_isolated_protocol_accepts_identity_bound_pdf_and_images_without_client_parsing(): void
    {
        $this->startServer();
        $facts = $this->validate(SyntheticMedicalFiles::pdf());
        $this->assertSame('qpdf-12.4.2/medical-v1', $facts['content_validator']);
        $this->assertSame(MedicalContentPolicy::current()->revision, $facts['content_policy_revision']);
        $image = imagecreatetruecolor(2, 2);
        foreach (['image/png' => 'imagepng', 'image/jpeg' => 'imagejpeg'] as $mime => $encoder) {
            ob_start();
            $encoder($image);
            $bytes = ob_get_clean();
            $this->assertStringStartsWith('gd-', $this->validate($bytes, $mime)['content_validator']);
        }
        imagedestroy($image);
        $this->rejects(SyntheticMedicalFiles::pdf('/OpenAction << /S /JavaScript /JS (synthetic) >>'));
        $this->rejects("%PDF-1.4\n synthetic malformed\n%%EOF\n");
        // A rejected request does not poison the following valid request.
        $this->assertSame('qpdf-12.4.2/medical-v1', $this->validate(SyntheticMedicalFiles::pdf())['content_validator']);
    }

    public function test_server_rejects_truncated_tampered_extra_bytes_and_old_policy_then_recovers(): void
    {
        $this->startServer();
        $bytes = SyntheticMedicalFiles::pdf();
        foreach (['checksum', 'short', 'extra', 'revision', 'unknown'] as $failure) {
            $socket = stream_socket_client('unix://'.config('medical_parser.socket'));
            stream_set_blocking($socket, false);
            $header = $this->header($bytes);
            if ($failure === 'checksum') {
                $header['sha256'] = str_repeat('0', 64);
            } elseif ($failure === 'revision') {
                $header['revision'] = str_repeat('0', 64);
            } elseif ($failure === 'unknown') {
                $header['path'] = '/do-not-open';
            }
            $body = match ($failure) {
                'short' => substr($bytes, 0, -1),
                'extra' => $bytes.'x',
                default => $bytes,
            };
            Protocol::write($socket, json_encode($header)."\n".$body, Protocol::deadline(2));
            stream_socket_shutdown($socket, STREAM_SHUT_WR);
            $this->assertSame('', Protocol::read($socket, 1, Protocol::deadline(2)));
            fclose($socket);
        }
        $this->assertSame('qpdf-12.4.2/medical-v1', $this->validate($bytes)['content_validator']);
    }

    public function test_crashed_supervisor_socket_is_recovered_without_removing_an_active_owner_socket(): void
    {
        $this->startServer();
        $path = config('medical_parser.socket');
        $competitor = new Process([PHP_BINARY, base_path('scripts/media/serve-medical-content.php'), $path]);
        $this->assertSame(1, $competitor->run());
        $this->assertTrue($this->server->isRunning());
        $this->assertSame('qpdf-12.4.2/medical-v1', $this->validate(SyntheticMedicalFiles::pdf())['content_validator']);
        $this->server->signal(SIGKILL);
        $this->server->wait();
        $this->assertNotFalse(lstat($path));
        $this->server = null;
        $this->startServer();
        $this->assertSame('qpdf-12.4.2/medical-v1', $this->validate(SyntheticMedicalFiles::pdf())['content_validator']);
    }

    public function test_recovery_refuses_regular_files_and_symlinks_instead_of_deleting_them(): void
    {
        $this->directory = sys_get_temp_dir().'/checkupino-isolation-'.bin2hex(random_bytes(8));
        mkdir($this->directory, 0700);
        $path = $this->directory.'/content.sock';
        file_put_contents($path, 'synthetic sentinel');
        $process = new Process([PHP_BINARY, base_path('scripts/media/serve-medical-content.php'), $path]);
        $this->assertSame(1, $process->run());
        $this->assertSame('synthetic sentinel', file_get_contents($path));
        unlink($path);
        symlink($path.'.lock', $path);
        $this->assertSame(1, $process->run());
        $this->assertTrue(is_link($path));
    }

    #[DataProvider('badHeaders')]
    public function test_protocol_rejects_unbounded_or_ambiguous_header_fields(string $field, mixed $value): void
    {
        $header = $this->header('synthetic');
        $header[$field] = $value;
        $this->expectException(DomainException::class);
        Protocol::assertHeader($header, MedicalContentPolicy::current());
    }

    public static function badHeaders(): array
    {
        return [['version', 2], ['bytes', 0], ['bytes', Protocol::MAX_BYTES + 1], ['bytes', '5'],
            ['mime', 'application/zip'], ['nonce', 'bad'], ['sha256', str_repeat('g', 64)],
            ['revision', str_repeat('0', 64)], ['path', '/secret']];
    }

    public function test_protocol_rejects_replayed_or_mismatched_replies_and_expired_io(): void
    {
        $header = $this->header('synthetic');
        $reply = [...$header, 'ok' => true, 'validator' => 'qpdf-12.4.2/medical-v1'];
        Protocol::assertReply($reply, $header);
        foreach (['nonce', 'sha256', 'revision', 'bytes', 'validator', 'ok', 'extra'] as $key) {
            $bad = $reply;
            $bad[$key] = 'invalid';
            try {
                Protocol::assertReply($bad, $header);
                $this->fail('Mismatched reply accepted.');
            } catch (DomainException) {
                $this->assertTrue(true);
            }
        }
        [$read, $write] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
        try {
            stream_set_blocking($read, false);
            Protocol::write($write, str_repeat('a', Protocol::MAX_HEADER), Protocol::deadline(1));
            try {
                Protocol::line($read, Protocol::deadline(1));
                $this->fail('Oversize header accepted.');
            } catch (DomainException) {
                $this->assertTrue(true);
            }
            $this->expectException(DomainException::class);
            Protocol::read($read, 1, hrtime(true) - 1);
        } finally {
            fclose($read);
            fclose($write);
        }
    }

    private function startServer(): void
    {
        if (! is_executable('/usr/local/bin/qpdf') || ! extension_loaded('gd')) {
            $this->fail('Isolation acceptance requires the approved qpdf/GD image.');
        }
        if ($this->directory === null) {
            $this->directory = sys_get_temp_dir().'/checkupino-isolation-'.bin2hex(random_bytes(8));
            mkdir($this->directory, 0700);
        }
        $path = $this->directory.'/content.sock';
        config(['medical_parser.test_inline' => false, 'medical_parser.socket' => $path]);
        $this->server = new Process([PHP_BINARY, base_path('scripts/media/serve-medical-content.php'), $path], timeout: 15);
        $this->server->start();
        $deadline = microtime(true) + 3;
        while (microtime(true) < $deadline && $this->server->isRunning()) {
            $socket = @stream_socket_client('unix://'.$path, $code, $error, 0.1);
            if (is_resource($socket)) {
                fclose($socket);

                return;
            }
            usleep(10000);
        }
        $this->fail('Synthetic parser supervisor did not start.');
    }

    private function header(string $bytes): array
    {
        return ['version' => 1, 'nonce' => str_repeat('a', 32), 'bytes' => strlen($bytes), 'sha256' => hash('sha256', $bytes),
            'mime' => 'application/pdf', 'revision' => MedicalContentPolicy::current()->revision];
    }

    private function validate(string $bytes, string $mime = 'application/pdf'): array
    {
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, $bytes);
        try {
            return app(MedicalContentValidator::class)->validate($stream, $mime);
        } finally {
            fclose($stream);
        }
    }

    private function rejects(string $bytes): void
    {
        try {
            $this->validate($bytes);
            $this->fail('Content must stay blocked.');
        } catch (DomainException $exception) {
            $this->assertSame('Medical content validation did not pass; file access remains blocked.', $exception->getMessage());
        }
    }
}
