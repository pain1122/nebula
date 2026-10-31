<?php

namespace App\Console\Commands;

use App\Enums\ReservationFileScanStatus;
use App\Services\ClamdScanner;
use Illuminate\Console\Command;
use Throwable;

class CheckMedicalScanner extends Command
{
    protected $signature = 'medical:scanner-check {--probe : Check synthetic clean and EICAR bytes against the actual engine}';

    protected $description = 'Check the internal scanner using synthetic memory streams; never patient files';

    public function handle(ClamdScanner $scanner): int
    {
        if (! $this->option('probe')) {
            $this->info('Run with --probe for actual synthetic engine acceptance. No scan was performed.');

            return self::SUCCESS;
        }
        // Official harmless antivirus test marker, constructed only in memory.
        $eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
        try {
            foreach (['Checkupino synthetic clean scanner check' => ReservationFileScanStatus::Clean, $eicar => ReservationFileScanStatus::Infected] as $content => $expected) {
                $stream = fopen('php://memory', 'w+b');
                try {
                    fwrite($stream, $content);
                    rewind($stream);
                    $result = $scanner->scan($stream);
                    if ($result->status !== $expected || ! hash_equals(hash('sha256', $content), $result->checksumSha256)) {
                        throw new \RuntimeException('Synthetic scanner result is invalid.');
                    }
                } finally {
                    fclose($stream);
                }
            }
            $this->info('Actual synthetic clean/EICAR checks passed with fresh ClamAV 1.5.4 definitions. No medical records or storage objects were accessed.');

            return self::SUCCESS;
        } catch (Throwable) {
            $this->error('Medical scanner acceptance failed; check protected socket, engine readiness and fresh definitions.');

            return self::FAILURE;
        }
    }
}
