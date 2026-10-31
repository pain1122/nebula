<?php

namespace Database\Seeders;

use App\Enums\ReservationFileScanStatus;
use App\Enums\ReservationMedicalRequestStatus;
use App\Enums\ReservationReportStatus;
use App\Jobs\ScanReservationFile;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\ReservationReport;
use App\Models\User;
use App\Services\ClamdScanner;
use App\Services\Content\ArticleDraftWrite;
use App\Services\Content\ArticleMediaLibrary;
use App\Services\MedicalContentValidator;
use App\Services\ReservationFileService;
use App\Services\ReservationMedicalRequestService;
use App\Services\ReservationReportService;
use Database\Seeders\Support\DemoFixtureContext;
use Database\Seeders\Support\SyntheticDemoFiles;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use LogicException;

/** Explicit second stage on its own synthetic database. Never manufactures a clean verdict. */
class VerifiedDemoMediaSeeder extends Seeder
{
    public function run(): void
    {
        DemoFixtureContext::guardOwnedDatabase();
        if (! config('demo.verified_media_seed_enabled') || posix_geteuid() !== 33 || User::count() !== 6 || Reservation::count() !== 9
            || Reservation::where('booking_idempotency_key', 'not like', 'demo-%')->exists()
            || DB::table('articles')->count() !== 6 || DB::table('articles')->where('slug', 'not like', 'demo-seed-%')->exists()
            || ! config('medical.scanner.enabled') || ! config('article_content.enabled')
            || ! config('article_content.media_enabled') || ! config('article_content.presentation_enabled')) {
            throw new LogicException('Verified media fixtures require the complete independent synthetic seed profile and accepted runtime flags.');
        }
        $pdfHash = hash('sha256', SyntheticDemoFiles::pdf());
        if (ReservationFile::withTrashed()->get()->contains(fn ($file): bool => $file->label !== 'Synthetic seed PDF'
            || $file->checksum_sha256 !== $pdfHash || ! in_array($file->scan_status, [ReservationFileScanStatus::Quarantined, ReservationFileScanStatus::Clean], true))
            || DB::table('article_media_assets')->get()->contains(fn ($row): bool => ! in_array($row->display_name,
                ['Synthetic demo image 1.png', 'Synthetic demo image 2.png', 'Synthetic demo image 3.png'], true))) {
            throw new LogicException('Media seed refuses existing non-fixture files.');
        }
        // Refuse unrelated jobs before creating an object or consuming any delivery.
        foreach (DB::table('jobs')->get() as $row) {
            $command = $this->command($row);
            $file = ReservationFile::where('public_id', $command->filePublicId)->first();
            if (! $file || $file->label !== 'Synthetic seed PDF' || $command->checksumSha256 !== $file->checksum_sha256) {
                throw new LogicException('Media seed refuses an unrelated queued job.');
            }
        }
        $inline = config('medical_parser.test_inline');
        config(['medical_parser.test_inline' => false]);
        try {
            $this->preflight();
            $actor = User::where('email', 'rootadmin@checkupino.test')->firstOrFail();
            $assets = [];
            foreach ([0, 1, 2] as $variant) {
                $assets[] = $this->image($actor, $variant);
            }
            foreach (['demo-confirmed-paid', 'demo-doctor2-confirmed'] as $index => $key) {
                $this->medical($key, $index === 0);
            }
            $this->article($actor, 'demo-seed-getting-started', $assets[0], 2, 'draft');
            $this->article($actor, 'demo-seed-prepare-appointment', $assets[1], 1, 'publish');
        } finally {
            config(['medical_parser.test_inline' => $inline]);
        }
    }

    private function preflight(): void
    {
        foreach ([['image/png', SyntheticDemoFiles::png()], ['application/pdf', SyntheticDemoFiles::pdf()]] as [$mime, $bytes]) {
            $stream = fopen('php://temp', 'w+b');
            fwrite($stream, $bytes);
            rewind($stream);
            try {
                if (app(ClamdScanner::class)->scan($stream)->status !== ReservationFileScanStatus::Clean) {
                    throw new LogicException('Fresh real scanner required for synthetic media fixtures.');
                }
                rewind($stream);
                app(MedicalContentValidator::class)->validate($stream, $mime);
            } finally {
                fclose($stream);
            }
        }
    }

    private function image(User $actor, int $variant): array
    {
        $library = app(ArticleMediaLibrary::class);
        $name = 'Synthetic demo image '.($variant + 1).'.png';
        $bytes = SyntheticDemoFiles::png($variant);
        $row = DB::table('article_media_assets')->where('display_name', $name)->first();
        if ($row) {
            if ($row->checksum_sha256 !== hash('sha256', $bytes)) {
                throw new LogicException('Synthetic image identity changed; no overwrite is allowed.');
            }
            $resource = $library->read(DemoFixtureContext::request($actor, '/api/admin/article-media'), $row->public_id);
        } else {
            $context = $library->uploadContext(DemoFixtureContext::request($actor, '/api/admin/article-media/upload-context'));
            $resource = SyntheticDemoFiles::withUpload($bytes, $name, 'image/png', function ($file) use ($actor, $library, $context): array {
                $request = DemoFixtureContext::request($actor, '/api/admin/article-media', 'POST');
                $request->headers->set('Content-Type', 'multipart/form-data');
                $request->request->add(['upload_id' => $context['upload_id'], 'expires_at' => $context['expires_at'], 'expected_revision' => $context['revision']]);
                $request->files->set('file', $file);

                return $library->upload($request);
            });
        }
        if ($resource['status'] === 'quarantined') {
            $resource = $library->act(DemoFixtureContext::request($actor, '/api/admin/article-media/'.$resource['asset']['id'].'/actions', 'POST', [
                'action' => 'validate', 'expected_revision' => $resource['revision'],
            ]), $resource['asset']['id']);
        }
        if (! $resource['selectable']) {
            throw new LogicException('Image preparation did not pass; fixture remains unavailable.');
        }

        return $resource;
    }

    private function command(object $row): ScanReservationFile
    {
        $payload = json_decode($row->payload, true, flags: JSON_THROW_ON_ERROR);
        if ($row->queue !== 'medical-scan' || ($payload['displayName'] ?? null) !== ScanReservationFile::class
            || ! is_string($payload['data']['command'] ?? null)) {
            throw new LogicException('Only an owned encrypted medical scan may be delivered.');
        }
        $command = unserialize(Crypt::decrypt($payload['data']['command']), ['allowed_classes' => [ScanReservationFile::class]]);
        if (! $command instanceof ScanReservationFile || $command->connection !== 'medical-scan' || $command->queue !== 'medical-scan') {
            throw new LogicException('Encrypted job identity mismatch.');
        }

        return $command;
    }

    private function deliver(ReservationFile $file): void
    {
        if ($file->scan_status === ReservationFileScanStatus::Clean) {
            return;
        }
        DB::transaction(function () use ($file): void {
            $rows = DB::table('jobs')->lockForUpdate()->get();
            if ($rows->count() !== 1) {
                throw new LogicException('Exactly one untouched owned job is required; no general worker is started.');
            }
            $row = $rows->sole();
            $command = $this->command($row);
            if ($command->filePublicId !== $file->public_id || $command->checksumSha256 !== $file->checksum_sha256
                || $row->reserved_at !== null || (int) $row->attempts !== 0 || (int) $row->available_at > time()) {
                throw new LogicException('Exact file/checksum/ready job binding is required.');
            }
            $job = Queue::connection('medical-scan')->pop('medical-scan');
            if (! $job || (string) $job->getJobId() !== (string) $row->id) {
                throw new LogicException('Reserved job changed; delivery stopped.');
            }
            $job->fire();
            if ($file->fresh()->scan_status !== ReservationFileScanStatus::Clean || DB::table('jobs')->count() !== 0) {
                throw new LogicException('Ordinary guarded delivery did not complete; no replay or verdict override.');
            }
        });
    }

    private function medical(string $key, bool $publishAmendment): void
    {
        $reservation = Reservation::where('booking_idempotency_key', $key)->with(['doctor.user', 'user'])->firstOrFail();
        $medical = $reservation->medicalRequests()->where('request_type', 'demo_lab_results')->firstOrFail();
        $file = $medical->files()->first();
        if (! $file) {
            $file = SyntheticDemoFiles::withUpload(SyntheticDemoFiles::pdf(), 'synthetic-seed.pdf', 'application/pdf',
                fn ($upload) => app(ReservationFileService::class)->uploadForMedicalRequest(
                    DemoFixtureContext::request($reservation->user, '/api/my/medical-requests/'.$medical->public_id.'/files', 'POST'),
                    $reservation->user, $medical, $upload, 'Synthetic seed PDF',
                ));
        }
        $this->deliver($file);
        $doctor = $reservation->doctor->user;
        $request = DemoFixtureContext::request($doctor, '/api/doctor/medical-requests/'.$medical->public_id, 'POST');
        if ($medical->status === ReservationMedicalRequestStatus::Open) {
            $medical = app(ReservationMedicalRequestService::class)->startReview($request, $doctor, $medical);
        }
        $body = 'Synthetic demonstration only: this report exercises the workflow and contains no medical assessment.';
        $amendmentBody = 'Synthetic demonstration amendment: no real patient or clinical assessment is included.';
        $reports = app(ReservationReportService::class);
        $original = ReservationReport::where('medical_request_id', $medical->id)->whereNull('supersedes_report_id')->first()
            ?? $reports->saveDraft($request, $doctor, $medical, $body);
        if ($original->body !== $body) {
            throw new LogicException('Existing report was edited; synthetic seed will not publish it.');
        }
        if ($original->status === ReservationReportStatus::Draft) {
            $original = $reports->publish($request, $doctor, $original);
        }
        $amendment = ReservationReport::where('supersedes_report_id', $original->id)->first()
            ?? $reports->saveDraft($request, $doctor, $medical->fresh(), $amendmentBody, supersedes: $original);
        if ($amendment->body !== $amendmentBody) {
            throw new LogicException('Existing amendment was edited; synthetic seed will not publish it.');
        }
        if ($publishAmendment && $amendment->status === ReservationReportStatus::Draft) {
            $reports->publish($request, $doctor, $amendment);
        }
    }

    private function article(User $actor, string $slug, array $asset, int $expectedVersion, string $intent): void
    {
        $row = DB::table('articles')->where('slug', $slug)->firstOrFail();
        $service = app(ArticleDraftWrite::class);
        $context = $service->context(DemoFixtureContext::request($actor, '/api/admin/articles/write-context'), $row->public_id);
        $working = $context['current']['working'];
        if (($working['presentation']['thumbnail']['asset']['id'] ?? null) === $asset['asset']['id']) {
            return;
        }
        if ($working['version'] !== $expectedVersion) {
            throw new LogicException('Article was edited; synthetic media seed will not replace it.');
        }
        $translations = (array) $working['translations'];
        foreach (['en', 'fa'] as $language) {
            $translations[$language]['body_html'] .= '<figure class="image"><img src="'.$asset['content_path'].'" alt="Synthetic demonstration"></figure>';
        }
        $service->save(DemoFixtureContext::request($actor, '/api/admin/articles', 'POST', [
            'expected_revision' => $context['revision'], 'slug' => $slug, 'intent' => $intent, 'translations' => $translations,
            'taxonomy' => array_map(fn ($term): array => ['id' => $term['id'], 'kind' => $term['kind']], $working['taxonomy']),
            'health_references' => [], 'source_links' => $working['source_links'],
            'presentation' => ['publication' => null, 'thumbnail' => ['id' => $asset['asset']['id'],
                'alt' => ['en' => 'Synthetic demonstration', 'fa' => 'تصویر ساختگی برای نمایش']],
                'inline' => [['id' => $asset['asset']['id'], 'language' => 'en'], ['id' => $asset['asset']['id'], 'language' => 'fa']]],
        ]), $row->public_id);
    }
}
