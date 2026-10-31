<?php

namespace Tests\Feature\Architecture;

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as RouteFacade;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class HighAuthorityRouteContractTest extends TestCase
{
    #[DataProvider('highAuthorityMutations')]
    public function test_named_high_authority_mutation_has_route_guards(
        string $method,
        string $uri,
        string $action,
    ): void {
        $route = $this->findRoute($method, $uri);
        $middleware = array_merge($route->middleware(), $route->gatherMiddleware());

        $this->assertSame($action, $route->getActionName());
        $this->assertMiddleware($middleware, 'auth');
        $this->assertMiddleware($middleware, 'account.active');
        $this->assertMiddleware($middleware, 'role:', 'admin|root-admin');
        $this->assertMiddleware($middleware, 'password.confirmed.recent');
    }

    public function test_no_bulk_admin_mutation_route_exists(): void
    {
        $bulkAdminRoutes = collect(RouteFacade::getRoutes()->getRoutes())
            ->filter(fn (Route $route): bool => str_starts_with($route->uri(), 'admin/')
                || str_starts_with($route->uri(), 'api/admin/'))
            ->filter(fn (Route $route): bool => count(array_intersect(
                $route->methods(),
                ['POST', 'PUT', 'PATCH', 'DELETE'],
            )) > 0)
            ->filter(fn (Route $route): bool => preg_match(
                '/(^|\/)(bulk|mass|role-upgrades?)(\/|$)/',
                $route->uri(),
            ) === 1);

        $this->assertCount(0, $bulkAdminRoutes);
    }

    /** @return iterable<string, array{string, string, string}> */
    public static function highAuthorityMutations(): iterable
    {
        yield 'admin identity create' => ['POST', 'api/admin/users', 'App\Http\Controllers\Api\Admin\UserController@store'];
        yield 'admin identity update' => ['PUT', 'api/admin/users/{user}', 'App\Http\Controllers\Api\Admin\UserController@update'];
        yield 'account state' => ['PUT', 'api/admin/users/{user}/account-state', 'App\Http\Controllers\Api\Admin\UserController@updateAccountState'];
        yield 'doctor verification' => ['PUT', 'api/admin/doctors/{doctorProfile}/verify', 'App\Http\Controllers\Api\DoctorProfileController@verify'];
        yield 'questionnaire create' => ['POST', 'api/admin/questionnaires', 'App\Http\Controllers\Api\Admin\QuestionnaireController@store'];
        yield 'questionnaire update' => ['PUT', 'api/admin/questionnaires/{questionnaire}', 'App\Http\Controllers\Api\Admin\QuestionnaireController@update'];
        yield 'questionnaire archive' => ['DELETE', 'api/admin/questionnaires/{questionnaire}', 'App\Http\Controllers\Api\Admin\QuestionnaireController@destroy'];
        yield 'questionnaire submission archive' => ['DELETE', 'api/admin/questionnaire-submissions/{submission}', 'App\Http\Controllers\Api\Admin\QuestionnaireSubmissionController@destroy'];
        yield 'rating option create' => ['POST', 'api/admin/reservation-rating-options', 'App\Http\Controllers\Api\Admin\ReservationRatingOptionController@store'];
        yield 'rating option update' => ['PUT', 'api/admin/reservation-rating-options/{reservationRatingOption}', 'App\Http\Controllers\Api\Admin\ReservationRatingOptionController@update'];
        yield 'rating option archive' => ['DELETE', 'api/admin/reservation-rating-options/{reservationRatingOption}', 'App\Http\Controllers\Api\Admin\ReservationRatingOptionController@destroy'];
        yield 'reservation status override' => ['PUT', 'api/admin/reservations/{reservation}/status', 'App\Http\Controllers\Api\AdminReservationController@updateStatus'];
        yield 'reservation schedule override' => ['PUT', 'api/admin/reservations/{reservation}/schedule', 'App\Http\Controllers\Api\AdminReservationController@reschedule'];
        yield 'payment adjustment request' => ['POST', 'api/admin/payments/{payment}/adjustments', 'App\Http\Controllers\Api\Admin\PaymentAdjustmentController@store'];
        yield 'tenant registry update' => ['PUT', 'api/admin/tenant-instances/{tenantInstance}', 'App\Http\Controllers\Api\Admin\PlatformPrimitiveController@updateTenant'];
        yield 'tenant feature override' => ['PUT', 'api/admin/tenant-instances/{tenantInstance}/features/{feature}', 'App\Http\Controllers\Api\Admin\PlatformPrimitiveController@setFeature'];
        yield 'marketplace setting update' => ['PUT', 'api/admin/settings/{settingKey}', 'App\Http\Controllers\Api\Admin\PlatformPrimitiveController@updateSetting'];
        yield 'checkup create' => ['POST', 'admin/checkups', 'App\Http\Controllers\Admin\CheckupController@store'];
        yield 'checkup update' => ['PUT', 'admin/checkups/{checkup}', 'App\Http\Controllers\Admin\CheckupController@update'];
        yield 'checkup archive' => ['DELETE', 'admin/checkups/{checkup}', 'App\Http\Controllers\Admin\CheckupController@archive'];
        yield 'checkup category archive' => ['DELETE', 'admin/checkup-categories/{checkup_category}', 'App\Http\Controllers\Admin\CheckupCategoryController@archive'];
    }

    private function findRoute(string $method, string $uri): Route
    {
        $route = collect(RouteFacade::getRoutes()->getRoutes())->first(
            fn (Route $candidate): bool => in_array($method, $candidate->methods(), true)
                && $candidate->uri() === $uri,
        );

        $this->assertInstanceOf(Route::class, $route, "Missing {$method} {$uri} route.");

        return $route;
    }

    /** @param list<string> $middleware */
    private function assertMiddleware(array $middleware, string $prefix, ?string $parameter = null): void
    {
        $matching = collect($middleware)->first(
            fn (string $entry): bool => str_starts_with($entry, $prefix)
                && ($parameter === null || str_contains($entry, $parameter)),
        );

        $this->assertNotNull($matching, "Missing middleware {$prefix} on the high-authority route.");
    }
}
