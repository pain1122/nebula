<?php

namespace App\Services;

use App\Jobs\ScanReservationFile;
use App\Models\ReservationFile;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Throwable;

class MedicalScanQueue
{
    public function enqueue(ReservationFile $file): void
    {
        if (! config('medical.scanner.enabled', false)) {
            return;
        }
        $config = config('queue.connections.medical-scan', []);
        $database = $file->getConnection()->getName();
        if (($config['driver'] ?? null) !== 'database' || ($config['queue'] ?? null) !== 'medical-scan'
            || ($config['table'] ?? null) !== 'jobs' || ($config['after_commit'] ?? null) !== false
            || ($config['connection'] ?? DB::getDefaultConnection()) !== $database
            || ($config['retry_after'] ?? 0) <= 120 || $file->getConnection()->transactionLevel() < 1) {
            throw new DomainException('Medical scanning requires its isolated transactional database queue.');
        }
        try {
            Queue::connection('medical-scan')->push(new ScanReservationFile($file->public_id, $file->checksum_sha256), '', 'medical-scan');
        } catch (Throwable) {
            throw new RuntimeException('Medical scan dispatch failed; the upload was not accepted.');
        }
    }
}
