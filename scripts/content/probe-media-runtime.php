<?php

// Synthetic memory-only image/scanner/parser probe. Never uploads, saves a verdict or consumes a queue.
use App\Enums\ReservationFileScanStatus;
use App\Services\ClamdScanner;
use App\Services\Content\ArticleMediaStorage;
use App\Services\MedicalContentValidator;
use App\Support\MedicalContentPolicy;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

$stage = 'context';
try {
    if (count($argv) !== 2 || $argv[1] !== '--synthetic-only' || posix_geteuid() !== 33 || getcwd() !== '/var/www') {
        throw new RuntimeException('Restricted probe context required.');
    }
    require '/var/www/vendor/autoload.php';
    $app = require '/var/www/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    if ($app->environment('testing') || $app->configurationIsCached() || DB::connection()->getDriverName() !== 'mysql'
        || config('article_content.enabled') !== true || config('article_content.media_enabled') !== true
        || config('article_content.presentation_enabled') !== true || config('article_content.publisher_enabled') !== false
        || config('article_content.scheduling_enabled') !== false || config('medical_parser.socket') !== '/run/medical-content/content.sock') {
        throw new RuntimeException('Activated editorial runtime required.');
    }
    // test_inline is a test-only preference. The actual validator also requires APP_ENV=testing,
    // which is refused above; an ordinary application must use the dedicated socket.
    $stage = 'fixture';
    $bytes = base64_decode(getenv('CHECKUPINO_EDITORIAL_SYNTHETIC_PNG') ?: '', true);
    if (! is_string($bytes) || hash('sha256', $bytes) !== '531fee70c1b0ed60c0693e135ac789d1871d87960f196b7cfc4797d9b15dbac2') {
        throw new RuntimeException('Exact synthetic pixels required.');
    }
    $stage = 'parser_socket';
    $socket = lstat('/run/medical-content/content.sock');
    if (! is_array($socket) || $socket['uid'] !== 33 || ($socket['mode'] & 0777) !== 0600) {
        throw new RuntimeException('Isolated parser socket refused.');
    }
    DB::statement('SET TRANSACTION READ ONLY');
    DB::beginTransaction();
    try {
        $scan = static function (string $input) {
            $stream = fopen('php://temp', 'w+b');
            fwrite($stream, $input);
            rewind($stream);
            try {
                return app(ClamdScanner::class)->scan($stream);
            } finally {
                fclose($stream);
            }
        };
        $validate = static function (string $input): array {
            $stream = fopen('php://temp', 'w+b');
            fwrite($stream, $input);
            rewind($stream);
            try {
                $facts = app(MedicalContentValidator::class)->validate($stream, 'image/png');
                $dimensions = app(ArticleMediaStorage::class)->dimensions($stream, 'image/png');

                return [$facts, $dimensions];
            } finally {
                fclose($stream);
            }
        };
        $stage = 'scanner_clean_and_eicar';
        $clean = $scan($bytes);
        $infected = $scan('X5O!P%@AP[4'.chr(92).'PZX54(P^)7CC)7}'.'$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
        if ($clean->status !== ReservationFileScanStatus::Clean || $infected->status !== ReservationFileScanStatus::Infected
            || $clean->checksumSha256 !== hash('sha256', $bytes) || $clean->databaseVersion !== $infected->databaseVersion
            || $clean->databaseUpdatedAt !== $infected->databaseUpdatedAt) {
            throw new RuntimeException('Real scanner probe refused.');
        }
        $stage = 'isolated_png_decode';
        [$facts, $dimensions] = $validate($bytes);
        if ($facts['content_policy_revision'] !== MedicalContentPolicy::current()->revision
            || ! str_starts_with($facts['content_validator'], 'gd-') || $dimensions !== [64, 40]) {
            throw new RuntimeException('Real isolated image decoder refused.');
        }
        // Damage the IHDR CRC, leaving dimensions and signature readable; full decoding must reject it.
        $stage = 'corrupt_png_and_recovery';
        $corrupt = $bytes;
        $corrupt[29] = chr(ord($corrupt[29]) ^ 1);
        $rejected = false;
        try {
            $validate($corrupt);
        } catch (DomainException) {
            $rejected = true;
        }
        if (! $rejected || $validate($bytes) !== [$facts, $dimensions]) {
            throw new RuntimeException('Decoder corruption/recovery probe refused.');
        }
        echo json_encode(['acceptance' => 'passed', 'clean_png' => true, 'eicar_infected' => true,
            'scanner' => $clean->auditFacts(), 'content' => $facts, 'dimensions' => $dimensions,
            'corrupt_png_rejected' => true, 'following_valid_png_passes' => true,
            'jobs' => DB::table('jobs')->count(), 'writes' => 0], JSON_THROW_ON_ERROR)."\n";
    } finally {
        DB::rollBack();
    }
} catch (Throwable $error) {
    fwrite(STDERR, json_encode(['acceptance' => 'refused', 'class' => $error::class, 'stage' => $stage, 'line' => $error->getLine()], JSON_THROW_ON_ERROR)."\n");
    exit(1);
}
