import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

assert.equal(process.argv.length, 2, 'Read-only profile verification accepts no arguments.');
const inspect = spawnSync('docker', ['inspect', '--format', '{{.Image}}', 'checkupino_app'], {
  encoding: 'utf8', windowsHide: true, timeout: 10000,
});
assert.equal(inspect.status, 0, 'Existing backend required.');
assert.equal(inspect.stdout.trim(), 'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
const php = `<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
if (posix_geteuid() !== 33 || config('database.default') !== 'mysql') { throw new RuntimeException('Fixed read-only MySQL context required.'); }
Illuminate\\Support\\Facades\\DB::statement('SET TRANSACTION READ ONLY');
Illuminate\\Support\\Facades\\DB::beginTransaction();
try {
    $service = app(App\\Services\\PanelProfileService::class);
    $admin = App\\Models\\User::with('roles')->findOrFail(2);
    $patient = App\\Models\\User::with('roles')->findOrFail(4);
    $doctor = App\\Models\\User::with('roles')->findOrFail(5);
    if (! $admin->hasRole('admin') || ! $patient->hasRole('patient') || ! $doctor->hasRole('doctor')) { throw new RuntimeException('Synthetic actor roles changed.'); }
    $support = $service->read($admin, $patient, true);
    $self = $service->read($patient, $patient, false);
    $doctorView = $service->read($admin, $doctor, true);
    if ($self['user'] !== $support['user'] || $self['summary'] !== $support['summary']) { throw new RuntimeException('Shared overview contract differs.'); }
    $forbidden = ['email','phone','password','NID','birth_date','bio','city','country','zip_code','profile','tokens','sessions'];
    if (array_intersect(array_keys($support['user']), $forbidden)) { throw new RuntimeException('Private user fields exposed.'); }
    foreach ($support['reports'] as $report) {
        if (array_keys($report) !== ['public_id','status','published_at','is_amendment']) { throw new RuntimeException('Unexpected report field.'); }
    }
    foreach ($support['submissions'] as $submission) {
        if (array_keys($submission) !== ['public_id','status','created_at']) { throw new RuntimeException('Unexpected questionnaire field.'); }
    }
    foreach ($support['activity'] as $event) {
        if (array_keys($event) !== ['public_id','action','created_at']) { throw new RuntimeException('Unexpected activity field.'); }
    }
    $denied = false;
    try { $service->read($admin, App\\Models\\User::with('roles')->findOrFail(1), true); }
    catch (Symfony\\Component\\HttpKernel\\Exception\\HttpException $exception) { $denied = $exception->getStatusCode() === 403; }
    if (! $denied) { throw new RuntimeException('Root subject boundary failed.'); }
    $doctorRequest = Illuminate\\Http\\Request::create('/api/admin/doctors', 'GET');
    $doctorRequest->setUserResolver(fn () => $admin);
    $doctorRows = app(App\\Http\\Controllers\\Api\\DoctorProfileController::class)->index($doctorRequest)->getData(true)['data']['data'];
    foreach ($doctorRows as $row) {
        if (array_key_exists('phone', $row) || array_intersect(array_keys($row['user'] ?? []), $forbidden)) { throw new RuntimeException('Related doctor identity leakage.'); }
    }
    $reservationRequest = Illuminate\\Http\\Request::create('/api/admin/reservations', 'GET', ['user_id' => 4]);
    $reservationRequest->setUserResolver(fn () => $admin);
    $reservationRows = app(App\\Http\\Controllers\\Api\\AdminReservationController::class)->index($reservationRequest)->getData(true)['data'];
    foreach ($reservationRows as $row) { if (($row['patient']['email'] ?? null) !== null) { throw new RuntimeException('Related reservation identity leakage.'); } }
    $submissionRequest = Illuminate\\Http\\Request::create('/api/admin/questionnaire-submissions', 'GET', ['user_id' => 4]);
    $submissionRequest->setUserResolver(fn () => $admin);
    $submissionRows = app(App\\Http\\Controllers\\Api\\Admin\\QuestionnaireSubmissionController::class)->index($submissionRequest)->getData(true)['data'];
    foreach ($submissionRows as $row) { if (($row['submitter_phone'] ?? null) !== null) { throw new RuntimeException('Related questionnaire identity leakage.'); } }
    echo json_encode(['acceptance'=>'passed','scope'=>'read-only service DTO, not browser/HTTP acceptance or a profile write',
        'patient_summary'=>$support['summary'],'doctor_summary'=>$doctorView['summary'],
        'expected_patient_reservations'=>App\\Models\\Reservation::where('user_id', 4)->count(),
        'expected_doctor_reservations'=>App\\Models\\Reservation::where('doctor_profile_id', $doctor->doctorProfile->id)->orWhere('user_id', 5)->count(),
        'report_previews'=>count($support['reports']),'submission_previews'=>count($support['submissions']),
        'private_fields_excluded'=>true,'shared_owner_support_metadata'=>true,'root_subject_refused'=>true,'related_admin_contact_fields_redacted'=>true,
        'patient_activity_count'=>count($support['activity']),
        'jobs'=>Illuminate\\Support\\Facades\\DB::table('jobs')->count()], JSON_THROW_ON_ERROR);
} finally { Illuminate\\Support\\Facades\\DB::rollBack(); }
`;
const result = spawnSync('docker', ['exec', '-i', '--user', '33:33', 'checkupino_app', 'php'], {
  input: php, encoding: 'utf8', windowsHide: true, timeout: 30000,
});
assert.equal(result.status, 0, 'Read-only profile contract failed; inspect locally without exposing raw output.');
const proof = JSON.parse(result.stdout);
assert.deepEqual(proof.patient_summary, { reservations: proof.expected_patient_reservations, upcoming: 0, completed: 1, medical_requests: 2, published_reports: 2, questionnaire_submissions: 1 });
assert.equal(proof.doctor_summary.reservations, proof.expected_doctor_reservations);
assert.equal(proof.jobs, 0);
assert.equal(proof.report_previews, 2);
assert.equal(proof.submission_previews, 1);
console.log(JSON.stringify(proof, null, 2));
