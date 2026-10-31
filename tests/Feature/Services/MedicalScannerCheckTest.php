<?php

namespace Tests\Feature\Services;

use App\Enums\ReservationFileScanStatus;
use App\Services\ClamdScanner;
use App\Support\MedicalScanVerdict;
use RuntimeException;
use Tests\TestCase;

class MedicalScannerCheckTest extends TestCase
{
    public function test_default_command_does_not_contact_the_scanner(): void
    {
        $this->mock(ClamdScanner::class)->shouldNotReceive('scan');
        $this->artisan('medical:scanner-check')->assertSuccessful();
    }

    public function test_probe_requires_both_correct_content_identity_and_clean_infected_results(): void
    {
        $calls = 0;
        $this->mock(ClamdScanner::class)->shouldReceive('scan')->twice()->andReturnUsing(function ($stream) use (&$calls): MedicalScanVerdict {
            $content = stream_get_contents($stream);
            $status = ++$calls === 1 ? ReservationFileScanStatus::Clean : ReservationFileScanStatus::Infected;
            if ($calls === 2) {
                $this->assertSame(68, strlen($content));
                $this->assertStringContainsString('EICAR-STANDARD-ANTIVIRUS-TEST-FILE', $content);
            }

            return new MedicalScanVerdict($status, hash('sha256', $content), '1.5.4', '999999', now()->toIso8601String());
        });
        $this->artisan('medical:scanner-check', ['--probe' => true])->assertSuccessful();
    }

    public function test_engine_that_marks_the_test_marker_clean_cannot_pass_acceptance(): void
    {
        $this->mock(ClamdScanner::class)->shouldReceive('scan')->twice()->andReturnUsing(fn ($stream) => new MedicalScanVerdict(ReservationFileScanStatus::Clean, hash('sha256', stream_get_contents($stream)), '1.5.4', '999999', now()->toIso8601String()));
        $this->artisan('medical:scanner-check', ['--probe' => true])->assertFailed();
    }

    public function test_probe_errors_do_not_leak_raw_scanner_details(): void
    {
        $this->mock(ClamdScanner::class)->shouldReceive('scan')->once()->andThrow(new RuntimeException('private-secret/raw-patient-path'));
        $this->artisan('medical:scanner-check', ['--probe' => true])
            ->expectsOutput('Medical scanner acceptance failed; check protected socket, engine readiness and fresh definitions.')
            ->doesntExpectOutputToContain('private-secret')
            ->doesntExpectOutputToContain('raw-patient-path')
            ->assertFailed();
    }
}
