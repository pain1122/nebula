param(
    [switch]$PrerequisitesOnly
)

$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskImage = 'checkupino-content-validation:2026-10-08'
$taskImageId = & docker image inspect $taskImage --format '{{.Id}}'
if ($LASTEXITCODE -ne 0 -or $taskImageId -notmatch '^sha256:[a-f0-9]{64}$') {
    throw 'Build the approved isolated validation image first; no running service was changed.'
}

$taskArguments = @(
    'run', '--rm', '--network', 'none', '--read-only', '--init',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    '--user', '33:33', '--memory', '512m', '--cpus', '1.0',
    '--tmpfs', '/tmp:rw,size=256m,mode=1777',
    '--mount', "type=bind,source=$taskRoot,target=/var/www,readonly",
    '--workdir', '/var/www',
    '--env', 'APP_ENV=testing', '--env', 'APP_DEBUG=false',
    '--env', 'DB_CONNECTION=sqlite', '--env', 'DB_DATABASE=:memory:',
    '--env', 'DB_URL=', '--env', 'CACHE_STORE=array', '--env', 'SESSION_DRIVER=array',
    '--env', 'MEDICAL_SCAN_ENABLED=false', '--env', 'CHECKUPINO_CONTENT_PARSER_ACCEPTANCE=1',
    '--env', 'LARAVEL_STORAGE_PATH=/tmp/checkupino-content-tests',
    '--env', 'APP_CONFIG_CACHE=/tmp/checkupino-content-tests/config.php',
    '--env', 'VIEW_COMPILED_PATH=/tmp/checkupino-content-tests/framework/views'
)

if ($PrerequisitesOnly) {
    $taskArguments += @($taskImageId, 'sh', '-c', 'qpdf --version && php --ri gd && command -v prlimit')
} else {
    $taskTests = @(
        'tests/Feature/Services/MedicalContentIsolationTest.php',
        'tests/Feature/Services/MedicalUploadAdmissionTest.php',
        'tests/Feature/Api/MedicalUploadAdmissionApiTest.php',
        'tests/Feature/Services/MedicalContentPolicyTest.php',
        'tests/Feature/Services/MedicalContentValidatorTest.php',
        'tests/Feature/Services/MedicalContentReleaseTest.php',
        'tests/Feature/Services/ReservationFileServiceTest.php',
        'tests/Feature/Services/MedicalFileIntegrityTest.php',
        'tests/Feature/Services/MedicalScanJobTest.php',
        'tests/Feature/Services/FileUploadPolicyTest.php',
        'tests/Feature/Services/MedicalAttachmentPolicyTest.php',
        'tests/Feature/Services/ReservationMedicalRequestServiceTest.php',
        'tests/Feature/Services/ReservationReportServiceTest.php',
        'tests/Feature/Api/ReservationMedicalFileApiTest.php',
        'tests/Feature/Api/ReservationMedicalRequestApiTest.php',
        'tests/Feature/Api/PatientMedicalOutcomeApiTest.php',
        'tests/Feature/Api/DoctorMedicalReviewApiTest.php',
        'tests/Feature/Api/ReservationReportApiTest.php',
        'tests/Feature/Api/UploadPolicySettingsApiTest.php',
        'tests/Feature/Services/ClamdScannerTest.php'
    )
    # Only fixed repository test paths enter this Linux shell command.
    $taskCommand = 'mkdir -p /tmp/checkupino-content-tests/framework/cache /tmp/checkupino-content-tests/framework/sessions /tmp/checkupino-content-tests/framework/views /tmp/checkupino-content-tests/logs && exec php vendor/bin/phpunit --do-not-cache-result ' + ($taskTests -join ' ')
    $taskArguments += @($taskImageId, 'sh', '-c', $taskCommand)
}

Write-Output "Isolated content parser verification: $taskImageId; no network, live database or worker."
& docker @taskArguments
if ($LASTEXITCODE -ne 0) {
    throw 'Isolated content parser verification failed; live activation remains blocked.'
}
