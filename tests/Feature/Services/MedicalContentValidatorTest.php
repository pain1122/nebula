<?php

namespace Tests\Feature\Services;

use App\Services\MedicalContentValidator;
use App\Support\MedicalContentPolicy;
use DomainException;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;
use Tests\Fixtures\SyntheticMedicalFiles;
use Tests\TestCase;

class MedicalContentValidatorTest extends TestCase
{
    public function test_unsupported_content_and_mime_mismatch_are_blocked_without_parser(): void
    {
        foreach ([['PK synthetic ZIP', 'application/zip'], [SyntheticMedicalFiles::pdf(), 'image/png'], ['', 'application/pdf']] as [$bytes, $mime]) {
            $this->rejects($bytes, $mime);
        }
    }

    public function test_missing_parser_fails_closed_without_exposing_diagnostics(): void
    {
        $validator = new class extends MedicalContentValidator
        {
            protected function run(array $command, MedicalContentPolicy $policy, float $deadline): array
            {
                throw new \RuntimeException('secret /path patient document text');
            }
        };
        $this->rejects(SyntheticMedicalFiles::pdf(), 'application/pdf', $validator);
    }

    public function test_invalid_pdf_parser_contracts_and_revisions_fail_closed(): void
    {
        $valid = ['version' => 2, 'qpdf' => [
            ['jsonversion' => 2], ['trailer' => ['value' => ['/Root' => '1 0 R']], 'obj:1 0 R' => ['value' => ['/Type' => '/Catalog']]],
        ], 'pages' => [['object' => '3 0 R']]];
        $make = static fn (array $json, int $check = 0, int $encrypted = 2, string $version = '12.4.2', bool $mutate = false): MedicalContentValidator => new class($json, $check, $encrypted, $version, $mutate) extends MedicalContentValidator
        {
            public function __construct(private array $json, private int $check, private int $encrypted, private string $version, private bool $mutate) {}

            protected function run(array $command, MedicalContentPolicy $policy, float $deadline): array
            {
                if (in_array('--version', $command, true)) {
                    return ['exit' => 0, 'out' => 'qpdf version '.$this->version."\n"];
                }
                if (in_array('--is-encrypted', $command, true)) {
                    return ['exit' => $this->encrypted, 'out' => ''];
                }
                if (in_array('--check', $command, true)) {
                    return ['exit' => $this->check, 'out' => ''];
                }
                if ($this->mutate) {
                    config(['medical_content.pdf.max_pages' => 199]);
                }

                return ['exit' => 0, 'out' => json_encode($this->json, JSON_THROW_ON_ERROR)];
            }
        };
        $this->assertSame('qpdf-12.4.2/medical-v1', $this->validate(SyntheticMedicalFiles::pdf(), 'application/pdf', $make($valid))['content_validator']);
        foreach ([$make($valid, check: 3), $make($valid, encrypted: 0), $make($valid, version: '12.3.0'), $make([]),
            $make(array_replace($valid, ['pages' => []])),
            $make(array_replace($valid, ['version' => 1])),
        ] as $validator) {
            $this->rejects(SyntheticMedicalFiles::pdf(), 'application/pdf', $validator);
        }
        foreach (['/JS', '/EmbeddedFiles', 'n:/binary#a0'] as $name) {
            $json = $valid;
            $json['qpdf'][1]['obj:1 0 R']['value'][$name] = 'u:synthetic';
            $this->rejects(SyntheticMedicalFiles::pdf(), 'application/pdf', $make($json));
        }
        $this->rejects(SyntheticMedicalFiles::pdf(), 'application/pdf', $make($valid, mutate: true));
    }

    public function test_process_output_timeout_and_environment_are_bounded(): void
    {
        $runner = new class extends MedicalContentValidator
        {
            public function child(array $command): array
            {
                $policy = MedicalContentPolicy::current();

                return $this->run($command, $policy, microtime(true) + $policy->rules['resources']['timeout_seconds']);
            }
        };
        putenv('CHECKUPINO_SYNTHETIC_SECRET=must-not-inherit');
        $_ENV['CHECKUPINO_SYNTHETIC_ENV_SECRET'] = 'must-not-inherit';
        $_SERVER['CHECKUPINO_SYNTHETIC_SERVER_SECRET'] = 'must-not-inherit';
        try {
            $result = $runner->child([PHP_BINARY, '-n', '-r', 'echo getenv("CHECKUPINO_SYNTHETIC_SECRET") === false && getenv("CHECKUPINO_SYNTHETIC_ENV_SECRET") === false && getenv("CHECKUPINO_SYNTHETIC_SERVER_SECRET") === false ? "isolated" : "leaked";']);
            $this->assertSame(['exit' => 0, 'out' => 'isolated'], $result);
            config(['medical_content.resources.max_output_bytes' => 1024]);
            try {
                $runner->child([PHP_BINARY, '-n', '-r', 'echo str_repeat("x", 2048);']);
                $this->fail('Oversized parser output must be rejected.');
            } catch (DomainException) {
                $this->assertTrue(true);
            }
            config(['medical_content.resources.timeout_seconds' => 1]);
            $this->expectException(\Symfony\Component\Process\Exception\ProcessTimedOutException::class);
            $runner->child([PHP_BINARY, '-n', '-r', 'sleep(3);']);
        } finally {
            putenv('CHECKUPINO_SYNTHETIC_SECRET');
            unset($_ENV['CHECKUPINO_SYNTHETIC_ENV_SECRET'], $_SERVER['CHECKUPINO_SYNTHETIC_SERVER_SECRET']);
        }
    }

    public function test_pdf_positive_path_and_policy_revision_using_real_parser(): void
    {
        $this->requireParsers();
        $bytes = SyntheticMedicalFiles::pdf();
        $facts = $this->validate($bytes, 'application/pdf');
        $this->assertSame([
            'content_policy_revision' => MedicalContentPolicy::current()->revision,
            'content_validator' => 'qpdf-12.4.2/medical-v1',
        ], $facts);
        $this->assertStringNotContainsString('Synthetic content', json_encode($facts));
    }

    #[DataProvider('forbiddenPdfContent')]
    public function test_real_parser_rejects_pdf_actions_attachments_and_forms(string $extra): void
    {
        $this->requireParsers();
        $this->rejects(SyntheticMedicalFiles::pdf($extra), 'application/pdf');
    }

    public static function forbiddenPdfContent(): array
    {
        return [
            ['/OpenAction << /S /JavaScript /JS (synthetic) >>'],
            ['/Open#41ction << /S /Java#53cript /J#53 (synthetic) >>'],
            ['/AA << /WC << /S /Launch /F (synthetic) >> >>'],
            ['/Names << /EmbeddedFiles << /Names [] >> >>'],
            ['/AcroForm << /Fields [] >>'],
            ['/A << /S /URI /URI (https://example.invalid) >>'],
        ];
    }

    public function test_real_parser_rejects_encrypted_including_empty_password_and_compressed_actions(): void
    {
        $this->requireParsers();
        foreach (['', 'synthetic-password'] as $password) {
            $this->rejects($this->transform(SyntheticMedicalFiles::pdf(), ['--encrypt', $password, 'synthetic-owner', '256', '--']), 'application/pdf');
        }
        $compressed = $this->transform(SyntheticMedicalFiles::pdf('/Open#41ction << /S /JavaScript /JS (synthetic) >>'), ['--object-streams=generate']);
        $this->rejects($compressed, 'application/pdf');
    }

    public function test_real_parser_rejects_malformed_warning_only_page_and_object_limits(): void
    {
        $this->requireParsers();
        $this->rejects("%PDF-1.4\n% synthetic malformed\n%%EOF\n", 'application/pdf');
        $this->rejects(preg_replace('/startxref\n[0-9]+/', "startxref\n1", SyntheticMedicalFiles::pdf()), 'application/pdf');
        config(['medical_content.pdf.max_pages' => 1]);
        $this->rejects(SyntheticMedicalFiles::pdf(pages: 2), 'application/pdf');
        config(['medical_content.pdf.max_objects' => 1]);
        $this->rejects(SyntheticMedicalFiles::pdf(), 'application/pdf');
    }

    public function test_real_image_decoder_accepts_png_jpeg_and_rejects_truncation_trailing_bytes_and_pixel_limit(): void
    {
        $this->requireParsers();
        $image = imagecreatetruecolor(2, 2);
        foreach (['image/png' => 'imagepng', 'image/jpeg' => 'imagejpeg'] as $mime => $encode) {
            ob_start();
            $encode($image);
            $bytes = ob_get_clean();
            $facts = $this->validate($bytes, $mime);
            $this->assertStringStartsWith('gd-', $facts['content_validator']);
            $this->assertSame(MedicalContentPolicy::current()->revision, $facts['content_policy_revision']);
            $this->rejects(substr($bytes, 0, -12), $mime);
            $this->rejects($bytes.'synthetic trailing content', $mime);
            $terminator = $mime === 'image/png' ? "\x00\x00\x00\x00IEND\xae\x42\x60\x82" : "\xff\xd9";
            $this->rejects(substr($bytes, 0, intdiv(strlen($bytes), 2)).$terminator, $mime);
            config(['medical_content.image.max_pixels' => 1]);
            $this->rejects($bytes, $mime);
            config(['medical_content.image.max_pixels' => 16000000]);
            foreach (['max_width', 'max_height'] as $dimension) {
                config(['medical_content.image.'.$dimension => 1]);
                $this->rejects($bytes, $mime);
                config(['medical_content.image.'.$dimension => 8192]);
            }
        }
        imagedestroy($image);
    }

    private function requireParsers(): void
    {
        if (! is_executable('/usr/local/bin/qpdf') || ! extension_loaded('gd')) {
            if (getenv('CHECKUPINO_CONTENT_PARSER_ACCEPTANCE') === '1') {
                $this->fail('Parser acceptance requires the approved qpdf/GD image.');
            }
            $this->markTestSkipped('Build the approved parser image for real-parser acceptance.');
        }
    }

    private function validate(string $bytes, string $mime, ?MedicalContentValidator $validator = null): array
    {
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, $bytes);
        try {
            return ($validator ?? app(MedicalContentValidator::class))->validate($stream, $mime);
        } finally {
            fclose($stream);
        }
    }

    private function rejects(string $bytes, string $mime, ?MedicalContentValidator $validator = null): void
    {
        $before = glob(sys_get_temp_dir().'/checkupino-content-*');
        try {
            $this->validate($bytes, $mime, $validator);
            $this->fail('Unsupported or invalid content must stay blocked.');
        } catch (DomainException $exception) {
            $this->assertSame('Medical content validation did not pass; file access remains blocked.', $exception->getMessage());
        }
        $this->assertSame($before, glob(sys_get_temp_dir().'/checkupino-content-*'));
    }

    private function transform(string $bytes, array $arguments): string
    {
        $input = tempnam(sys_get_temp_dir(), 'checkupino-pdf-fixture-');
        $output = tempnam(sys_get_temp_dir(), 'checkupino-pdf-fixture-');
        try {
            file_put_contents($input, $bytes);
            (new Process(['/usr/local/bin/qpdf', ...$arguments, $input, $output]))->mustRun();

            return file_get_contents($output);
        } finally {
            unlink($input);
            unlink($output);
        }
    }
}
