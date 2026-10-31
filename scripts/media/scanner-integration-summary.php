<?php

// No application/environment bootstrap. Read only the private runner-owned completion artifact.
$root = '/tmp/checkupino-scanner-integration';
if (getenv('CHECKUPINO_SCANNER_INTEGRATION_REHEARSAL') !== 'true'
    || getenv('MEDICAL_SCANNER_INTEGRATION') !== 'true' || getenv('APP_ENV') !== 'testing'
    || getenv('DB_CONNECTION') !== 'sqlite' || getenv('DB_DATABASE') !== ':memory:' || getenv('DB_URL')
    || getenv('LARAVEL_STORAGE_PATH') !== $root || posix_geteuid() !== 33) {
    exit(1);
}
$path = $root.'/result.xml';
$stat = @lstat($path);
if (! is_array($stat) || $stat['uid'] !== 33 || ($stat['mode'] & 0170000) !== 0100000
    || $stat['size'] <= 0 || $stat['size'] > 65536) {
    exit(1);
}
$bytes = file_get_contents($path);
if (! is_string($bytes) || str_contains($bytes, '<!DOCTYPE')) {
    exit(1);
}
$document = new DOMDocument;
if (! $document->loadXML($bytes, LIBXML_NONET)) {
    exit(1);
}
$suite = $document->getElementsByTagName('testsuite')->item(0);
if (! $suite instanceof DOMElement || $suite->getAttribute('tests') !== '3'
    || $suite->getAttribute('failures') !== '0' || $suite->getAttribute('errors') !== '0'
    || $suite->getAttribute('skipped') !== '0' || (int) $suite->getAttribute('assertions') < 17) {
    exit(1);
}
echo 'SCANNER_INTEGRATION_EVIDENCE='.json_encode(['acceptance' => 'passed', 'tests' => 3,
    'assertions' => (int) $suite->getAttribute('assertions'), 'seconds' => (float) $suite->getAttribute('time')], JSON_THROW_ON_ERROR).PHP_EOL;
