<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\Content\ArticleDraftWrite;
use App\Services\Content\ArticleEditorial;
use App\Services\Content\ArticleTaxonomyWrite;
use Database\Seeders\Support\DemoFixtureContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ArticleDemoSeeder extends Seeder
{
    public function run(): void
    {
        DemoFixtureContext::guard();
        $enabled = config('article_content.enabled');
        config(['article_content.enabled' => true]);
        try {
            $actor = User::where('email', 'rootadmin@checkupino.test')->firstOrFail();
            $terms = [];
            foreach ([
                ['category', 'demo-using-checkupino', 'Using Checkupino', 'راهنمای چکاپینو'],
                ['category', 'demo-appointments', 'Appointments', 'نوبت‌ها'],
                ['tag', 'demo-getting-started', 'Getting started', 'شروع کار'],
                ['tag', 'demo-account-help', 'Account help', 'راهنمای حساب'],
                ['tag', 'demo-uploads', 'Uploads', 'بارگذاری فایل'],
            ] as [$kind, $slug, $en, $fa]) {
                $existing = DB::table('article_terms')->where('kind', $kind)->where('slug', $slug)->first();
                if ($existing) {
                    $terms[$slug] = ['id' => $existing->public_id, 'kind' => $kind];

                    continue;
                }
                $service = app(ArticleTaxonomyWrite::class);
                $context = $service->context(DemoFixtureContext::request($actor, '/api/admin/article-taxonomies/write-context'), null);
                $term = $service->mutate(DemoFixtureContext::request($actor, '/api/admin/article-taxonomies', 'POST', [
                    'expected_revision' => $context['revision'], 'kind' => $kind, 'slug' => $slug,
                    'labels' => ['en' => $en, 'fa' => $fa],
                    'descriptions' => ['en' => 'Synthetic demonstration taxonomy.', 'fa' => 'دسته‌بندی نمونه برای نمایش برنامه.'],
                    'reason' => 'Create synthetic local demo taxonomy.', 'confirmed' => true,
                ], confirmPassword: true), null, 'create');
                $terms[$slug] = ['id' => $term['id'], 'kind' => $kind];
            }

            foreach ([
                ['getting-started', 'Getting started with Checkupino', 'شروع کار با چکاپینو', 'published-draft', 'demo-getting-started'],
                ['prepare-appointment', 'Preparing for your appointment', 'آمادگی برای نوبت', 'published', 'demo-getting-started'],
                ['account-security', 'Reviewing your account settings', 'بررسی تنظیمات حساب', 'draft', 'demo-account-help'],
                ['upload-checks', 'How file checking works', 'بررسی فایل چگونه انجام می‌شود', 'in_review', 'demo-uploads'],
                ['panel-notes', 'Earlier panel demonstration notes', 'یادداشت‌های پیشین نمایش برنامه', 'archived', 'demo-account-help'],
                ['reviewed-content', 'Finding your saved questionnaires', 'پیدا کردن پرسش‌نامه‌های ثبت‌شده', 'reviewed', 'demo-getting-started'],
            ] as [$slug, $en, $fa, $state, $tag]) {
                $slug = 'demo-seed-'.$slug;
                if (DB::table('articles')->where('slug', $slug)->exists()) {
                    continue;
                }
                $translations = [
                    'en' => ['title' => $en, 'body_html' => '<h2>'.$en.'</h2><p>This is synthetic demonstration content about using the panel. No patient records or personal recommendations are included.</p><ul><li>Open the relevant page from the navigation.</li><li>Review the information before saving.</li></ul>',
                        'seo' => ['title' => $en.' | Checkupino', 'description' => 'Explore this synthetic Checkupino example and its ordinary panel controls.', 'keywords' => 'checkupino, demo']],
                    'fa' => ['title' => $fa, 'body_html' => '<h2>'.$fa.'</h2><p>این محتوای ساختگی برای نمایش کار با پنل است و شامل پروندهٔ واقعی بیمار یا پیشنهاد شخصی پزشکی نیست.</p><ul><li>صفحهٔ مورد نظر را از منو باز کنید.</li><li>پیش از ذخیره، اطلاعات را بررسی کنید.</li></ul>',
                        'seo' => ['title' => $fa.' | چکاپینو', 'description' => 'نمونهٔ ساختگی چکاپینو و امکانات معمول پنل را مشاهده کنید.', 'keywords' => 'چکاپینو، راهنما، نمایش']],
                ];
                $taxonomy = [$terms['demo-using-checkupino'], $terms[$tag]];
                if ($slug === 'demo-seed-prepare-appointment') {
                    $taxonomy[] = $terms['demo-appointments'];
                }
                $intent = in_array($state, ['published', 'published-draft', 'archived'], true) ? 'publish' : 'draft';
                $article = $this->save($actor, $slug, $translations, $taxonomy, $intent);
                if ($state === 'published-draft') {
                    $translations['en']['body_html'] .= '<p>This newer draft remains separate from the published version.</p>';
                    $translations['fa']['body_html'] .= '<p>این پیش‌نویس تازه از نسخهٔ منتشرشده جدا نگه داشته می‌شود.</p>';
                    $this->save($actor, $slug, $translations, $taxonomy, 'draft', $article['id']);
                } elseif (in_array($state, ['in_review', 'reviewed'], true)) {
                    $this->action($actor, $article['id'], 'submit');
                    if ($state === 'reviewed') {
                        $this->action($actor, $article['id'], 'review');
                    }
                } elseif ($state === 'archived') {
                    $this->action($actor, $article['id'], 'archive');
                }
            }
        } finally {
            config(['article_content.enabled' => $enabled]);
        }
    }

    private function save(User $actor, string $slug, array $translations, array $taxonomy, string $intent, ?string $id = null): array
    {
        $service = app(ArticleDraftWrite::class);
        $context = $service->context(DemoFixtureContext::request($actor, '/api/admin/articles/write-context'), $id);

        return $service->save(DemoFixtureContext::request($actor, '/api/admin/articles', 'POST', [
            'expected_revision' => $context['revision'], 'slug' => $slug, 'translations' => $translations,
            'taxonomy' => $taxonomy, 'health_references' => [], 'source_links' => [], 'intent' => $intent,
            'reason' => 'Create synthetic local demo article.',
        ]), $id);
    }

    public function action(User $actor, string $id, string $action): array
    {
        DemoFixtureContext::guard();
        $service = app(ArticleEditorial::class);
        $context = $service->context(DemoFixtureContext::request($actor, '/api/admin/articles/'.$id.'/editorial-context', data: ['action' => $action]), $id);

        return $service->act(DemoFixtureContext::request($actor, '/api/admin/articles/'.$id.'/editorial', 'POST', [
            'action' => $action, 'expected_revision' => $context['revision'], 'expected_version' => $context['current']['working']['version'],
            'expected_hash' => $context['current']['working']['content_hash'], 'reason' => 'Synthetic demo editorial transition.', 'confirmed' => true,
        ], confirmPassword: true), $id);
    }
}
