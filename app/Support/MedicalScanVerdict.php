<?php

namespace App\Support;

use App\Enums\ReservationFileScanStatus;

final readonly class MedicalScanVerdict
{
    public function __construct(
        public ReservationFileScanStatus $status,
        public string $checksumSha256,
        public string $engineVersion,
        public string $databaseVersion,
        public string $databaseUpdatedAt,
    ) {}

    /** @return array<string, string> */
    public function auditFacts(): array
    {
        return [
            'scanner_engine' => 'clamav',
            'scanner_version' => $this->engineVersion,
            'scanner_database_version' => $this->databaseVersion,
            'scanner_database_updated_at' => $this->databaseUpdatedAt,
            'scan_checksum_sha256' => $this->checksumSha256,
        ];
    }
}
