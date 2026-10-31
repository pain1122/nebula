import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

assert.equal(process.argv.length, 2, 'This read-only checkpoint accepts no arguments.');
const source = String.raw`<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (posix_geteuid() !== 33 || config('database.default') !== 'mysql'
    || config('medical.scanner.enabled') !== false || config('filesystems.disks.private.driver') !== 'local') {
    throw new RuntimeException('Current disabled-scanning/local-storage checkpoint required.');
}
$db = Illuminate\Support\Facades\DB::connection();
$db->statement('START TRANSACTION READ ONLY');
try {
    $reservation = App\Models\Reservation::findOrFail(8);
    if ($reservation->user_id !== 4 || $reservation->doctor->user_id !== 5
        || App\Models\ReservationMedicalRequest::count() !== 2
        || App\Models\ReservationFile::count() !== 1 || App\Models\ReservationReport::count() !== 0
        || $db->table('jobs')->count() !== 0) {
        throw new RuntimeException('Accepted synthetic fixture required.');
    }
    $request = Illuminate\Http\Request::create('/api/reservations/'.$reservation->public_id.'/medical-requests', 'GET');
    $request->setUserResolver(fn () => $reservation->user);
    $response = app(App\Http\Controllers\Api\PatientMedicalOutcomeController::class)->index($request, $reservation);
    $data = $response->getData(true)['data'];
    $expected = [
        '01m4dn9fq2d38xxrh4wtkyf6s4' => ['received_count' => 1, 'awaiting_checks_count' => 1],
        '01m4hfgan168p6q5ftp528285f' => ['received_count' => 0, 'awaiting_checks_count' => 0],
    ];
    if (count($data) !== 2) { throw new RuntimeException('Unexpected requests.'); }
    foreach ($data as $row) {
        if (($expected[$row['public_id']] ?? null) !== ($row['upload_progress'] ?? null)
            || isset($row['files']) || isset($row['scan_status']) || isset($row['patient_received_count'])) {
            throw new RuntimeException('Safe owner receipt contract failed.');
        }
    }
    $request->setUserResolver(fn () => $reservation->doctor->user);
    $doctor = app(App\Http\Controllers\Api\DoctorMedicalRequestController::class)->index($request, $reservation);
    foreach ($doctor->getData(true)['data'] as $row) {
        if (array_key_exists('upload_progress', $row)) { throw new RuntimeException('Owner progress leaked.'); }
    }
    $request->setUserResolver(fn () => App\Models\User::findOrFail(3));
    $denied = app(App\Http\Controllers\Api\PatientMedicalOutcomeController::class)->index($request, $reservation);
    if ($denied->getStatusCode() !== 404) { throw new RuntimeException('Wrong owner not denied.'); }
    echo json_encode(['acceptance' => 'passed', 'owner_progress' => $expected,
        'doctor_progress_absent' => true, 'wrong_owner_denied' => true,
        'readonly_transaction' => true, 'uid' => 33, 'clinical_writes' => false], JSON_THROW_ON_ERROR);
} finally {
    $db->statement('ROLLBACK');
}
`;
const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], {
  input: source, encoding: 'utf8', windowsHide: true, timeout: 45000,
});
assert.equal(result.status, 0, 'Read-only owner progress acceptance failed; no clinical write was attempted.');
const evidence = JSON.parse(result.stdout);
assert.equal(evidence.acceptance, 'passed');
assert.equal(evidence.clinical_writes, false);
writeFileSync('docs/deployment/evidence/patient-upload-progress-runtime-2026-10-11.json', JSON.stringify({
  recorded_at: new Date().toISOString(), timezone: 'Asia/Tehran',
  scope: 'Live read-only controller/resources; no HTTP/browser upload or worker acceptance',
  ...evidence,
}, null, 2) + '\n');
console.log(JSON.stringify(evidence));
