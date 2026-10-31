<?php

use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Support\VerifiedPrivateFile;
use Aws\Exception\AwsException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

// Loaded only by the local synthetic helper. No model is saved or scan verdict set.
return static function (array $settings, array $config): void {
    $require = static function (bool $condition): void {
        if (! $condition) {
            throw new DomainException('Synthetic security acceptance failed.');
        }
    };
    $denied = static function (callable $operation) use ($require): void {
        try {
            $operation();
        } catch (AwsException $exception) {
            $require($exception->getStatusCode() === 403);

            return;
        }
        throw new DomainException('Synthetic access restriction failed.');
    };
    $rejected = static function (ReservationFile $file): void {
        try {
            $snapshot = VerifiedPrivateFile::open($file);
        } catch (DomainException) {
            return;
        }
        $snapshot->close();
        throw new DomainException('Synthetic integrity restriction failed.');
    };

    $disk = Storage::disk('private');
    $client = $disk->getClient();
    $bootstrap = app('filesystem')->createS3Driver(array_replace($config, [
        'key' => $settings['bootstrap']['accessKey'], 'secret' => $settings['bootstrap']['secretKey'],
    ]))->getClient();
    $anonymous = app('filesystem')->createS3Driver(array_replace($config, [
        'key' => '', 'secret' => '', 'credentials' => false,
    ]))->getClient();

    $reservation = (new Reservation)->forceFill(['public_id' => (string) Str::ulid()]);
    $id = (string) Str::ulid();
    $path = 'reservation-files/quarantine/'.$reservation->public_id.'/'.$id.'.pdf';
    // Intentionally synthetic PDF-shaped bytes; this is not PDF parser acceptance.
    $content = "%PDF-1.4\nSYNTHETIC STORAGE INTEGRITY ONLY\n".str_repeat('0123456789abcdef', 131072);
    $file = (new ReservationFile)->forceFill([
        'public_id' => $id, 'disk' => 'private', 'path' => $path,
        'mime_type' => 'application/pdf', 'extension' => 'pdf', 'safe_filename' => $id.'.pdf',
        'size_bytes' => strlen($content), 'checksum_sha256' => hash('sha256', $content),
    ]);
    $file->setRelation('reservation', $reservation);
    $scopeBucket = 'checkupino-media-scope-'.strtolower((string) Str::ulid());
    $scopeCreated = false;
    $snapshot = null;
    try {
        $require($disk->put($path, $content, ['visibility' => 'private']));
        $parameters = ['Bucket' => $settings['bucket'], 'Key' => $path];
        $denied(fn () => $anonymous->getObject($parameters));
        $denied(fn () => $anonymous->listObjectsV2(['Bucket' => $settings['bucket']]));
        $denied(fn () => $anonymous->putObject($parameters + ['Body' => 'synthetic unauthorized overwrite']));
        $denied(fn () => $anonymous->deleteObject($parameters));
        $require(hash_equals(hash('sha256', $content), hash('sha256', $disk->get($path))));
        echo "Anonymous read/list/write/delete denied (403); authenticated bytes preserved.\n";

        $denied(function () use ($client, $scopeBucket, &$scopeCreated): void {
            $client->createBucket(['Bucket' => $scopeBucket]);
            $scopeCreated = true;
        });
        $bootstrap->createBucket(['Bucket' => $scopeBucket]);
        $scopeCreated = true;
        $denied(fn () => $client->listObjectsV2(['Bucket' => $scopeBucket]));
        $denied(fn () => $client->getObject(['Bucket' => $scopeBucket, 'Key' => 'synthetic.bin']));
        $denied(fn () => $client->putObject(['Bucket' => $scopeBucket, 'Key' => 'synthetic.bin', 'Body' => 'synthetic scope check']));
        $denied(fn () => $client->deleteBucket(['Bucket' => $scopeBucket]));
        echo "Application bucket creation and cross-bucket read/list/write/delete denied (403).\n";

        $snapshot = VerifiedPrivateFile::open($file);
        $require($disk->put($path, str_repeat('x', strlen($content)), ['visibility' => 'private']));
        ob_start();
        try {
            $snapshot->send();
            $received = ob_get_contents();
        } finally {
            ob_end_clean();
        }
        $require(is_string($received) && hash_equals(hash('sha256', $content), hash('sha256', $received)));
        $rejected($file);
        $require($disk->delete($path));
        $rejected($file);
        echo "Authenticated 2 MiB snapshot preserved; overwritten and missing objects rejected.\n";

        // Deliberately unavailable loopback endpoint; do not stop any real container.
        config(['filesystems.disks.private' => array_replace($config, [
            'endpoint' => 'http://127.0.0.1:1', 'http' => ['connect_timeout' => 1, 'timeout' => 1, 'verify' => true],
            'retries' => 0,
        ])]);
        Storage::forgetDisk('private');
        $require(Artisan::call('medical:storage-check', ['--probe' => true]) === 1);
        $output = Artisan::output();
        $require(str_contains($output, 'Medical storage check failed.'));
        foreach ([$settings['application']['accessKey'], $settings['application']['secretKey'], '127.0.0.1'] as $protected) {
            $require(! str_contains($output, $protected));
        }
        echo "Unavailable endpoint fails closed with redacted operator output.\n";
    } finally {
        $snapshot?->close();
        config(['filesystems.disks.private' => $config]);
        Storage::forgetDisk('private');
        // Cleanup only this run's newly generated synthetic key and disposable bucket.
        $require($disk->delete($path) && ! $disk->exists($path));
        if ($scopeCreated) {
            $bootstrap->deleteObject(['Bucket' => $scopeBucket, 'Key' => 'synthetic.bin']);
            $bootstrap->deleteBucket(['Bucket' => $scopeBucket]);
        }
    }
    echo "Synthetic security check passed; generated objects and scope bucket removed.\n";
};
