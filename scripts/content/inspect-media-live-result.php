<?php

// Read-only closeout of the exact synthetic admission and article recorded in the browser receipt.
use App\Services\Content\ArticleMediaEligibility;
use App\Services\Content\ArticleMediaStorage;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

try {
    if (count($argv) !== 2 || $argv[1] !== '--synthetic-result' || posix_geteuid() !== 33 || getcwd() !== '/var/www') {
        throw new RuntimeException('Read-only application context required.');
    }
    require '/var/www/vendor/autoload.php';
    $app = require '/var/www/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    $before = json_decode(file_get_contents('/var/www/docs/deployment/evidence/article-media-live-activation-2026-10-24.json'), true, 64, JSON_THROW_ON_ERROR);
    $recorded = json_decode(file_get_contents('/var/www/docs/deployment/evidence/article-media-live-browser-1792873181908-2026-10-24.json'), true, 64, JSON_THROW_ON_ERROR);
    DB::statement('SET TRANSACTION READ ONLY');
    DB::beginTransaction();
    try {
        $article = DB::table('articles')->where('public_id', $recorded['content_id'])->sole();
        $asset = DB::table('article_media_assets')->where('public_id', $recorded['asset_id'])->sole();
        if ($article->slug !== $recorded['slug'] || (int) $article->author_user_id !== 2
            || (int) $article->working_version !== 3 || $article->working_state !== 'draft'
            || (int) $article->published_version !== 1 || $article->reviewed_version !== null
            || DB::table('article_media_assets')->count() !== 1 || (int) $asset->actor_user_id !== 2
            || $asset->status !== 'released' || (int) $asset->revision !== 2
            || $asset->checksum_sha256 !== '531fee70c1b0ed60c0693e135ac789d1871d87960f196b7cfc4797d9b15dbac2'
            || (int) $asset->width !== 64 || (int) $asset->height !== 40
            || app(ArticleMediaEligibility::class)->blocker($asset) !== null) {
            throw new RuntimeException('Synthetic identity/lifecycle/eligibility mismatch.');
        }
        $stream = app(ArticleMediaStorage::class)->copy($asset);
        fclose($stream);
        $root = config('filesystems.disks.article-media.root');
        $privateStorage = ['visibility' => app(ArticleMediaStorage::class)->disk()->getVisibility($asset->object_key),
            'root_mode' => sprintf('%04o', fileperms($root) & 0777),
            'file_mode' => sprintf('%04o', fileperms($root.'/'.$asset->object_key) & 0777),
            'outside_web_root' => ! str_starts_with(realpath($root), realpath(public_path()).'/')];
        if ($privateStorage !== ['visibility' => 'private', 'root_mode' => '0700', 'file_mode' => '0600', 'outside_web_root' => true]) {
            throw new RuntimeException('Synthetic local object visibility mismatch.');
        }
        $versions = DB::table('article_versions')->where('article_id', $article->id)->orderBy('version')->get();
        if ($versions->pluck('version')->map(fn ($v) => (int) $v)->all() !== [1, 2, 3]
            || $versions[0]->public_id !== $recorded['published']['id']
            || $versions[0]->content_hash !== $versions[2]->content_hash
            || $versions[0]->content_hash === $versions[1]->content_hash) {
            throw new RuntimeException('Version history mismatch.');
        }
        foreach ($versions as $version) {
            $presentation = json_decode($version->presentation, true, 12, JSON_THROW_ON_ERROR);
            if ((int) $version->schema_version !== 3 || $presentation['thumbnail']['asset']['id'] !== $asset->public_id
                || count($presentation['inline']) !== 2) {
                throw new RuntimeException('Immutable manifest mismatch.');
            }
        }
        $links = DB::table('article_version_media')->orderBy('version')->orderBy('usage')->orderBy('language')->get();
        if ($links->count() !== 12) {
            throw new RuntimeException('Expected four exact language/usage references per version.');
        }
        foreach ([1, 2, 3] as $version) {
            $seen = [];
            foreach ($links->where('version', $version) as $link) {
                if ((int) $link->article_id !== (int) $article->id || (int) $link->asset_id !== (int) $asset->id
                    || $link->checksum_sha256 !== $asset->checksum_sha256) {
                    throw new RuntimeException('Cross-owner/reference mismatch.');
                }
                $seen[] = $link->usage.':'.$link->language;
            }
            sort($seen);
            if ($seen !== ['inline:en', 'inline:fa', 'thumbnail:en', 'thumbnail:fa']) {
                throw new RuntimeException('Version reference shape mismatch.');
            }
        }
        $preserved = [];
        foreach (['articles', 'article_versions', 'article_terms', 'article_term_versions', 'article_version_terms'] as $table) {
            $query = DB::table($table)->orderBy('id');
            if ($table === 'articles') {
                $query->where('id', '!=', $article->id);
            }
            if ($table === 'article_versions') {
                $query->where('article_id', '!=', $article->id)->select(array_values(array_diff(Schema::getColumnListing($table), ['presentation'])));
            }
            $hash = hash('sha256', json_encode($query->get(), JSON_THROW_ON_ERROR));
            if ($hash !== $before['boundary']['hashes'][$table]) {
                throw new RuntimeException('Original article/taxonomy history changed.');
            }
            $preserved[$table] = $hash;
        }
        $oldCount = $before['state']['counts']['audit_events'];
        $oldAudits = DB::table('audit_events')->orderBy('id')->limit($oldCount)->get();
        if (hash('sha256', json_encode($oldAudits, JSON_THROW_ON_ERROR)) !== $before['state']['hashes']['audit_events']) {
            throw new RuntimeException('Original audit history changed.');
        }
        $audits = DB::table('audit_events')->orderBy('id')->offset($oldCount)->limit(9)->get();
        $expected = ['admin.article_media.uploaded', 'admin.article_media.validated', 'admin.article.created', 'admin.article.submitted',
            'admin.article.reviewed', 'admin.article.published', 'admin.article.draft_saved', 'admin.article.version_copied'];
        if ($audits->pluck('action')->all() !== $expected) {
            throw new RuntimeException('Audit sequence mismatch.');
        }
        foreach ($audits as $audit) {
            if ((int) $audit->actor_user_id !== 2 || $audit->outcome !== 'succeeded'
                || ! in_array($audit->subject_public_id, [$asset->public_id, $article->public_id], true)) {
                throw new RuntimeException('Audit authority/subject mismatch.');
            }
        }
        if (DB::table('article_publication_schedules')->count() !== 0 || config('article_content.publisher_enabled') !== false
            || config('article_content.scheduling_enabled') !== false || DB::table('jobs')->count() !== 2) {
            throw new RuntimeException('Schedule/queue boundary mismatch.');
        }
        echo json_encode(['acceptance' => 'passed', 'asset_id' => $asset->public_id, 'article_id' => $article->public_id,
            'asset_status' => 'released', 'asset_revision' => 2, 'checksum_sha256' => $asset->checksum_sha256,
            'scan_and_decode_evidence' => json_decode($asset->validation_evidence, true, 12, JSON_THROW_ON_ERROR),
            'versions' => [1, 2, 3], 'published_version' => 1, 'working_version' => 3, 'working_state' => 'draft', 'immutable_references' => 12,
            'preserved_article_hashes' => $preserved, 'original_audits_preserved' => true, 'audit_actions' => $expected,
            'private_storage' => $privateStorage, 'jobs' => 2, 'schedules' => 0, 'writes' => 0], JSON_THROW_ON_ERROR)."\n";
    } finally {
        DB::rollBack();
    }
} catch (Throwable $error) {
    fwrite(STDERR, json_encode(['acceptance' => 'refused', 'class' => $error::class, 'line' => $error->getLine()], JSON_THROW_ON_ERROR)."\n");
    exit(1);
}
