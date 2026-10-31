import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] ?? '--config';
if (!['--config', '--probe', '--bootstrap', '--security'].includes(mode)) {
  throw new Error('Use --config, --probe, --bootstrap or --security.');
}
const settings = JSON.parse(readFileSync(fileURLToPath(new URL('../../.local/media-evaluation/settings.json', import.meta.url)), 'utf8'));
if (settings.evaluationOnly !== true || settings.bucket !== 'checkupino-medical-eval'
    || settings.endpoint !== 'http://checkupino-media-s3:8333') {
  throw new Error('Only the isolated synthetic evaluation is supported by this helper.');
}
const encoded = Buffer.from(JSON.stringify(settings)).toString('base64');
// Credentials travel through stdin, never command arguments, logs or the live .env.
const php = `<?php
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
try {
    if (! $app->environment('local')) {
        throw new DomainException('This helper is restricted to local synthetic evaluation.');
    }
    $settings = json_decode(base64_decode('${encoded}'), true, flags: JSON_THROW_ON_ERROR);
    $config = array_replace(config('filesystems.disks.private'), [
        'driver' => 'medical-s3', 'root' => '', 'key' => $settings['application']['accessKey'],
        'secret' => $settings['application']['secretKey'], 'region' => $settings['region'],
        'bucket' => $settings['bucket'], 'endpoint' => $settings['endpoint'],
        'allow_insecure_http' => true, 'use_path_style_endpoint' => true,
    ]);
    App\\Support\\MedicalStorageConfiguration::validate($config, $app->environment());
    if (! class_exists(League\\Flysystem\\AwsS3V3\\AwsS3V3Adapter::class)) {
        throw new DomainException('The Laravel S3 adapter is required.');
    }
    if ('${mode}' === '--bootstrap') {
        $bootstrapConfig = array_replace($config, [
            'key' => $settings['bootstrap']['accessKey'], 'secret' => $settings['bootstrap']['secretKey'],
        ]);
        $client = $app['filesystem']->createS3Driver($bootstrapConfig)->getClient();
        try {
            $client->headBucket(['Bucket' => $settings['bucket']]);
        } catch (Aws\\Exception\\AwsException $exception) {
            if ($exception->getStatusCode() !== 404) {
                throw $exception;
            }
            $client->createBucket(['Bucket' => $settings['bucket']]);
        }
        echo "Isolated synthetic evaluation bucket is ready.\\n";
    }
    config(['filesystems.disks.private' => $config]);
    Illuminate\\Support\\Facades\\Storage::forgetDisk('private');
    if ('${mode}' === '--security') {
        $check = require '/var/www/scripts/media/evaluation-security.php';
        $check($settings, $config);
        exit(0);
    }
    $exit = Illuminate\\Support\\Facades\\Artisan::call('medical:storage-check', ['--probe' => '${mode}' !== '--config']);
    echo Illuminate\\Support\\Facades\\Artisan::output();
    exit($exit);
} catch (Throwable) {
    fwrite(STDERR, "Synthetic S3 evaluation failed; check adapter, private network, credentials and service readiness.\\n");
    exit(1);
}
`;
const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], {
  input: php, encoding: 'utf8', windowsHide: true, timeout: 75000,
});
if (result.error) {
  console.error('Synthetic evaluation could not complete within the execution limit.');
  process.exit(1);
}
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
