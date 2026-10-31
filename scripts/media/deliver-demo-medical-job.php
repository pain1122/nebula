<?php

// Ordinary encrypted queue delivery only. This helper cannot create or requeue jobs.
if ($argc !== 2 || ! in_array($argv[1], ['--inspect', '--deliver'], true)) {
    fwrite(STDERR, "Only --inspect or --deliver is accepted.\n");
    exit(2);
}

require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (posix_geteuid() !== 33 || $app->configurationIsCached()
    || config('database.default') !== 'mysql' || config('medical.scanner.enabled') !== true
    || config('filesystems.disks.private.driver') !== 'local') {
    throw new RuntimeException('Dedicated worker configuration rejected.');
}
$proof = json_decode(file_get_contents('/var/www/docs/deployment/evidence/demo-upload-accepted-2026-10-11.json'), true, flags: JSON_THROW_ON_ERROR);
if (($proof['acceptance'] ?? null) !== 'passed' || ($proof['request_id'] ?? null) !== '01m4hfgan168p6q5ftp528285f'
    || ! preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/iD', $proof['receipt']['public_id'] ?? '')
    || strtoupper($proof['receipt']['public_id']) === '01M4DN9XK0Z7CKQ2GFBHSACA6H') {
    throw new RuntimeException('Accepted fresh synthetic browser upload required.');
}
$db = Illuminate\Support\Facades\DB::connection();
$lock = $db->selectOne("SELECT GET_LOCK('checkupino-demo-medical-one-job', 0) AS acquired");
if ((int) $lock->acquired !== 1) {
    throw new RuntimeException('Another controlled delivery is active.');
}
$snapshot = static function () use ($db): array {
    $hashes = [];
    foreach (['reservation_medical_requests', 'reservation_files', 'reservation_reports', 'jobs', 'setting_values', 'reservations', 'reservation_payment_summaries', 'payment_attempts', 'outbox_events'] as $table) {
        $hashes[$table] = hash('sha256', json_encode($db->table($table)->orderBy('id')->get(), JSON_THROW_ON_ERROR));
    }
    $hashes['protected'] = hash('sha256', json_encode(App\Models\User::whereIn('id', [7, 8])->with('roles:id,name')->get(['id', 'public_id', 'account_state', 'patient_status', 'updated_at'])->toArray(), JSON_THROW_ON_ERROR));
    $hashes['existing_audits'] = hash('sha256', json_encode(App\Models\AuditEvent::where('id', '<=', 9)->orderBy('id')->get()->toArray(), JSON_THROW_ON_ERROR));
    $hashes['original_file'] = hash('sha256', json_encode($db->table('reservation_files')->where('public_id', '01M4DN9XK0Z7CKQ2GFBHSACA6H')->first(), JSON_THROW_ON_ERROR));
    $hashes['failed_jobs'] = hash('sha256', json_encode($db->table('failed_jobs')->orderBy('id')->get(), JSON_THROW_ON_ERROR));

    return $hashes;
};
try {
    $db->statement('START TRANSACTION READ ONLY');
    try {
        $file = App\Models\ReservationFile::where('public_id', $proof['receipt']['public_id'])->firstOrFail();
        $request = $file->medicalRequest;
        if ($file->reservation_id !== 8 || $file->uploaded_by !== 4 || $file->disk !== 'private'
            || $file->classification !== 'medical' || $file->mime_type !== 'application/pdf'
            || $file->size_bytes !== $proof['synthetic_bytes'] || $file->size_bytes < 1 || $file->size_bytes > 524288
            || $file->checksum_sha256 !== $proof['synthetic_sha256']
            || $file->scan_status !== App\Enums\ReservationFileScanStatus::Quarantined || $file->scanned_at !== null
            || ($file->retention_until !== null && ! $file->retention_until->isFuture())
            || $request->public_id !== '01m4hfgan168p6q5ftp528285f' || $request->status !== App\Enums\ReservationMedicalRequestStatus::Open
            || App\Models\ReservationMedicalRequest::count() !== 2 || App\Models\ReservationFile::count() !== 2
            || App\Models\ReservationReport::count() !== 0 || $db->table('jobs')->count() !== 1) {
            throw new RuntimeException('Exact new quarantine and one-job checkpoint required.');
        }
        $row = $db->table('jobs')->first();
        if ($row->queue !== 'medical-scan' || $row->reserved_at !== null || (int) $row->attempts !== 0 || (int) $row->available_at > time()) {
            throw new RuntimeException('One untouched ready dedicated job required.');
        }
        $payload = json_decode($row->payload, true, flags: JSON_THROW_ON_ERROR);
        if (($payload['displayName'] ?? null) !== App\Jobs\ScanReservationFile::class || ! is_string($payload['data']['command'] ?? null)) {
            throw new RuntimeException('Unexpected queue payload.');
        }
        $job = unserialize(Illuminate\Support\Facades\Crypt::decrypt($payload['data']['command']), ['allowed_classes' => [App\Jobs\ScanReservationFile::class]]);
        if (! $job instanceof App\Jobs\ScanReservationFile || ! $job instanceof Illuminate\Contracts\Queue\ShouldBeEncrypted
            || $job->filePublicId !== $file->public_id || $job->checksumSha256 !== $file->checksum_sha256
            || $job->connection !== 'medical-scan' || $job->queue !== 'medical-scan') {
            throw new RuntimeException('Encrypted job target mismatch.');
        }
        $before = $snapshot();
        foreach ($proof['final']['hashes'] as $key => $hash) {
            if (($before[$key] ?? null) !== $hash) {
                throw new RuntimeException('Accepted upload checkpoint changed.');
            }
        }
        $auditCount = App\Models\AuditEvent::count();
        $result = ['acceptance' => 'passed', 'stage' => 'inspected', 'file' => $file->public_id, 'queue' => 'medical-scan', 'encrypted_target_verified' => true, 'job_id' => $row->id, 'job_consumption' => false];
    } finally {
        $db->statement('ROLLBACK');
    }
    if ($argv[1] === '--deliver') {
        // Fail before popping a job if current definitions/socket or PDF parser are unavailable.
        $bytes = Tests\Fixtures\SyntheticMedicalFiles::pdf();
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, $bytes);
        rewind($stream);
        try {
            $scan = app(App\Services\ClamdScanner::class)->scan($stream);
            if ($scan->status !== App\Enums\ReservationFileScanStatus::Clean) {
                throw new RuntimeException('Fresh engine required before queue consumption.');
            }
            rewind($stream);
            app(App\Services\MedicalContentValidator::class)->validate($stream, 'application/pdf');
        } finally {
            fclose($stream);
        }
        $process = new Symfony\Component\Process\Process([
            PHP_BINARY, 'artisan', 'queue:work', 'medical-scan', '--queue=medical-scan',
            '--sleep=0', '--tries=3', '--timeout=120', '--max-jobs=1', '--max-time=180', '--memory=128', '--stop-when-empty',
        ], '/var/www', timeout: 145);
        $process->run();
        if (! $process->isSuccessful()) {
            throw new RuntimeException('Bounded medical delivery failed; do not automatically replay.');
        }
        $db->statement('START TRANSACTION READ ONLY');
        try {
            $fresh = $file->fresh();
            $after = $snapshot();
            foreach ($before as $key => $hash) {
                if (! in_array($key, ['reservation_files', 'jobs'], true) && $after[$key] !== $hash) {
                    throw new RuntimeException('Unrelated data changed during delivery.');
                }
            }
            $audit = App\Models\AuditEvent::where('subject_public_id', $file->public_id)->where('action', 'reservation_medical_file.scan_recorded')->sole();
            if ($fresh->scan_status !== App\Enums\ReservationFileScanStatus::Clean || $fresh->scanned_at === null
                || $fresh->checksum_sha256 !== $file->checksum_sha256 || $db->table('jobs')->count() !== 0
                || App\Models\AuditEvent::count() !== $auditCount + 1 || $audit->actor_user_id !== null
                || ($audit->after['scanner_version'] ?? null) !== '1.5.4'
                || ($audit->after['scan_checksum_sha256'] ?? null) !== $file->checksum_sha256
                || ! preg_match('/^[a-f0-9]{64}$/D', $audit->after['content_policy_revision'] ?? '')) {
                throw new RuntimeException('Normal scan/content/audit completion not accepted; do not replay.');
            }
            $result = [...$result, 'stage' => 'delivered', 'job_consumption' => true, 'consumed_jobs' => 1,
                'file_status' => 'clean', 'jobs_remaining' => 0, 'scan_audit_id' => $audit->id,
                'scanner_database' => $audit->after['scanner_database_version'], 'content_policy_revision' => $audit->after['content_policy_revision'],
                'original_quarantine_unchanged' => true, 'unrelated_fingerprints_unchanged' => true];
        } finally {
            $db->statement('ROLLBACK');
        }
    }
    echo json_encode($result, JSON_THROW_ON_ERROR), PHP_EOL;
} finally {
    $db->selectOne("SELECT RELEASE_LOCK('checkupino-demo-medical-one-job')");
}
