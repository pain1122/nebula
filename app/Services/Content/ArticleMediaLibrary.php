<?php

namespace App\Services\Content;

use App\Enums\ReservationFileScanStatus;
use App\Models\ArticleMediaAsset;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ClamdScanner;
use App\Services\MedicalContentValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Shared staff editorial library; never queries medical files or patient-health records. */
final class ArticleMediaLibrary
{
    public function __construct(private readonly ArticleMediaEligibility $eligibility, private readonly ArticleMediaStorage $storage,
        private readonly ArticleSnapshots $snapshots, private readonly AuditLogger $audit) {}

    public function requireEnabled(): void
    {
        abort_unless(config('article_content.enabled') === true && config('article_content.media_enabled') === true, 503);
        app(ArticleScheduleState::class)->requireSchema();
    }

    public function read(Request $request, ?string $id = null): array
    {
        $this->requireEnabled();

        return DB::transaction(function () use ($request, $id) {
            $actor = $this->locked($request);
            $policy = $this->eligibility->policy();
            if ($id !== null) {
                abort_if($request->query(), 422);
                $row = $this->row($id);
                $resource = $this->resource($row, $actor);
                if ($resource['selectable']) {
                    $stream = $this->storage->copy($row);
                    fclose($stream);
                }

                return $resource;
            }
            $input = $request->query();
            abort_if(array_diff(array_keys($input), ['q', 'page', 'view']) !== [], 422);
            $filters = validator($input, ['q' => 'sometimes|string|max:120', 'page' => 'sometimes|integer|min:1|max:10000',
                'view' => 'sometimes|in:released,all'])->validate();
            $query = DB::table('article_media_assets')->where('purpose', 'article_editorial')->where('disk', 'article-media');
            if (($filters['view'] ?? 'released') === 'released') {
                $query->where('status', 'released')->whereNull('archived_at');
            }
            if (($filters['q'] ?? '') !== '') {
                $literal = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($filters['q']));
                $query->whereRaw("LOWER(display_name) LIKE ? ESCAPE '!'", ['%'.$literal.'%']);
            }
            $total = (clone $query)->count();
            $page = (int) ($filters['page'] ?? 1);

            return ['assets' => $query->orderByDesc('id')->offset(($page - 1) * 12)->limit(12)->get()
                ->map(fn ($row) => $this->resource($row, $actor))->all(), 'page' => $page, 'per_page' => 12, 'total' => $total,
                'policy' => $policy, 'purpose' => 'article_editorial'];
        });
    }

    public function uploadContext(Request $request): array
    {
        $this->requireEnabled();
        abort_if($request->query(), 422);

        return DB::transaction(function () use ($request) {
            $actor = $this->locked($request);
            $id = strtolower((string) Str::ulid());
            $expires = time() + 600;
            $policy = $this->eligibility->policy(true);

            return ['upload_id' => $id, 'expires_at' => $expires, 'policy' => $policy,
                'revision' => $this->signature($actor, [$id, $expires, $policy])];
        });
    }

    public function upload(Request $request): array
    {
        $this->requireEnabled();
        abort_if($request->query() || array_diff(array_keys($request->all()), ['file', 'upload_id', 'expires_at', 'expected_revision', 'reason', 'confirmed']), 422);
        $data = validator($request->all(), ['file' => 'required|file', 'upload_id' => 'required|string|ulid', 'expires_at' => 'required|integer',
            'expected_revision' => 'required|string|regex:/\A[a-f0-9]{64}\z/', 'reason' => 'sometimes|string|max:1000', 'confirmed' => 'sometimes|accepted'])->validate();
        $policy = DB::transaction(function () use ($request, $data) {
            $actor = $this->locked($request);
            $policy = $this->eligibility->policy(true);
            $this->admission($actor, $data, $policy);

            return $policy;
        });
        $file = $request->file('file');
        $mime = $file->getMimeType();
        $size = $file->getSize();
        abort_unless($file->isValid() && isset($policy['limits'][$mime]) && is_int($size) && $size > 0 && $size <= $policy['limits'][$mime], 422);
        $name = basename($file->getClientOriginalName());
        abort_unless(mb_check_encoding($name, 'UTF-8') && mb_strlen($name) <= 180 && ! preg_match('/[\x00-\x1f\x7f]/', $name), 422);
        $checksum = hash_file('sha256', $file->getRealPath());
        // Every attempt gets its own object, including duplicate public admission IDs. Never overwrite an admitted object's bytes.
        $key = $this->storage->key(strtolower((string) Str::ulid()), $mime);
        $stream = fopen($file->getRealPath(), 'rb');
        try {
            abort_unless(is_resource($stream) && $this->storage->disk()->put($key, $stream, ['visibility' => 'private', 'ContentType' => $mime]), 503);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        // Uncertain persistence leaves an inaccessible private orphan; never delete a possibly committed object.
        return DB::transaction(function () use ($request, $data, $policy, $key, $checksum, $mime, $size, $name) {
            $actor = $this->locked($request);
            $currentPolicy = $this->eligibility->policy(true);
            $this->admission($actor, $data, $currentPolicy);
            abort_unless($currentPolicy === $policy, 409);
            $id = DB::table('article_media_assets')->insertGetId(['public_id' => strtolower($data['upload_id']), 'purpose' => 'article_editorial',
                'actor_user_id' => $actor->id, 'disk' => 'article-media', 'object_key' => $key, 'display_name' => $name,
                'mime_type' => $mime, 'size_bytes' => $size, 'checksum_sha256' => $checksum, 'status' => 'quarantined', 'revision' => 1,
                'upload_policy_revision' => $policy['revision'], 'created_at' => now('UTC'), 'updated_at' => now('UTC')]);
            $row = DB::table('article_media_assets')->find($id);
            $this->record($request, $actor, $row, 'uploaded', null);

            return $this->resource($row, $actor);
        });
    }

    public function act(Request $request, string $id): array
    {
        $this->requireEnabled();
        abort_if($request->query(), 422);
        abort_unless($request->isJson() && strlen($request->getContent()) <= 16384, 422);
        $input = json_decode($request->getContent(), true, 12);
        abort_unless(is_array($input) && ! array_diff(array_keys($input), ['action', 'expected_revision', 'reason', 'confirmed']), 422);
        $data = validator($input, ['action' => 'required|in:validate,retire', 'expected_revision' => 'required|string|regex:/\A[a-f0-9]{64}\z/',
            'reason' => 'sometimes|string|max:1000', 'confirmed' => 'sometimes|accepted'])->validate();
        [$row, $policy] = DB::transaction(function () use ($request, $id, $data) {
            $actor = $this->locked($request);
            $row = $this->row($id, true);
            abort_unless($row->archived_at === null && hash_equals($this->revision($row, $actor), $data['expected_revision']), 409);

            return [$row, $this->eligibility->policy(true)];
        });
        $evidence = null;
        $dimensions = null;
        $failure = null;
        if ($data['action'] === 'validate') {
            $stream = null;
            try {
                abort_unless(isset($policy['limits'][$row->mime_type]) && (int) $row->size_bytes <= $policy['limits'][$row->mime_type], 422);
                $stream = $this->storage->copy($row);
                $verdict = app(ClamdScanner::class)->scan($stream);
                if ($verdict->status !== ReservationFileScanStatus::Clean || ! hash_equals($row->checksum_sha256, $verdict->checksumSha256)) {
                    throw new \DomainException;
                }
                rewind($stream);
                $evidence = $verdict->auditFacts() + app(MedicalContentValidator::class)->validate($stream, $row->mime_type);
                $dimensions = $this->storage->dimensions($stream, $row->mime_type);
            } catch (\Throwable) {
                $failure = 'validation_required';
            } finally {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }
        }

        return DB::transaction(function () use ($request, $id, $data, $policy, $evidence, $dimensions, $failure) {
            $actor = $this->locked($request);
            $row = $this->row($id, true);
            abort_unless($row->archived_at === null && hash_equals($this->revision($row, $actor), $data['expected_revision'])
                && $this->eligibility->policy(true) === $policy, 409);
            $this->snapshots->require((int) $row->revision < 9007199254740991);
            $values = ['revision' => (int) $row->revision + 1, 'updated_at' => now('UTC')];
            if ($data['action'] === 'retire') {
                $values += ['status' => 'retired', 'archived_at' => now('UTC')];
                $action = 'retired';
            } elseif ($failure !== null) {
                $values += ['status' => 'quarantined', 'validation_evidence' => null, 'validated_at' => null, 'released_at' => null];
                $action = 'validation_failed';
            } else {
                $candidate = (object) (array_merge((array) $row, ['status' => 'released', 'validation_evidence' => json_encode($evidence, JSON_THROW_ON_ERROR),
                    'validated_at' => now('UTC')->format('Y-m-d H:i:s'), 'released_at' => now('UTC')->format('Y-m-d H:i:s'),
                    'width' => $dimensions[0], 'height' => $dimensions[1], 'upload_policy_revision' => $policy['revision']]));
                abort_unless($this->eligibility->blocker($candidate) === null, 409);
                $values += array_intersect_key((array) $candidate, array_flip(['status', 'validation_evidence', 'validated_at', 'released_at', 'width', 'height', 'upload_policy_revision']));
                $action = 'validated';
            }
            DB::table('article_media_assets')->where('id', $row->id)->update($values);
            if (DB::table('article_version_media')->where('asset_id', $row->id)->exists()) {
                $catalog = DB::table('article_catalog_state')->where('id', 1)->first();
                $this->snapshots->require((int) $catalog->revision < 9007199254740991);
                DB::table('article_catalog_state')->where('id', 1)->update(['revision' => (int) $catalog->revision + 1, 'updated_at' => now('UTC')]);
            }
            $after = $this->row($id);
            $this->record($request, $actor, $after, $action, $row);

            return $this->resource($after, $actor);
        });
    }

    public function content(Request $request, string $id): array
    {
        $this->requireEnabled();

        return DB::transaction(function () use ($request, $id) {
            $this->locked($request);
            abort_if($request->query(), 422);
            $row = $this->row($id, true);
            abort_unless($this->eligibility->blocker($row) === null, 409);

            return ['stream' => $this->storage->copy($row), 'mime' => $row->mime_type, 'bytes' => (int) $row->size_bytes];
        });
    }

    private function admission(User $actor, array $data, array $policy): void
    {
        abort_unless($data['expires_at'] >= time() && $data['expires_at'] <= time() + 600
            && hash_equals($this->signature($actor, [strtolower($data['upload_id']), (int) $data['expires_at'], $policy]), $data['expected_revision'])
            && ! DB::table('article_media_assets')->where('public_id', strtolower($data['upload_id']))->exists(), 409);
    }

    private function locked(Request $request): User
    {
        $catalog = DB::table('article_catalog_state')->where('id', 1)->lockForUpdate()->first();
        $this->snapshots->require($catalog !== null && DB::table('article_catalog_state')->count() === 1);
        $actor = User::query()->whereKey($request->user()->getAuthIdentifier())->lockForUpdate()->first();
        abort_unless($actor !== null && $actor->permitsAuthentication(), 403);
        $actor->setRelation('roles', $actor->roles()->sharedLock()->get());
        abort_unless($actor->canAccessAdminPanel(), 403);

        return $actor;
    }

    private function row(string $id, bool $lock = false): object
    {
        $query = DB::table('article_media_assets')->where('public_id', strtolower($id))->where('purpose', 'article_editorial')->where('disk', 'article-media');
        $row = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($row !== null, 404);

        return $row;
    }

    private function resource(object $row, User $actor): array
    {
        $blocker = $this->eligibility->blocker($row);

        return ['asset' => $this->eligibility->snapshot($row), 'name' => $row->display_name, 'status' => $row->status,
            'selectable' => $blocker === null, 'blocker' => $blocker, 'revision' => $this->revision($row, $actor),
            'content_path' => '/api/admin/article-media/'.$row->public_id.'/content'];
    }

    private function revision(object $row, User $actor): string
    {
        return $this->signature($actor, [$row->public_id, (int) $row->revision, $row->checksum_sha256, $row->status,
            $row->archived_at, $this->eligibility->policy()]);
    }

    private function signature(User $actor, array $state): string
    {
        $key = config('app.key');
        $this->snapshots->require(is_string($key) && $key !== '');

        return hash_hmac('sha256', json_encode([$state, $actor->public_id, $actor->getRawOriginal('updated_at'),
            $actor->roles->pluck('name')->sort()->values()->all()], JSON_THROW_ON_ERROR), $key);
    }

    private function record(Request $request, User $actor, object $row, string $action, ?object $before): void
    {
        $subject = new ArticleMediaAsset;
        $subject->setRawAttributes((array) $row, true);
        $subject->exists = true;
        $safe = fn ($row) => $row === null ? null : ['id' => $row->public_id, 'status' => $row->status, 'revision' => (int) $row->revision,
            'checksum_sha256' => $row->checksum_sha256, 'mime_type' => $row->mime_type, 'size_bytes' => (int) $row->size_bytes];
        // Fixed server-originated reasons describe the action; no human attestation is fabricated.
        $this->audit->log($request, $actor, 'admin.article_media.'.$action, $subject, 'high', $safe($before), $safe($row),
            reason: 'File Manager editorial image action: '.$action.'.');
    }
}
