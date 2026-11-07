<?php

namespace Checkupino\Acceptance\Recommendations;

use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\DoctorProfileController;
use App\Models\DoctorProfile;
use App\Models\User;
use App\Services\AccountStateService;
use App\Services\AdminIdentityService;
use App\Services\AuditLogger;
use App\Services\Content\ArticleDraftWrite;
use App\Services\Content\ArticleEditorial;
use App\Services\Health\HealthCatalog;
use App\Services\Health\PatientHealthService;
use App\Services\PanelProfileService;
use App\Services\Recommendations\PatientRecommendationService;
use App\Services\Recommendations\RecommendationAdministration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

final class CrossAuditRefusal extends \RuntimeException {}

/** Counts real owner-service reads; never replaces health values, eligibility or matching. */
final class ObservedHealth extends PatientHealthService
{
    public int $reads = 0;

    public function read(User $actor): array
    {
        $this->reads++;

        return parent::read($actor);
    }
}

/** Test-only ordinary writers, valid synthetic fixtures and safe result summaries. No boot/SQL targets here. */
final class CrossModuleFixture
{
    public static function installObserver(): void
    {
        app()->instance(PatientHealthService::class, new ObservedHealth(app(AuditLogger::class)));
    }

    public static function request(User $actor, string $method = 'GET', array $body = []): Request
    {
        $request = $method === 'GET' ? Request::create('/', 'GET', $body)
            : Request::create('/', $method, [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR));
        app()->instance('request', $request);
        $request->setUserResolver(fn () => $actor);
        Auth::shouldUse('web');
        Auth::guard('web')->setUser($actor);
        $session = app('session')->driver();
        $session->start();
        $session->put('auth.password_confirmed_at', time());
        $request->setLaravelSession($session);

        return $request;
    }

    public static function content(string $article): array
    {
        return ['definition' => ['schema_version' => 1, 'health_catalog_version' => HealthCatalog::VERSION,
            'include' => ['field' => 'smoking', 'operator' => 'eq', 'value' => 'yes', 'max_age_days' => 30], 'exclude' => null],
            'translations' => ['en' => ['title' => 'Synthetic cross-module rule', 'explanation' => 'Invented software fixture only.'],
                'fa' => ['title' => 'قاعده ساختگی آزمون', 'explanation' => 'فقط نمونه نرم‌افزاری ساختگی.']],
            'population' => ['en' => 'Synthetic fixtures.', 'fa' => 'نمونه‌های ساختگی.'],
            'limitations' => ['en' => 'No actual clinical criteria or review.', 'fa' => 'بدون معیار یا بازبینی بالینی واقعی.'],
            'sources' => [['label' => 'Synthetic reference', 'url' => 'https://example.test/synthetic']], 'targets' => [$article], 'priority' => 1];
    }

    public static function article(User $admin, string $slug): array
    {
        $writer = app(ArticleDraftWrite::class);
        $context = $writer->context(self::request($admin), null);

        return $writer->save(self::request($admin, 'POST', ['slug' => $slug, 'expected_revision' => $context['revision'],
            'intent' => 'publish', 'editorial_confirmed' => true, 'reason' => 'Synthetic isolated cross-module fixture.', 'confirmed' => true,
            'translations' => ['en' => ['title' => 'Synthetic article', 'body_html' => '<p>Invented educational fixture only.</p>', 'seo' => []]],
            'taxonomy' => [], 'health_references' => [], 'source_links' => []]), null);
    }

    public static function action(User $actor, string $rule, string $action, array $extra = []): array
    {
        $service = app(RecommendationAdministration::class);
        $view = $service->read(self::request($actor), $rule);
        $body = ['action' => $action, 'expected_revision' => $view['contexts'][$action], 'action_key' => (string) Str::uuid(), ...$extra];

        return $service->act(self::request($actor, 'POST', $body), $rule);
    }

    public static function grant(User $root, User $doctor): string
    {
        $service = app(RecommendationAdministration::class);
        $revision = $service->read(self::request($root))['grant_revision'];

        return $service->designate(self::request($root, 'POST', ['expected_revision' => $revision, 'action_key' => (string) Str::uuid(),
            'confirmed' => true, 'reviewer_id' => $doctor->public_id, 'evidence_ref' => 'synthetic-not-actual-qualification',
            'valid_until_local' => now('Asia/Tehran')->addDays(60)->format('Y-m-d\TH:i')]))['id'];
    }

    public static function health(User $patient, mixed $answer): array
    {
        $service = app(PatientHealthService::class);
        $revision = $service->read($patient)['revision'];

        return $service->save(self::request($patient, 'PUT'), $patient, ['expected_revision' => $revision,
            'catalog_version' => HealthCatalog::VERSION, 'confirmed' => true, 'changes' => ['smoking' => $answer], 'measurements' => []]);
    }

    public static function build(array $case): array
    {
        $admin = User::factory()->admin()->create()->fresh();
        $root = User::factory()->rootAdmin()->create()->fresh();
        $doctor = User::factory()->doctor()->create()->fresh();
        $patient = User::factory()->patient()->create()->fresh();
        $profile = DoctorProfile::factory()->create(['user_id' => $doctor->id, 'verified' => true]);
        $article = self::article($admin, 'cross-'.str_replace('_', '-', $case['name']));
        $service = app(RecommendationAdministration::class);
        $revision = $service->read(self::request($admin))['create_revision'];
        $rule = $service->save(self::request($admin, 'POST', ['slug' => 'rule-'.str_replace('_', '-', $case['name']),
            'content' => self::content($article['id']), 'expected_revision' => $revision, 'action_key' => (string) Str::uuid()]), null)['id'];
        $grant = self::grant($root, $doctor);
        self::action($admin, $rule, 'submit', ['reviewer_id' => $doctor->public_id]);
        if ($case['mode'] !== 'assigned') {
            self::action($doctor, $rule, 'approve', ['assessment' => 'Synthetic software mechanics, not clinical approval.',
                'attested' => true, 'valid_until_local' => now('Asia/Tehran')->addDays(45)->format('Y-m-d\TH:i')]);
        }
        if ($case['mode'] === 'published') {
            self::action($admin, $rule, 'publish');
        }
        self::health($patient, 'yes');
        if (in_array('article_publish', [$case['leader'], $case['follower']], true)) {
            $writer = app(ArticleDraftWrite::class);
            $context = $writer->context(self::request($admin), $article['id']);
            $article = $writer->save(self::request($admin, 'PUT', ['slug' => $article['slug'], 'expected_revision' => $context['revision'],
                'reason' => 'Synthetic new article version.', 'confirmed' => true,
                'translations' => ['en' => ['title' => 'Synthetic replacement', 'body_html' => '<p>New invented version.</p>', 'seo' => []]],
                'taxonomy' => [], 'health_references' => [], 'source_links' => []]), $article['id']);
            foreach (['submit', 'review'] as $action) {
                $editorial = app(ArticleEditorial::class);
                $context = $editorial->context(self::request($admin, 'GET', ['action' => $action]), $article['id']);
                $article = $editorial->act(self::request($admin, 'POST', self::editorialBody($context, $action)), $article['id']);
            }
        }
        $fixture = $case + ['admin' => $admin->id, 'root' => $root->id, 'doctor' => $doctor->id, 'patient' => $patient->id,
            'profile' => $profile->id, 'article' => $article['id'], 'rule' => $rule, 'grant' => $grant];
        foreach (['leader', 'follower'] as $side) {
            $operation = $case[$side];
            $actor = match ($operation) {
                'match', 'health_save', 'health_clear' => $patient,
                'approve', 'review_withdraw' => $doctor,
                'patient_suspend', 'doctor_suspend', 'doctor_role_change', 'doctor_unverify', 'grant_revoke' => $root,
                default => $admin,
            };
            $fixture[$side.'_actor'] = $actor->id;
            $fixture[$side.'_body'] = self::body($actor, $operation, $fixture);
        }

        return $fixture;
    }

    public static function editorialBody(array $context, string $action): array
    {
        return ['action' => $action, 'expected_revision' => $context['revision'], 'expected_version' => $context['current']['working']['version'],
            'expected_hash' => $context['current']['working']['content_hash'], 'reason' => 'Synthetic cross-module action.', 'confirmed' => true];
    }

    private static function body(User $actor, string $operation, array $fixture): array
    {
        if (str_starts_with($operation, 'article_')) {
            $action = $operation === 'article_publish' ? 'publish' : 'archive';
            $context = app(ArticleEditorial::class)->context(self::request($actor, 'GET', ['action' => $action]), $fixture['article']);

            return self::editorialBody($context, $action);
        }
        if (in_array($operation, ['health_save', 'health_clear'], true)) {
            return ['expected_revision' => app(PatientHealthService::class)->read($actor)['revision'], 'catalog_version' => HealthCatalog::VERSION,
                'confirmed' => true, 'changes' => ['smoking' => $operation === 'health_clear' ? null : 'no'], 'measurements' => []];
        }
        if ($operation === 'doctor_role_change') {
            return ['expected_revision' => app(PanelProfileService::class)->revision(User::findOrFail($fixture['doctor']))];
        }
        if ($operation === 'grant_revoke') {
            $board = app(RecommendationAdministration::class)->read(self::request($actor));

            return ['expected_revision' => collect($board['grants'])->firstWhere('id', $fixture['grant'])['revoke_revision'],
                'action_key' => (string) Str::uuid(), 'confirmed' => true];
        }
        if (in_array($operation, ['approve', 'review_withdraw', 'rule_publish'], true)) {
            $action = match ($operation) {
                'approve' => 'approve', 'review_withdraw' => 'withdraw', default => 'publish'
            };
            $view = app(RecommendationAdministration::class)->read(self::request($actor), $fixture['rule']);
            $body = ['action' => $action, 'expected_revision' => $view['contexts'][$action], 'action_key' => (string) Str::uuid()];
            if ($action === 'approve') {
                $body += ['assessment' => 'Synthetic independent assessment.', 'attested' => true, 'valid_until_local' => now('Asia/Tehran')->addDays(45)->format('Y-m-d\TH:i')];
            } elseif ($action === 'withdraw') {
                $body += ['assessment' => 'Withdraw synthetic review.', 'review_id' => $view['reviews'][0]['id']];
            }

            return $body;
        }

        return [];
    }

    public static function run(User $actor, string $operation, array $fixture, array $body): array
    {
        $observer = app(PatientHealthService::class);
        $before = $observer->reads;
        try {
            if ($operation === 'match') {
                $data = app(PatientRecommendationService::class)->read(self::request($actor, 'GET', ['language' => 'en']));
                if (($data['state'] === 'matched') !== ($data['items'] !== [])) {
                    throw new \RuntimeException('Invalid safe matching state.');
                }
                foreach ($data['items'] as $item) {
                    if ($item['article']['id'] !== $fixture['article']) {
                        throw new \RuntimeException('Cross-case result leaked.');
                    }
                }

                return ['outcome' => $data['state'], 'health_reads' => $observer->reads - $before];
            }
            $request = self::request($actor, 'POST', $body);
            if (str_starts_with($operation, 'article_')) {
                app(ArticleEditorial::class)->act($request, $fixture['article']);
            } elseif (in_array($operation, ['health_save', 'health_clear'], true)) {
                app(PatientHealthService::class)->save($request, $actor, $body);
            } elseif ($operation === 'doctor_role_change') {
                app(AdminIdentityService::class)->update($request, $actor, User::findOrFail($fixture['doctor']), [], 'patient',
                    'Synthetic doctor role change.', $body['expected_revision']);
            } elseif ($operation === 'doctor_unverify') {
                $request = self::request($actor, 'PUT', ['verified' => false, 'reason' => 'Synthetic qualification revocation.']);
                app(DoctorProfileController::class)->verify(DoctorProfile::findOrFail($fixture['profile']), $request, app(AuditLogger::class));
            } elseif (in_array($operation, ['patient_suspend', 'doctor_suspend'], true)) {
                $target = User::findOrFail($fixture[$operation === 'patient_suspend' ? 'patient' : 'doctor']);
                $request = self::request($actor, 'PUT', ['account_state' => 'suspended', 'reason' => 'Synthetic account suspension.']);
                app(UserController::class)->updateAccountState($request, $target, app(AccountStateService::class));
            } elseif ($operation === 'grant_revoke') {
                app(RecommendationAdministration::class)->designate($request, $fixture['grant']);
            } else {
                app(RecommendationAdministration::class)->act($request, $fixture['rule']);
            }

            return ['outcome' => 'committed', 'health_reads' => $observer->reads - $before];
        } catch (CrossAuditRefusal) {
            return ['outcome' => 'audit_rolled_back', 'health_reads' => $observer->reads - $before];
        } catch (HttpExceptionInterface $error) {
            if (! in_array($error->getStatusCode(), [403, 409], true)) {
                throw $error;
            }

            return ['outcome' => $error->getStatusCode() === 403 ? 'forbidden' : 'conflict', 'health_reads' => $observer->reads - $before];
        }
    }

    public static function owner(array $fixture): array
    {
        return self::run(User::findOrFail($fixture['patient']), 'match', $fixture, []);
    }

    public static function retire(array $fixture): void
    {
        $row = DB::table('recommendation_rules')->where('public_id', $fixture['rule'])->first();
        if ($row->retired_at === null) {
            self::action(User::findOrFail($fixture['admin']), $fixture['rule'], 'retire');
        }
    }
}
